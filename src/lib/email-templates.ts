/**
 * Email template helpers for Branded transactional emails.
 *
 * Generates clean, responsive HTML emails with Branded's indigo/violet
 * brand colors. All templates include plain text fallbacks.
 */

// ---------------------------------------------------------------------------
// Brand identity
// ---------------------------------------------------------------------------

const BRAND = {
  name: "Branded",
  primaryColor: "#4f46e5",
  secondaryColor: "#7c3aed",
  textColor: "#1f2937",
  lightBg: "#f9fafb",
  white: "#ffffff",
};

const LOGO_URL = "https://brandedapp.us/logo.svg";

// (kept for future use in header — suppresses TS unused warning)
void LOGO_URL;

const UNSUBSCRIBE_URL = "https://branded.app/unsubscribe";

// ---------------------------------------------------------------------------
// Layout wrapper
// ---------------------------------------------------------------------------

function emailLayout(body: string, preview?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${preview ? `<meta name="description" content="${escapeHtml(preview)}">` : ""}
  <title>Branded</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.lightBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.lightBg};padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:${BRAND.white};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.primaryColor},${BRAND.secondaryColor});padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:${BRAND.white};font-size:24px;font-weight:700;">${BRAND.name}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your business, in their pocket.</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:${BRAND.lightBg};text-align:center;">
              <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;">
                You received this email because you have a Branded account.
              </p>
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                <a href="${UNSUBSCRIBE_URL}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a> &middot;
                &copy; ${new Date().getFullYear()} Branded. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Welcome email
// ---------------------------------------------------------------------------

export interface WelcomeEmailData {
  businessName: string;
  dashboardUrl: string;
  demoUrl: string;
}

export function welcomeEmailHtml(data: WelcomeEmailData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${BRAND.textColor};font-size:20px;">Welcome to Branded, ${escapeHtml(data.businessName)}! 🎉</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Your branded mobile app is ready to go. We're thrilled to have you on board!
    </p>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:${BRAND.primaryColor};border-radius:8px;text-align:center;">
          <a href="${data.dashboardUrl}" style="display:inline-block;padding:14px 32px;color:${BRAND.white};font-size:15px;font-weight:600;text-decoration:none;">
            Go to Your Dashboard →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.6;">
      Your <strong>onboarding wizard</strong> will guide you step by step:
    </p>
    <ul style="margin:0 0 24px;padding:0 0 0 20px;color:#6b7280;font-size:14px;line-height:1.8;">
      <li>Customize your app with your logo, colors, and business info</li>
      <li>Add pages like Bio, Hours, Team, Pricing, and more</li>
      <li>Publish your app and share it with customers</li>
      <li>Manage appointments, messages, and payments</li>
    </ul>

    <!-- Demo link -->
    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
      Need inspiration? Check out our <a href="${data.demoUrl}" style="color:${BRAND.primaryColor};text-decoration:underline;">Joe's Coffee Shop demo app</a> to see what a finished Branded app looks like.
    </p>
  `;
  return emailLayout(body, `Welcome to Branded, ${data.businessName}!`);
}

export function welcomeEmailText(data: WelcomeEmailData): string {
  return `Welcome to Branded, ${data.businessName}!

Your branded mobile app is ready to go. We're thrilled to have you on board!

From your dashboard you can:
• Customize your app with your logo, colors, and business info
• Add pages like Bio, Hours, Team, Pricing, and more
• Publish your app and share it with customers
• Manage appointments, messages, and payments

Go to your dashboard: ${data.dashboardUrl}

Need inspiration? Check out our demo app: ${data.demoUrl}

You received this email because you have a Branded account.
Unsubscribe: ${UNSUBSCRIBE_URL}`;
}

// ---------------------------------------------------------------------------
// Password reset email
// ---------------------------------------------------------------------------

export interface PasswordResetEmailData {
  businessName: string;
  resetUrl: string;
  expiresIn: string;
}

export function passwordResetEmailHtml(data: PasswordResetEmailData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${BRAND.textColor};font-size:20px;">Reset Your Password</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      We received a request to reset the password for your Branded account. Click the button below to create a new password.
    </p>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:${BRAND.primaryColor};border-radius:8px;text-align:center;">
          <a href="${data.resetUrl}" style="display:inline-block;padding:14px 32px;color:${BRAND.white};font-size:15px;font-weight:600;text-decoration:none;">
            Reset Password →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.6;">
      This link will expire in ${data.expiresIn}. If you didn't request a password reset, you can safely ignore this email.
    </p>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
      Having trouble? Copy and paste this link into your browser:<br>
      <span style="color:${BRAND.primaryColor};word-break:break-all;">${data.resetUrl}</span>
    </p>
  `;
  return emailLayout(body, "Reset your Branded password");
}

