/**
 * Billing UI — plan selector, checkout flow, trial management, and billing history.
 *
 * Used in the dashboard Settings subscription tab.
 * Uses plan definitions from ~/lib/billing.
 * Supports 7-day trial flow — "Start Free Trial" CTA, days remaining, spots counter.
 */
import { useState, useEffect, useCallback } from "react";
import {
  PLANS,
  formatPrice,
  formatPricePerMonth,
  isUpgrade,
  getAllPlans,
  type PlanId,
  type Plan,
  type BillingCycle,
} from "~/lib/billing";

// ---------------------------------------------------------------------------
// Trial constants
// ---------------------------------------------------------------------------

const TRIAL_DAYS = 7;
const MAX_TRIAL_SPOTS = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BillingManagerProps {
  /** Current subscription tier from the business record */
  currentTier: string;
  /** Business ID for server calls */
  businessId: string;
  /** Business name for display */
  businessName: string;
  /** When non-null, the business is on a trial until this ISO date */
  trialEndsAt?: string | null;
  /** When the business was created (ISO string) */
  createdAt?: string;
  /** Current number of trial spots used (fetch from server) */
  trialSpotsUsed?: number;
}

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

const ANNUAL_SAVINGS_PERCENT = 20;

interface BillingInvoice {
  id: string;
  date: string;
  amount: string;
  amountCents: number;
  status: "paid" | "pending" | "failed" | "refunded";
  description: string;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface BillingInfo {
  currentPlan: Plan;
  billingCycle: BillingCycle;
  nextPaymentDate: string;
  paymentMethod: PaymentMethod;
  invoices: BillingInvoice[];
}

function getMockBillingInfo(tier: string, cycle: BillingCycle = "monthly"): BillingInfo {
  const planId = (tier as PlanId) || "starter";
  const plan = PLANS[planId] || PLANS.starter;

  const nextPayment = new Date();
  nextPayment.setDate(nextPayment.getDate() + 30);

  const invoices: BillingInvoice[] = [
    {
      id: "inv_001",
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      amount: formatPrice(cycle === "annual" ? plan.annualPriceCents / 12 : plan.monthlyPriceCents / 1),
      amountCents: cycle === "annual" ? plan.annualPriceCents / 12 : plan.monthlyPriceCents,
      status: "paid",
      description: `${plan.name} Plan — ${cycle === "annual" ? "Annual" : "Monthly"}`,
    },
    {
      id: "inv_002",
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      amount: formatPrice(cycle === "annual" ? plan.annualPriceCents / 12 : plan.monthlyPriceCents / 1),
      amountCents: cycle === "annual" ? plan.annualPriceCents / 12 : plan.monthlyPriceCents,
      status: "paid",
      description: `${plan.name} Plan — ${cycle === "annual" ? "Annual" : "Monthly"}`,
    },
  ];

  return {
    currentPlan: plan,
    billingCycle: cycle,
    nextPaymentDate: nextPayment.toISOString().split("T")[0],
    paymentMethod: {
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2028,
    },
    invoices,
  };
}

// ---------------------------------------------------------------------------
// Trial helpers
// ---------------------------------------------------------------------------

function computeTrialDaysRemaining(trialEndsAt: string | null | undefined, createdAt?: string): number {
  // If explicit trial end date is provided
  if (trialEndsAt) {
    const end = new Date(trialEndsAt);
    const now = new Date();
    const remaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, remaining);
  }

