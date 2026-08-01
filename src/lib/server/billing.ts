/**
 * Stripe billing server functions for the Branded platform.
 * Uses createServerFn with requireBusinessAuth for protected endpoints.
 * Gates real Stripe API calls behind STRIPE_SECRET_KEY — returns mock data when absent.
 */
import { createServerFn } from "@tanstack/react-start";
import { getDb, uuidv4, isTrialAvailable, incrementTrialUsed } from "~/lib/db";
import { requireBusinessAuth } from "~/lib/auth";
import { PLANS, getPlanPrice } from "~/lib/billing";
import type { PlanId, BillingCycle, SubscriptionStatus } from "~/lib/billing";

// ---------------------------------------------------------------------------
// Stripe client (lazy, mock when no key)
// ---------------------------------------------------------------------------

let _stripe: unknown = null;

function getStripeClient() {
  if (_stripe) return _stripe;
  if (process.env.STRIPE_SECRET_KEY) {
    // Real Stripe — lazy load
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require("stripe");
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } else {
    // Mock mode
    _stripe = createMockStripeClient();
  }
  return _stripe;
}

function isMockMode(): boolean {
  return !process.env.STRIPE_SECRET_KEY;
}

// ---------------------------------------------------------------------------
// Mock Stripe client
// ---------------------------------------------------------------------------