export function passwordResetEmailText(data: PasswordResetEmailData): string {
  return `Reset Your Password

We received a request to reset the password for your Branded account.

Reset your password here: ${data.resetUrl}

This link will expire in ${data.expiresIn}. If you didn't request a password reset, you can safely ignore this email.

You received this email because you have a Branded account.
Unsubscribe: ${UNSUBSCRIBE_URL}`;
}

// ---------------------------------------------------------------------------
// Email 2 — "Add more pages to your app" (2 days after signup)
// ---------------------------------------------------------------------------

export interface AddPagesEmailData {
  businessName: string;
  dashboardPagesUrl: string;
  demoUrl: string;
}

export function addPagesEmailHtml(data: AddPagesEmailData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${BRAND.textColor};font-size:20px;">Build out your app, ${escapeHtml(data.businessName)}!</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Your Branded app is off to a great start — now let's make it shine. The more pages you add, the more useful your app will be for your customers.
    </p>

    <h3 style="margin:0 0 12px;color:${BRAND.textColor};font-size:16px;">Popular page types our users love:</h3>
    <ul style="margin:0 0 24px;padding:0 0 0 20px;color:#6b7280;font-size:14px;line-height:1.8;">
      <li><strong>Pricing</strong> — Show your rates clearly so customers know what to expect</li>
      <li><strong>Appointments</strong> — Let customers book directly from the app</li>
      <li><strong>Gallery</strong> — Showcase your work, products, or space</li>
      <li><strong>Team</strong> — Introduce your staff with photos and bios</li>
      <li><strong>Messaging</strong> — Chat with customers in real time</li>
    </ul>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:${BRAND.primaryColor};border-radius:8px;text-align:center;">
          <a href="${data.dashboardPagesUrl}" style="display:inline-block;padding:14px 32px;color:${BRAND.white};font-size:15px;font-weight:600;text-decoration:none;">
            Add Pages to Your App →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.6;">
      <strong>💡 Pro tip:</strong> Upgrading to the <strong>Pro</strong> tier unlocks unlimited pages, appointments, messaging, and more — just $79/month.
    </p>
    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
      See what a full-featured app looks like: <a href="${data.demoUrl}" style="color:${BRAND.primaryColor};text-decoration:underline;">Joe's Coffee Shop demo</a>.
    </p>
  `;
  return emailLayout(body, `Build out your Branded app, ${data.businessName}!`);
}

export function addPagesEmailText(data: AddPagesEmailData): string {
  return `Build out your app, ${data.businessName}!

Your Branded app is off to a great start — now let's make it shine. The more pages you add, the more useful your app will be for your customers.

Popular page types our users love:
• Pricing — Show your rates clearly
• Appointments — Let customers book directly
• Gallery — Showcase your work, products, or space
• Team — Introduce your staff with photos and bios
• Messaging — Chat with customers in real time

Add pages now: ${data.dashboardPagesUrl}

💡 Pro tip: Upgrading to the Pro tier unlocks unlimited pages, appointments, messaging, and more — just $79/month.

See what a full-featured app looks like: ${data.demoUrl}

You received this email because you have a Branded account.
Unsubscribe: ${UNSUBSCRIBE_URL}`;
}

// ---------------------------------------------------------------------------
// Email 3 — "Ready to go live?" (5 days after signup)
// ---------------------------------------------------------------------------

export interface GoLiveEmailData {
  businessName: string;
  dashboardUrl: string;
  appUrl: string;
  pageCount: number;
}

export function goLiveEmailHtml(data: GoLiveEmailData): string {
  const pageStats = data.pageCount > 0
    ? `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6;">
         You've created <strong>${data.pageCount} page${data.pageCount === 1 ? "" : "s"}</strong> so far — great progress!
       </p>`
    : `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6;">
         You haven't added any pages yet — no worries, it only takes a few minutes!
       </p>`;

  const body = `
    <h2 style="margin:0 0 8px;color:${BRAND.textColor};font-size:20px;">Ready to go live, ${escapeHtml(data.businessName)}?</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Your branded app is waiting for its debut! Once you publish, your customers can access it instantly — no app store required, just share a link.
    </p>

    ${pageStats}

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:${BRAND.primaryColor};border-radius:8px;text-align:center;">
          <a href="${data.dashboardUrl}" style="display:inline-block;padding:14px 32px;color:${BRAND.white};font-size:15px;font-weight:600;text-decoration:none;">
            Finish & Publish Your App →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6;">
      Your app will be live at: <a href="${data.appUrl}" style="color:${BRAND.primaryColor};text-decoration:underline;">${data.appUrl}</a>
    </p>

    <!-- Testimonial -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:0;background-color:${BRAND.lightBg};border-radius:8px;padding:20px;">
      <tr>
        <td>
          <p style="margin:0 0 8px;color:${BRAND.textColor};font-size:14px;line-height:1.6;font-style:italic;">
            "Branded made it so easy — I had my salon app live in under an hour. My clients love booking appointments right from their phone."
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            — Sarah Kim, The Glow Studio
          </p>
        </td>
      </tr>
    </table>
  `;
  return emailLayout(body, `Your Branded app is ready to go live, ${data.businessName}!`);
}

export function goLiveEmailText(data: GoLiveEmailData): string {
  const pageStats = data.pageCount > 0
    ? `You've created ${data.pageCount} page${data.pageCount === 1 ? "" : "s"} so far — great progress!`
    : "You haven't added any pages yet — no worries, it only takes a few minutes!";

  return `Ready to go live, ${data.businessName}?

Your branded app is waiting for its debut! Once you publish, your customers can access it instantly — no app store required, just share a link.

${pageStats}

Finish & publish your app: ${data.dashboardUrl}
Your app will be live at: ${data.appUrl}

"Branded made it so easy — I had my salon app live in under an hour. My clients love booking appointments right from their phone."
— Sarah Kim, The Glow Studio

You received this email because you have a Branded account.
Unsubscribe: ${UNSUBSCRIBE_URL}`;
}

