/**
 * Email onboarding drip sequence for new Branded signups.
 *
 * When a business owner registers, they receive a timed series of 4 emails
 * over 10 days to guide them toward launching and subscribing.
 *
 * Sequence:
 *   Email 1 — "Welcome to Branded" (sent immediately via existing code)
 *   Email 2 — "Add more pages to your app" (2 days after signup)
 *   Email 3 — "Ready to go live?" (5 days after signup)
 *   Email 4 — "Unlock premium features" (10 days after signup)
 *
 * Architecture:
 *   - scheduleEmailDrip() creates the drip record after registration
 *   - processPendingDrips() checks for overdue drips and sends the next email
 *   - A cron endpoint at POST /api/cron/process-drips triggers processing
 *   - Opportunistic processing on dashboard page loads ensures timely delivery
 */

import {
  uuidv4,
  dbCreateDrip,
  dbGetPendingDrips,
  dbUpdateDripStep,
  dbGetDripByBusiness,
  getPagesByBusiness,
  getBusiness,
} from "~/lib/db";
import {
  addPagesEmailHtml,
  addPagesEmailText,
  goLiveEmailHtml,
  goLiveEmailText,
  premiumEmailHtml,
  premiumEmailText,
} from "~/lib/email-templates";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = "https://brandedapp.ctonew.app";

/**
 * Interval between emails in days (from signup).
 * Email 1 (welcome) is immediate; the drip starts at step 1.
 *
 * Step → Email mapping:
 *   1 → Email 2 (2 days after signup)
 *   2 → Email 3 (5 days after signup)
 *   3 → Email 4 (10 days after signup)
 *   4 → Done
 */
const STEP_INTERVALS: Record<number, number> = {
  1: 2, // step 1: 2 days
  2: 3, // step 1→2: +3 days (total 5)
  3: 5, // step 2→3: +5 days (total 10)
};

// ---------------------------------------------------------------------------
// Email sender (reuses same mechanism as email.ts)
// ---------------------------------------------------------------------------

async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    const response = await fetch("https://api.ctomail.io/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inboxId: "branded-2df426f1@ctomail.io",
        to: [to],
        subject,
        body: html,
        html: true,
      }),
    });

    if (!response.ok) {
      console.error("Email send failed:", response.status, await response.text());
      return false;
    }

    console.log(`Drip email sent: "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Schedule drip after registration
// ---------------------------------------------------------------------------

/**
 * Call this after a business owner registers. Creates the drip record
 * and returns immediately — the welcome email is already handled separately.
 *
 * The first drip email (Email 2) will be sent ~2 days later by
 * processPendingDrips.
 */
export async function scheduleEmailDrip(
  businessOwnerEmail: string,
  businessName: string,
  businessId: string,
): Promise<void> {
  try {
    // Check if a drip already exists for this business (idempotent)
    const existing = dbGetDripByBusiness(businessId);
    if (existing) {
      console.log(`Email drip already scheduled for business ${businessId}`);
      return;
    }

    // Calculate when Email 2 should go out: now + 2 days
    const nextSendAt = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

    const dripId = uuidv4();
    dbCreateDrip({
      id: dripId,
      business_id: businessId,
      email: businessOwnerEmail,
      business_name: businessName,
      last_sent_step: 1, // Welcome (email 1) already sent
      next_send_at: nextSendAt,
    });

    console.log(
      `Email drip scheduled for ${businessOwnerEmail}: next email at ${nextSendAt}`,
    );
  } catch (err) {
    console.error("Failed to schedule email drip:", err);
  }
}

// ---------------------------------------------------------------------------
// Process pending drips
// ---------------------------------------------------------------------------

export interface DripProcessingResult {
  processed: number;
  sent: number;
  failed: number;
  details: string[];
}

/**
 * Checks the email_drips table for any records where next_send_at <= now
 * and last_sent_step < 4. Sends the next email in the sequence and updates
 * the record.
 *
 * This is triggered by the cron endpoint and opportunistically on dashboard
 * page loads.
 */
export async function processPendingDrips(): Promise<DripProcessingResult> {
  const result: DripProcessingResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    details: [],
  };

  try {
    const pending = dbGetPendingDrips();
    result.processed = pending.length;

    for (const drip of pending) {
      const nextStep = drip.last_sent_step + 1;

      try {
        const sent = await sendDripEmail(drip, nextStep);

        if (sent) {
          // Advance to next step
          let nextSendAt: string | null = null;
          if (nextStep < 4) {
            const intervalDays = STEP_INTERVALS[nextStep] || 5;
            nextSendAt = new Date(
              Date.now() + intervalDays * 24 * 60 * 60 * 1000,
            )
              .toISOString()
              .replace("T", " ")
              .slice(0, 19);
          }

          dbUpdateDripStep(drip.id, nextStep, nextSendAt);
          result.sent++;
          result.details.push(
            `Sent email ${nextStep} to ${drip.email} (${drip.business_name})`,
          );
        } else {
          result.failed++;
          result.details.push(
            `Failed to send email ${nextStep} to ${drip.email}`,
          );
        }
      } catch (err) {
        result.failed++;
        result.details.push(
          `Error sending email ${nextStep} to ${drip.email}: ${String(err)}`,
        );
      }
    }
  } catch (err) {
    console.error("processPendingDrips error:", err);
  }

  if (result.processed > 0) {
    console.log(
      `Drip processing complete: ${result.sent} sent, ${result.failed} failed out of ${result.processed}`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Send a specific drip email by step number
// ---------------------------------------------------------------------------

async function sendDripEmail(
  drip: { email: string; business_name: string; business_id: string },
  step: number,
): Promise<boolean> {
  const businessName = drip.business_name;
  const businessSlug = getBusiness(drip.business_id)?.slug ?? "";

  switch (step) {
    // Step 1 = Welcome email — handled separately by auth-server-fns
    // (shouldn't be reached from drip processor, but here for completeness)
    case 1:
      console.log(`Skipping welcome email for ${drip.email} (already sent)`);
      return true;

    // Email 2 — "Add more pages to your app"
    case 2: {
      const dashboardPagesUrl = `${BASE_URL}/dashboard/pages`;
      const demoUrl = `${BASE_URL}/app/joes-coffee-shop`;

      const html = addPagesEmailHtml({
        businessName,
        dashboardPagesUrl,
        demoUrl,
      });

      return sendTransactionalEmail(
        drip.email,
        `Build out your Branded app, ${businessName}!`,
        html,
      );
    }

    // Email 3 — "Ready to go live?"
    case 3: {
      const dashboardUrl = `${BASE_URL}/dashboard`;
      const appUrl = `${BASE_URL}/app/${businessSlug}`;
      const pages = getPagesByBusiness(drip.business_id);
      const pageCount = pages.length;

      const html = goLiveEmailHtml({
        businessName,
        dashboardUrl,
        appUrl,
        pageCount,
      });

      return sendTransactionalEmail(
        drip.email,
        `Ready to go live with your Branded app?`,
        html,
      );
    }

    // Email 4 — "Unlock premium features"
    case 4: {
      const settingsSubscriptionUrl = `${BASE_URL}/dashboard/settings?tab=subscription`;

      const html = premiumEmailHtml({
        businessName,
        settingsSubscriptionUrl,
      });

      return sendTransactionalEmail(
        drip.email,
        `Unlock the full power of Branded, ${businessName}`,
        html,
      );
    }

    default:
      console.log(`No email defined for step ${step}`);
      return true;
  }
}