function createMockStripeClient() {
  return {
    checkout: {
      sessions: {
        create: async (opts: {
          customer_email?: string;
          line_items: Array<{ price: string; quantity: number }>;
          mode: string;
          success_url: string;
          cancel_url: string;
          subscription_data?: { trial_period_days?: number };
        }) => ({
          id: `cs_mock_${Date.now()}`,
          url: `https://checkout.stripe.com/mock/${Date.now()}`,
          status: "open",
          customer_email: opts.customer_email,
          amount_total: 7900,
          currency: "usd",
          subscription_data: opts.subscription_data,
        }),
      },
    },
    customers: {
      create: async (opts: { email: string; metadata?: Record<string, string> }) => ({
        id: `cus_mock_${Date.now()}`,
        email: opts.email,
        metadata: opts.metadata ?? {},
      }),
    },
    subscriptions: {
      retrieve: async (id: string) => ({
        id,
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: `price_mock` } }] },
        plan: { amount: 7900 },
      }),
      update: async (id: string, opts: { cancel_at_period_end?: boolean }) => ({
        id,
        cancel_at_period_end: opts.cancel_at_period_end ?? false,
        status: opts.cancel_at_period_end ? "active" : "canceled",
      }),
      del: async () => ({ id: "canceled", status: "canceled" }),
    },
    invoices: {
      list: async (opts: { customer: string; limit?: number }) => ({
        data: Array(opts.limit || 5)
          .fill(null)
          .map((_, i) => ({
            id: `in_mock_${i}_${Date.now()}`,
            amount_paid: 7900,
            status: "paid",
            invoice_pdf: `https://invoice.stripe.com/mock/${i}`,
            created: Math.floor(Date.now() / 1000) - i * 30 * 24 * 3600,
          })),
      }),
    },
    webhooks: {
      constructEvent: (payload: string, sig: string, _secret: string) => {
        if (sig.startsWith("mock_valid_")) {
          return JSON.parse(payload);
        }
        throw new Error("Invalid signature");
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckoutResult {
  success: boolean;
  error?: string;
  checkoutUrl?: string;
  sessionId?: string;
}

export interface SubscriptionInfo {
  success: boolean;
  error?: string;
  subscription?: {
    id: string;
    planId: PlanId;
    planName: string;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    amountCents: number;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
}

export interface BillingHistoryItem {
  id: string;
  amountCents: number;
  status: string;
  description: string;
  invoiceUrl?: string;
  paidAt?: string;
  createdAt: string;
}

export interface BillingHistoryResult {
  success: boolean;
  error?: string;
  invoices?: BillingHistoryItem[];
}

// ---------------------------------------------------------------------------
// Get or create subscription record
// ---------------------------------------------------------------------------

function getOrCreateSubscription(businessId: string) {
  const db = getDb();
  let sub = db
    .prepare("SELECT * FROM subscriptions WHERE business_id = ?")
    .get(businessId) as Record<string, unknown> | undefined;

  if (!sub) {
    const id = uuidv4();
    const biz = db.prepare("SELECT subscription_tier FROM businesses WHERE id = ?").get(businessId) as
      | { subscription_tier: string }
      | undefined;
    db.prepare(
      "INSERT INTO subscriptions (id, business_id, plan_id, status) VALUES (?, ?, ?, 'inactive')"
    ).run(id, businessId, biz?.subscription_tier ?? "starter");
    sub = db.prepare("SELECT * FROM subscriptions WHERE business_id = ?").get(businessId) as
      | Record<string, unknown>
      | undefined;
  }

  return sub;
}

// ---------------------------------------------------------------------------
// Create checkout session
// ---------------------------------------------------------------------------

export const createCheckoutSession = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sessionToken: string;
      businessId: string;
      planId: PlanId;
      billingCycle: BillingCycle;
      successUrl?: string;
      cancelUrl?: string;
    }) => {
      if (!data.planId || !data.businessId || !data.sessionToken) {
        throw new Error("Missing required fields");
      }
      return data;
    }
  )
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const auth = requireBusinessAuth(data.sessionToken);
    if (!auth.authorized) return { success: false, error: auth.error };

    if (auth.user!.businessId !== data.businessId) {
      return { success: false, error: "Access denied" };
    }

    const { planId, billingCycle, successUrl, cancelUrl } = data;
    const plan = PLANS[planId];
    if (!plan) return { success: false, error: "Invalid plan" };

    const price = getPlanPrice(planId, billingCycle);
    const db = getDb();
    const business = db
      .prepare("SELECT name, email FROM business_owners WHERE business_id = ?")
      .get(data.businessId) as { name: string; email: string } | undefined;

    try {
      const stripe = getStripeClient() as Record<string, any>;

      // Get or create Stripe customer
      let sub = getOrCreateSubscription(data.businessId);
      let customerId = sub?.stripe_customer_id as string | undefined;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: business?.email ?? "",
          metadata: { business_id: data.businessId },
        });
        customerId = customer.id;
        db.prepare("UPDATE subscriptions SET stripe_customer_id = ? WHERE business_id = ?").run(
          customerId,
          data.businessId
        );
      }

      // Check if trial is available (first 10 businesses)
      const trialAvailable = isTrialAvailable();

      // Determine the price ID based on billing cycle
      const priceId =
        billingCycle === "annual"
          ? (plan.stripeAnnualPriceId || plan.stripeMonthlyPriceId)
          : plan.stripeMonthlyPriceId;

      // Create checkout session
      const sessionOpts: Record<string, any> = {
        customer_email: business?.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url:
          successUrl || `https://branded.app/dashboard?checkout=success&plan=${planId}`,
        cancel_url:
          cancelUrl || `https://branded.app/dashboard?checkout=canceled`,
      };

      if (trialAvailable) {
        sessionOpts.subscription_data = { trial_period_days: 7 };
      }

      const session = await stripe.checkout.sessions.create(sessionOpts);

      if (isMockMode()) {
        // In mock mode, simulate immediate subscription with trial
        const trialUsed = trialAvailable ? incrementTrialUsed() : getTrialUsedCount();
        const status = trialAvailable ? "trialing" : "active";
        db.prepare(
          `UPDATE subscriptions SET plan_id = ?, billing_cycle = ?, status = ?,
           stripe_subscription_id = ?, current_period_end = datetime('now', '+30 days'),
           updated_at = datetime('now') WHERE business_id = ?`
        ).run(planId, billingCycle, status, `sub_mock_${Date.now()}`, data.businessId);
        db.prepare("UPDATE businesses SET subscription_tier = ? WHERE id = ?").run(
          planId,
          data.businessId
        );
      } else if (trialAvailable) {
        // Mark trial as used for real Stripe
        incrementTrialUsed();
      }

      return {
        success: true,
        checkoutUrl: (session as any).url,
        sessionId: (session as any).id,
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to create checkout session" };
    }
  });

// ---------------------------------------------------------------------------
// Get subscription status
// ---------------------------------------------------------------------------