// ---------------------------------------------------------------------------
// Email 4 — "Unlock premium features" (10 days after signup)
// ---------------------------------------------------------------------------

export interface PremiumEmailData {
  businessName: string;
  settingsSubscriptionUrl: string;
}

export function premiumEmailHtml(data: PremiumEmailData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${BRAND.textColor};font-size:20px;">Unlock the full power of Branded, ${escapeHtml(data.businessName)}</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      You've had a chance to explore Branded — now see what you can do with our premium features. Thousands of businesses already upgraded to grow faster.
    </p>

    <h3 style="margin:0 0 12px;color:${BRAND.textColor};font-size:16px;">Pro & Premium include:</h3>
    <ul style="margin:0 0 24px;padding:0 0 0 20px;color:#6b7280;font-size:14px;line-height:1.8;">
      <li><strong>Unlimited pages</strong> — Build as many as you need</li>
      <li><strong>AI Assistant</strong> — Auto-reply to customer messages 24/7</li>
      <li><strong>Appointments</strong> — Full booking with reminders</li>
      <li><strong>Custom domain</strong> — Your own branded URL</li>
      <li><strong>Priority support</strong> — Skip the queue</li>
    </ul>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:${BRAND.secondaryColor};border-radius:8px;text-align:center;">
          <a href="${data.settingsSubscriptionUrl}" style="display:inline-block;padding:14px 32px;color:${BRAND.white};font-size:15px;font-weight:600;text-decoration:none;">
            Upgrade Your Plan →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
      Plans start at $79/month for Pro or $199/month for Premium. You can upgrade anytime from your dashboard — and if you have questions, just reply to this email.
    </p>
  `;
  return emailLayout(body, `Unlock premium features for ${data.businessName}`);
}

export function premiumEmailText(data: PremiumEmailData): string {
  return `Unlock the full power of Branded, ${data.businessName}

You've had a chance to explore Branded — now see what you can do with our premium features.

Pro & Premium include:
• Unlimited pages — Build as many as you need
• AI Assistant — Auto-reply to customer messages 24/7
• Appointments — Full booking with reminders
• Custom domain — Your own branded URL
• Priority support — Skip the queue

Upgrade your plan: ${data.settingsSubscriptionUrl}

Plans start at $79/month for Pro or $199/month for Premium. You can upgrade anytime from your dashboard.

You received this email because you have a Branded account.
Unsubscribe: ${UNSUBSCRIBE_URL}`;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}