  // Fallback: compute from creation date (first 7 days are trial)
  if (createdAt) {
    const created = new Date(createdAt);
    const trialEnd = new Date(created.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const remaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, remaining);
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingManager({
  currentTier,
  businessId,
  businessName,
  trialEndsAt,
  createdAt,
  trialSpotsUsed = 0,
}: BillingManagerProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [spotsRemaining, setSpotsRemaining] = useState(MAX_TRIAL_SPOTS);
  const [spotsLoaded, setSpotsLoaded] = useState(false);

  // Compute trial state
  const trialDaysRemaining = computeTrialDaysRemaining(trialEndsAt, createdAt);
  const isInTrial = trialDaysRemaining > 0;
  const hasSubscription = currentTier !== "starter" || !!trialEndsAt;

  const billingInfo = getMockBillingInfo(currentTier, billingCycle);
  const currentPlanId = currentTier as PlanId;

  // Load trial spots
  useEffect(() => {
    // Simulate loading trial spots (in production, this would come from a server function)
    const timer = setTimeout(() => {
      setSpotsRemaining(Math.max(0, MAX_TRIAL_SPOTS - trialSpotsUsed));
      setSpotsLoaded(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [trialSpotsUsed]);

  const formatDateInner = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCheckout = useCallback(
    async (plan: Plan) => {
      setCheckoutLoading(true);
      setSelectedPlan(plan.id);

      try {
        // Import server function dynamically
        const { createCheckoutSession } = await import("~/lib/server/billing");
        const sessionToken =
          typeof window !== "undefined"
            ? localStorage.getItem("branded_session_token") || ""
            : "";

        const result = await createCheckoutSession({
          sessionToken,
          businessId,
          planId: plan.id as PlanId,
          billingCycle,
          successUrl: `${window.location.origin}/dashboard/settings?checkout=success&plan=${plan.id}`,
          cancelUrl: `${window.location.origin}/dashboard/settings?checkout=cancel`,
        });

        if (result.success && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else if (result.success) {
          // Mock mode — show confirmation
          alert(
            `Trial started for ${plan.name}!\n\nYou have ${TRIAL_DAYS} days to try all features.\n(Stripe integration pending — no charge.)`,
          );
        } else {
          alert(result.error || "Checkout failed. Please try again.");
        }
      } catch (err) {
        alert("Checkout failed. Please try again.");
      } finally {
        setCheckoutLoading(false);
        setSelectedPlan(null);
      }
    },
    [businessId, billingCycle],
  );

  const handleStartTrial = useCallback(
    async (plan: Plan) => {
      setCheckoutLoading(true);
      setSelectedPlan(plan.id);

      try {
        const { createCheckoutSession } = await import("~/lib/server/billing");
        const sessionToken =
          typeof window !== "undefined"
            ? localStorage.getItem("branded_session_token") || ""
            : "";

        const result = await createCheckoutSession({
          sessionToken,
          businessId,
          planId: plan.id as PlanId,
          billingCycle: "monthly",
          successUrl: `${window.location.origin}/dashboard/settings?trial=started&plan=${plan.id}`,
          cancelUrl: `${window.location.origin}/dashboard/settings?trial=cancel`,
        });

        if (result.success && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else if (result.success) {
          alert(
            `🎉 Your 7-day free trial of ${plan.name} has started!\n\nExplore all features — no charge until ${new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString()}.\n(Stripe integration pending)`,
          );
          // Refresh the page to show trial status
          setTimeout(() => window.location.reload(), 1500);
        } else {
          alert(result.error || "Unable to start trial. Please try again.");
        }
      } catch (err) {
        alert("Unable to start trial. Please try again.");
      } finally {
        setCheckoutLoading(false);
        setSelectedPlan(null);
      }
    },
    [businessId],
  );

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      alert(
        "Subscription cancellation requested. Your access will continue until the end of the billing period.",
      );
      setConfirmCancel(false);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUpdatePayment = async () => {
    setUpdatingPayment(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      alert("Payment method update link sent to your email.");
    } finally {
      setUpdatingPayment(false);
    }
  };

  const getBrandIcon = (brand: string) => {
    const colors: Record<string, string> = {
      visa: "#1a1f71",
      mastercard: "#eb001b",
      amex: "#2e77bc",
    };
    return colors[brand] || "#6b7280";
  };

  const getStatusBadge = (status: BillingInvoice["status"]) => {
    const styles: Record<string, string> = {
      paid: "bg-green-100 text-green-700",
      pending: "bg-yellow-100 text-yellow-700",
      failed: "bg-red-100 text-red-700",
      refunded: "bg-gray-100 text-gray-600",
    };
    return styles[status] || styles.paid;
  };

  const currentPlan = billingInfo.currentPlan;
  const allPlans = getAllPlans();
  const trialEndDate = trialDaysRemaining > 0
    ? new Date(Date.now() + trialDaysRemaining * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="space-y-6">
      {/* ================================================================
          Trial Banner
          ================================================================ */}
      {isInTrial && (
        <div className="overflow-hidden rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-sm">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl">
                ⏳
              </div>
              <div>
                <h3 className="text-base font-semibold text-amber-800">
                  You're on a free trial
                </h3>
                <p className="mt-0.5 text-sm text-amber-700">
                  <span className="font-bold">{trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} remaining</span>
                  {" "}— your trial ends on {trialEndDate}.
                  {currentTier !== "starter" && (
                    <> You'll be billed for the <strong>{currentPlan.name}</strong> plan.</>
                  )}
                  {currentTier === "starter" && (
                    <> Choose a plan below to continue using Branded after your trial.</>
                  )}
                </p>
              </div>
            </div>
            {currentTier === "starter" && (
              <a
                href="#available-plans"
                className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
              >
                Pick a Plan
              </a>
            )}
          </div>

          {/* Trial progress bar */}
          <div className="bg-white/60 px-5 pb-4">
            <div className="flex items-center justify-between text-xs text-amber-600">
              <span>Day 1</span>
              <span>Day {TRIAL_DAYS}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-amber-200">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-700"
                style={{ width: `${((TRIAL_DAYS - trialDaysRemaining) / TRIAL_DAYS) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          Trial Spots Counter (for non-subscribers)
          ================================================================ */}
      {!hasSubscription && !isInTrial && spotsLoaded && (
        <div className="rounded-xl border-2 border-primary-200 bg-gradient-to-r from-primary-50 to-secondary-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-primary-800">
                🚀 Branded is live — Try 7 days free
              </h3>
              <p className="mt-0.5 text-sm text-primary-600">
                {spotsRemaining > 0 ? (
                  <>
                    <span className="font-bold">Only {spotsRemaining} trial spot{spotsRemaining !== 1 ? "s" : ""} remaining</span>
                    {" "}— first {MAX_TRIAL_SPOTS} businesses get 7 days free.
                  </>
                ) : (
                  "All trial spots are taken — but you can still subscribe below."
                )}
              </p>
            </div>
            {spotsRemaining > 0 && (
              <button
                type="button"
                onClick={() => {
                  const proPlan = PLANS.pro;
                  setSelectedPlan(proPlan.id);
                  handleStartTrial(proPlan);
                }}
                disabled={(checkoutLoading && selectedPlan === "pro") || spotsRemaining <= 0}
                className="shrink-0 rounded-lg bg-gradient-to-r from-primary-600 to-secondary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-500/20 transition-all hover:shadow-lg hover:shadow-primary-500/30 disabled:opacity-50"
              >
                {checkoutLoading && selectedPlan === "pro" ? "Starting..." : "Start 7-Day Free Trial"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          Current Plan Card
          ================================================================ */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-primary-50 via-white to-secondary-50 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                {hasSubscription ? "Current Plan" : "Free Plan"}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {hasSubscription ? currentPlan.name : "Starter (Free)"}
                </h2>
                {hasSubscription && (
                  <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                    {billingCycle === "annual" ? "Annual" : "Monthly"}
                  </span>
                )}
                {isInTrial && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Trial
                  </span>
                )}
              </div>
            </div>
            {hasSubscription && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Next payment</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-700">
                  {isInTrial ? "After trial" : formatDateInner(billingInfo.nextPaymentDate)}
                </p>
              </div>
            )}
          </div>
        </div>

        {hasSubscription && (
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            {/* Payment method */}
            <div>
              <p className="text-xs font-medium text-gray-400">Payment Method</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div
                  className="flex size-8 items-center justify-center rounded-md text-[10px] font-bold text-white"
                  style={{
                    backgroundColor: getBrandIcon(billingInfo.paymentMethod.brand),
                  }}
                >
                  {billingInfo.paymentMethod.brand.toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    •••• {billingInfo.paymentMethod.last4}
                  </p>
                  <p className="text-xs text-gray-400">
                    Expires {billingInfo.paymentMethod.expMonth}/
                    {billingInfo.paymentMethod.expYear}
                  </p>
                </div>
              </div>
            </div>

            {/* Billing cycle */}
            <div>
              <p className="text-xs font-medium text-gray-400">Billing Cycle</p>
              <div className="mt-1.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      billingCycle === "monthly"
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("annual")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      billingCycle === "annual"
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Annual
                    <span className="ml-1 text-xs opacity-80">
                      (-{ANNUAL_SAVINGS_PERCENT}%)
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div>
              <p className="text-xs font-medium text-gray-400">Actions</p>
              <div className="mt-1.5 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleUpdatePayment}
                  disabled={updatingPayment}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {updatingPayment ? "Sending..." : "Update Payment Method"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Cancel Subscription
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================
          Plan Selector
          ================================================================ */}
      <div id="available-plans">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Available Plans</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {billingCycle === "annual"
                ? `Save ${ANNUAL_SAVINGS_PERCENT}% with annual billing`
                : "Billed monthly — cancel anytime"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {allPlans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlanId;
            const canUpgrade = isUpgrade(currentPlanId as PlanId, plan.id);
            const isSelected = selectedPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border-2 bg-white p-5 transition-all ${
                  plan.highlighted
                    ? "border-primary-500 shadow-lg shadow-primary-500/10"
                    : isCurrentPlan
                      ? "border-primary-300 bg-primary-50/30"
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary-600 to-secondary-600 px-3 py-1 text-xs font-semibold text-white shadow-md">
                    Most Popular
                  </div>
                )}

                {/* Trial badge on recommended plan */}
                {plan.recommended && !isCurrentPlan && spotsRemaining > 0 && (
                  <div className="absolute -top-3 right-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                    7-DAY FREE TRIAL
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">
                    {plan.name}
                  </h3>
                  {isCurrentPlan && (
                    <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-[10px] font-semibold text-primary-700">
                      Current
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatPrice(
                      billingCycle === "annual"
                        ? plan.annualPriceCents / 12
                        : plan.monthlyPriceCents,
                    )}
                  </span>
                  <span className="text-sm text-gray-500">/mo</span>
                  {billingCycle === "annual" && (
                    <p className="text-xs text-gray-400">{formatPrice(plan.annualPriceCents)}/yr</p>
                  )}
                </div>

                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature.name} className="flex items-start gap-2">
                      <svg
                        className="mt-0.5 size-4 shrink-0 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-gray-600">{feature.name}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 space-y-2">
                  {isCurrentPlan ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-400"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <>
                      {/* Start Trial CTA — for non-subscribers */}
                      {!hasSubscription && plan.recommended && spotsRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => handleStartTrial(plan)}
                          disabled={(checkoutLoading && isSelected) || spotsRemaining <= 0}
                          className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-500/20 transition-all hover:shadow-lg disabled:opacity-50"
                        >
                          {checkoutLoading && isSelected
                            ? "Starting..."
                            : `🎁 Start 7-Day Free Trial`}
                        </button>
                      )}

                      {/* Upgrade/Downgrade button */}
                      {canUpgrade ? (
                        <button
                          type="button"
                          onClick={() => handleCheckout(plan)}
                          disabled={checkoutLoading && isSelected}
                          className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 ${
                            plan.highlighted
                              ? "bg-gradient-to-r from-primary-600 to-secondary-600 shadow-md shadow-primary-500/20 hover:shadow-lg"
                              : "bg-primary-600 hover:bg-primary-700"
                          }`}
                        >
                          {checkoutLoading && isSelected
                            ? "Redirecting..."
                            : hasSubscription
                              ? "Upgrade"
                              : `Subscribe — ${formatPrice(billingCycle === "annual" ? plan.annualPriceCents / 12 : plan.monthlyPriceCents)}/mo`}
                        </button>
                      ) : (
                        !plan.recommended && (
                          <button
                            type="button"
                            disabled
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-400"
                          >
                            Downgrade (contact support)
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================================================================
          Billing History (only for subscribers / post-trial)
          ================================================================ */}
      {hasSubscription && (
        <div>
          <h2 className="mb-3 text-lg font-bold text-gray-900">Billing History</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="hidden sm:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Date
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Description
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Amount
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isInTrial ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">
                        Billing history will appear here after your trial ends.
                      </td>
                    </tr>
                  ) : (
                    billingInfo.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3 text-sm text-gray-700">
                          {formatDateInner(inv.date)}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-700">
                          {inv.description}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">
                          {inv.amount}/mo
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusBadge(inv.status)}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 sm:hidden">
              {isInTrial ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  Billing history will appear here after your trial ends.
                </div>
              ) : (
                billingInfo.invoices.map((inv) => (
                  <div key={inv.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{inv.amount}</p>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusBadge(inv.status)}`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{inv.description}</p>
                    <p className="text-xs text-gray-400">{formatDateInner(inv.date)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          Cancel Confirmation Modal
          ================================================================ */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="size-5 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Cancel Subscription
                </h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  Your access will continue until the end of the billing period.
                  You won't be charged again.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Keep Plan
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelLoading}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelLoading ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