export const getSubscriptionStatus = createServerFn({ method: "GET" })
  .validator((data: { sessionToken: string; businessId: string }) => {
    if (!data.businessId) throw new Error("businessId required");
    return data;
  })
  .handler(async ({ data }): Promise<SubscriptionInfo> => {
    const auth = requireBusinessAuth(data.sessionToken);
    if (!auth.authorized) return { success: false, error: auth.error };
    if (auth.user!.businessId !== data.businessId) {
      return { success: false, error: "Access denied" };
    }

    const db = getDb();
    const sub = db
      .prepare("SELECT * FROM subscriptions WHERE business_id = ?")
      .get(data.businessId) as
      | {
          id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: string;
          plan_id: string;
          billing_cycle: string;
          current_period_end: string | null;
          cancel_at_period_end: number;
        }
      | undefined;

    if (!sub) {
      return {
        success: true,
        subscription: {
          id: "",
          planId: "starter",
          planName: "Starter",
          status: "inactive",
          billingCycle: "monthly",
          amountCents: 0,
          currentPeriodEnd: "",
          cancelAtPeriodEnd: false,
        },
      };
    }

    const plan = PLANS[sub.plan_id as PlanId];
    const amountCents = getPlanPrice(sub.plan_id as PlanId, sub.billing_cycle as BillingCycle);

    return {
      success: true,
      subscription: {
        id: sub.id,
        planId: sub.plan_id as PlanId,
        planName: plan?.name ?? sub.plan_id,
        status: sub.status as SubscriptionStatus,
        billingCycle: sub.billing_cycle as BillingCycle,
        amountCents,
        currentPeriodEnd: sub.current_period_end ?? "",
        cancelAtPeriodEnd: sub.cancel_at_period_end === 1,
        stripeCustomerId: sub.stripe_customer_id ?? undefined,
        stripeSubscriptionId: sub.stripe_subscription_id ?? undefined,
      },
    };
  });

// ---------------------------------------------------------------------------
// Get billing history
// ---------------------------------------------------------------------------

export const getBillingHistory = createServerFn({ method: "GET" })
  .validator((data: { sessionToken: string; businessId: string; limit?: number }) => {
    return data;
  })
  .handler(async ({ data }): Promise<BillingHistoryResult> => {
    const auth = requireBusinessAuth(data.sessionToken);
    if (!auth.authorized) return { success: false, error: auth.error };
    if (auth.user!.businessId !== data.businessId) {
      return { success: false, error: "Access denied" };
    }

    const db = getDb();

    // First check local invoices
    const localInvoices = db
      .prepare(
        "SELECT * FROM invoices WHERE business_id = ? ORDER BY created_at DESC LIMIT ?"
      )
      .all(data.businessId, data.limit ?? 12) as Array<{
      id: string;
      amount_cents: number;
      status: string;
      description: string | null;
      invoice_url: string | null;
      paid_at: string | null;
      created_at: string;
    }>;

    if (localInvoices.length > 0) {
      return {
        success: true,
        invoices: localInvoices.map((inv) => ({
          id: inv.id,
          amountCents: inv.amount_cents,
          status: inv.status,
          description: inv.description ?? "",
          invoiceUrl: inv.invoice_url ?? undefined,
          paidAt: inv.paid_at ?? undefined,
          createdAt: inv.created_at,
        })),
      };
    }

    // Try Stripe if no local invoices
    const sub = db
      .prepare("SELECT stripe_customer_id FROM subscriptions WHERE business_id = ?")
      .get(data.businessId) as { stripe_customer_id: string | null } | undefined;

    if (sub?.stripe_customer_id) {
      try {
        const stripe = getStripeClient() as Record<string, any>;
        const invoices = await stripe.invoices.list({
          customer: sub.stripe_customer_id,
          limit: data.limit ?? 12,
        });

        return {
          success: true,
          invoices: invoices.data.map((inv: any) => ({
            id: inv.id,
            amountCents: inv.amount_paid ?? 0,
            status: inv.status ?? "unknown",
            description: `Invoice ${inv.id}`,
            invoiceUrl: inv.invoice_pdf ?? undefined,
            paidAt: inv.created ? new Date(inv.created * 1000).toISOString() : undefined,
            createdAt: new Date(inv.created * 1000).toISOString(),
          })),
        };
      } catch {
        // Fall through to empty
      }
    }

    return { success: true, invoices: [] };
  });

// ---------------------------------------------------------------------------
// Cancel subscription
// ---------------------------------------------------------------------------

export const cancelSubscription = createServerFn({ method: "POST" })
  .validator((data: { sessionToken: string; businessId: string }) => {
    return data;
  })
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const auth = requireBusinessAuth(data.sessionToken);
    if (!auth.authorized) return { success: false, error: auth.error };
    if (auth.user!.businessId !== data.businessId) {
      return { success: false, error: "Access denied" };
    }

    const db = getDb();
    const sub = db
      .prepare("SELECT * FROM subscriptions WHERE business_id = ?")
      .get(data.businessId) as
      | { stripe_subscription_id: string | null; status: string }
      | undefined;

    if (!sub) {
      return { success: false, error: "No subscription found" };
    }

    try {
      if (sub.stripe_subscription_id && !isMockMode()) {
        const stripe = getStripeClient() as Record<string, any>;
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      }

      // Update local subscription
      db.prepare(
        "UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 1, updated_at = datetime('now') WHERE business_id = ?"
      ).run(data.businessId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to cancel subscription" };
    }
  });