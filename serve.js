// Production server for the built site.
// Uses Node.js since better-sqlite3 does not work with Bun's runtime.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const HOST = "0.0.0.0";
const CLIENT_DIR = path.resolve(__dirname, "dist/client");
const ASSETS_DIR = path.resolve(__dirname, "dist/server/assets");

// Load .env file manually (Node.js doesn't auto-load .env)
const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

// Ensure DATA_DIR is set for the bundled db module before any imports.
const DATA_DIR_ABSOLUTE = path.resolve(__dirname, "data");
process.env.DATA_DIR = DATA_DIR_ABSOLUTE;
const DB_PATH_ABSOLUTE = path.join(DATA_DIR_ABSOLUTE, "branded.db");
console.log("DB path configured:", DB_PATH_ABSOLUTE, "exists:", fs.existsSync(DB_PATH_ABSOLUTE));

// ---------------------------------------------------------------------------
// Direct DB & Auth (not dynamically imported from bundles — tree-shaken)
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const db = new Database(DB_PATH_ABSOLUTE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function uuidv4() {
  return crypto.randomUUID();
}

function createSession(userId, role) {
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (id, user_id, role, expires_at) VALUES (?, ?, ?, ?)").run(id, userId, role, expiresAt);
  return { id, userId, role, expiresAt };
}

function clearSession(sessionId) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

// ---------------------------------------------------------------------------
// Module lazy-load helpers (built SSR assets have hashed filenames)
// ---------------------------------------------------------------------------

let dbModule = null;
async function getDbModule() {
  if (!dbModule) {
    const files = fs.readdirSync(ASSETS_DIR);
    const match = files.find(f => f.startsWith("db-") && f.endsWith(".js"));
    if (match) dbModule = await import(path.join(ASSETS_DIR, match));
  }
  return dbModule || {};
}

// Dynamically import the SSR handler (default export is the server entry)
let handler = null;
try {
  const mod = await import("./dist/server/server.js");
  handler = mod.default;
} catch (e) {
  console.warn("SSR handler not available (dist not built), API routes only:", e.code);
}

// ---------------------------------------------------------------------------
// Known Branded hostnames (not custom domains)
// ---------------------------------------------------------------------------

const BRANDED_HOSTS = new Set([
  "brandedapp.us",
  "brandedapp.ctonew.app",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

function isBrandedHost(host) {
  const h = host.split(":")[0].toLowerCase();
  return BRANDED_HOSTS.has(h) || h.endsWith(".brandedapp.us") || h.endsWith(".brandedapp.ctonew.app");
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

// ---------------------------------------------------------------------------
// JSON response helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function sendError(res, status, error) {
  sendJson(res, status, { success: false, error });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return {};

  const contentType = req.headers["content-type"] || "";

  // Parse form-encoded data
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    const obj = {};
    for (const [key, value] of params) {
      obj[key] = value;
    }
    return obj;
  }

  // Parse JSON
  try { return JSON.parse(raw); } catch { return {}; }
}

// Keep old function name as alias for backward compat
async function readJsonBody(req) {
  return readBody(req);
}

// (uuidv4 defined above with crypto.randomUUID)

// ---------------------------------------------------------------------------
// Module lazy-load helpers (built SSR assets have hashed filenames)
// ---------------------------------------------------------------------------

const _moduleCache = {};
async function getBuiltModule(prefix) {
  if (!_moduleCache[prefix]) {
    const files = fs.readdirSync(ASSETS_DIR);
    const match = files.find(f => f.startsWith(prefix) && f.endsWith(".js"));
    if (match) _moduleCache[prefix] = await import(path.join(ASSETS_DIR, match));
    else _moduleCache[prefix] = {};
  }
  return _moduleCache[prefix];
}

// ---------------------------------------------------------------------------
// API route handlers
// ---------------------------------------------------------------------------

async function handleRegister(body, res, req) {
  const { name, email, password, businessName, businessSlug } = body;
  const isFormSubmit = req && (req.headers["content-type"] || "").includes("application/x-www-form-urlencoded");

  if (!name || !email || !password || !businessName) {
    if (isFormSubmit) {
      res.writeHead(302, { Location: "/api/auth/register?error=missing_fields" });
      return res.end();
    }
    return sendError(res, 400, "Missing required fields");
  }
  if (password.length < 6) {
    if (isFormSubmit) {
      res.writeHead(302, { Location: "/api/auth/register?error=password_too_short" });
      return res.end();
    }
    return sendError(res, 400, "Password must be at least 6 characters");
  }

  // Check email
  const existingOwner = db.prepare("SELECT id FROM business_owners WHERE email = ?").get(email);
  if (existingOwner) {
    if (isFormSubmit) {
      res.writeHead(302, { Location: "/api/auth/register?error=email_taken" });
      return res.end();
    }
    return sendError(res, 400, "Email already registered");
  }

  // Check slug
  const existingBiz = db.prepare("SELECT id FROM businesses WHERE slug = ?").get(businessSlug);
  if (existingBiz) {
    if (isFormSubmit) {
      res.writeHead(302, { Location: "/api/auth/register?error=slug_taken" });
      return res.end();
    }
    return sendError(res, 400, "Business slug already taken");
  }

  // Create business
  const bizId = uuidv4();
  db.prepare("INSERT INTO businesses (id, name, slug) VALUES (?, ?, ?)").run(bizId, businessName, businessSlug);

  // Create owner
  const ownerId = uuidv4();
  const pwHash = hashPassword(password);
  db.prepare(
    "INSERT INTO business_owners (id, business_id, name, email, password_hash) VALUES (?, ?, ?, ?, ?)"
  ).run(ownerId, bizId, name, email, pwHash);

  // Session
  const session = createSession(ownerId, "business");

  // Form submissions: redirect to onboarding with token in URL
  if (isFormSubmit) {
    res.writeHead(302, {
      Location: `/dashboard/onboarding?token=${session.id}&businessId=${bizId}`,
      "Set-Cookie": `branded_session=${session.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
    });
    return res.end();
  }

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": `branded_session=${session.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
  });
  res.end(JSON.stringify({
    success: true,
    sessionToken: session.id,
    user: { id: ownerId, name, email, role: "business", businessId: bizId, businessName, businessSlug },
  }));
}

async function handleLogin(body, res, req) {
  const { email, password, role, businessSlug } = body;
  const isFormSubmit = req && (req.headers["content-type"] || "").includes("application/x-www-form-urlencoded");

  if (!email || !password) {
    if (isFormSubmit) {
      res.writeHead(302, { Location: "/api/auth/login?error=missing_fields" });
      return res.end();
    }
    return sendError(res, 400, "Missing email or password");
  }
  if (role === "customer" && !businessSlug) return sendError(res, 400, "Business slug required for customer login");

  if (role === "business") {
    const owner = db.prepare("SELECT * FROM business_owners WHERE email = ?").get(email);
    if (!owner || !verifyPassword(password, owner.password_hash)) {
      if (isFormSubmit) {
        res.writeHead(302, { Location: "/api/auth/login?error=invalid_credentials" });
        return res.end();
      }
      return sendError(res, 400, "Invalid email or password");
    }
    const biz = db.prepare("SELECT name, slug FROM businesses WHERE id = ?").get(owner.business_id);
    const session = createSession(owner.id, "business");

    if (isFormSubmit) {
      res.writeHead(302, {
        Location: `/dashboard?token=${session.id}&businessId=${owner.business_id}`,
        "Set-Cookie": `branded_session=${session.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
      });
      return res.end();
    }

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `branded_session=${session.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
    });
    res.end(JSON.stringify({
      success: true,
      sessionToken: session.id,
      user: { id: owner.id, name: owner.name, email: owner.email, role: "business", businessId: owner.business_id, businessName: biz?.name, businessSlug: biz?.slug },
    }));
  } else {
    const biz = db.prepare("SELECT id, name, slug FROM businesses WHERE slug = ?").get(businessSlug);
    if (!biz) return sendError(res, 400, "Business not found");
    const customer = db.prepare("SELECT * FROM customers WHERE email = ? AND business_id = ?").get(email, biz.id);
    if (!customer || !customer.password_hash || !verifyPassword(password, customer.password_hash)) {
      return sendError(res, 400, "Invalid email or password");
    }
    const session = createSession(customer.id, "customer");
    sendJson(res, 200, {
      success: true,
      sessionToken: session.id,
      user: { id: customer.id, name: customer.name, email: customer.email, role: "customer", businessId: biz.id, businessName: biz.name, businessSlug: biz.slug },
    });
  }
}

async function handleLogout(body, res) {
  if (body.sessionToken) {
    clearSession(body.sessionToken);
  }
  sendJson(res, 200, { success: true });
}

async function handleBillingCheckout(body, res, isGetRedirect) {
  // Trial limit check (first 10 only)
  const trialCount = getTrialCount();
  if (trialCount >= MAX_TRIALS) {
    return sendError(res, 403, `Free trials are currently full (${trialCount}/${MAX_TRIALS}). Please try again later.`);
  }

  try {
    const Stripe = await import("stripe").then(m => m.default).catch(() => null);
    if (!Stripe) {
      return sendJson(res, 200, {
        success: false,
        error: "Stripe SDK not installed. Run: npm install stripe",
        checkoutUrl: null,
      });
    }

    const { planId } = body;
    const priceIds = {
      starter: "price_1Tzh1pBnMaZ9CDIb7tDeTgXl",
      pro: "price_1Tzh4IBnMaZ9CDIb5Pe2HDZ1",
      premium: "price_1Tzh54BnMaZ9CDIbqbfXXNLp",
    };
    const priceId = priceIds[planId];
    if (!priceId) return sendError(res, 400, "Invalid plan");

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return sendError(res, 500, "Stripe not configured");

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: body.successUrl || `https://brandedapp.ctonew.app/dashboard?checkout=success`,
      cancel_url: body.cancelUrl || `https://brandedapp.ctonew.app/dashboard?checkout=canceled`,
      subscription_data: { trial_period_days: 7 },
      allow_promotion_codes: true,
      metadata: { businessId: body.businessId || "", planId },
    });

    // Increment trial counter on successful session creation
    incrementTrial();

    if (isGetRedirect) {
      // GET request — redirect directly to Stripe
      res.writeHead(302, { Location: session.url });
      res.end();
      return;
    }

    sendJson(res, 200, {
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    sendError(res, 500, err.message || "Checkout failed");
  }
}

// ---------------------------------------------------------------------------
// Checkout page (GET /checkout) — fully server-rendered, no JS required
// ---------------------------------------------------------------------------

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      cookies[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
  }
  return cookies;
}

function handleCheckoutPage(req, res) {
  const cookies = parseCookies(req);
  const sessionToken = cookies["branded_session"] || "";

  if (!sessionToken) {
    return renderCheckoutNoSession(res);
  }

  // Look up session + business
  const row = db.prepare(
    `SELECT s.id as session_id, s.user_id, s.role, s.expires_at,
            b.id as business_id, b.name as business_name, b.slug, b.subscription_tier
     FROM sessions s
     JOIN businesses b ON b.id = (
       SELECT business_id FROM business_owners WHERE id = s.user_id
     )
     WHERE s.id = ? AND s.expires_at > datetime('now') AND s.role = 'business'`
  ).get(sessionToken);

  if (!row) {
    return renderCheckoutNoSession(res);
  }

  return renderCheckoutPage(res, row);
}

function renderCheckoutNoSession(res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Branded — Choose Your Plan</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #111827; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 32px 16px; text-align: center; }
  .header h1 { font-size: 28px; font-weight: 700; }
  .header p { margin-top: 8px; opacity: 0.9; font-size: 16px; }
  .container { max-width: 480px; margin: 48px auto; padding: 0 16px; text-align: center; }
  .card { background: #fff; border-radius: 16px; padding: 40px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card h2 { font-size: 22px; margin-bottom: 12px; }
  .card p { color: #6b7280; margin-bottom: 24px; line-height: 1.5; }
  .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; }
  .btn:hover { opacity: 0.9; }
</style>
</head>
<body>
<div class="header">
  <h1>🚀 Branded</h1>
  <p>Your Business, In Their Pocket</p>
</div>
<div class="container">
  <div class="card">
    <h2>Get Started</h2>
    <p>Create your free Branded account to choose a plan and launch your business app.</p>
    <a href="/api/auth/register" class="btn">Create Your App →</a>
    <p style="margin-top:16px;font-size:14px;color:#9ca3af;">Already have an account? <a href="/api/auth/login" style="color:#4f46e5;">Sign in</a></p>
  </div>
</div>
</body>
</html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function renderCheckoutPage(res, row) {
  const { business_id, business_name, subscription_tier } = row;

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: "$29",
      period: "/month",
      features: ["5 pages", "Basic branding", "Core page templates"],
      highlighted: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: "$79",
      period: "/month",
      features: ["20 pages", "Messaging & appointments", "All page templates", "Analytics dashboard"],
      highlighted: true,
    },
    {
      id: "premium",
      name: "Premium",
      price: "$199",
      period: "/month",
      features: ["Unlimited pages", "AI assistant", "Custom domain", "Priority support"],
      highlighted: false,
    },
  ];

  const successBase = "https://brandedapp.ctonew.app/dashboard/settings?checkout=success&plan=";
  const cancelUrl = "https://brandedapp.ctonew.app/dashboard/settings?checkout=cancel";

  const currentTier = subscription_tier || "starter";

  const planCards = plans.map((plan) => {
    const isCurrent = currentTier === plan.id;
    const borderColor = plan.highlighted ? "#4f46e5" : isCurrent ? "#a5b4fc" : "#e5e7eb";
    const bg = isCurrent ? "#eef2ff" : "#fff";
    const badge = plan.highlighted
      ? '<span style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap;">Most Popular</span>'
      : "";
    const button = isCurrent
      ? `<button type="button" disabled style="width:100%;padding:12px;border-radius:10px;border:1px solid #d1d5db;background:#f3f4f6;color:#9ca3af;font-size:15px;font-weight:600;cursor:default;">Current Plan</button>`
      : `<form method="POST" action="/api/billing/checkout" style="margin:0;">
           <input type="hidden" name="planId" value="${plan.id}">
           <input type="hidden" name="businessId" value="${business_id}">
           <input type="hidden" name="successUrl" value="${successBase}${plan.id}">
           <input type="hidden" name="cancelUrl" value="${cancelUrl}">
           <button type="submit" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:15px;font-weight:600;cursor:pointer;">${plan.highlighted ? '🎁 Start 7-Day Free Trial' : 'Subscribe — ' + plan.price + plan.period}</button>
         </form>`;

    return `<div style="position:relative;flex:1;min-width:260px;background:${bg};border:2px solid ${borderColor};border-radius:16px;padding:${plan.highlighted ? '28px 20px 20px' : '20px'};text-align:center;">
      ${badge}
      <h3 style="font-size:20px;font-weight:700;margin-bottom:4px;">${plan.name}</h3>
      <div style="margin:12px 0;">
        <span style="font-size:36px;font-weight:800;">${plan.price}</span>
        <span style="color:#6b7280;">${plan.period}</span>
      </div>
      <ul style="list-style:none;text-align:left;margin:16px 0;">
        ${plan.features.map((f) => `<li style="padding:6px 0;font-size:14px;color:#4b5563;">✓ ${f}</li>`).join("")}
      </ul>
      ${button}
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Branded — Choose Your Plan</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #111827; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 32px 16px; text-align: center; }
  .header h1 { font-size: 28px; font-weight: 700; }
  .header p { margin-top: 8px; opacity: 0.9; font-size: 16px; }
  .container { max-width: 900px; margin: 0 auto; padding: 40px 16px; }
  .greeting { text-align: center; margin-bottom: 32px; }
  .greeting h2 { font-size: 24px; font-weight: 700; }
  .greeting p { color: #6b7280; margin-top: 4px; }
  .plans { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; align-items: flex-start; }
  a { color: #4f46e5; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="header">
  <h1>🚀 Branded</h1>
  <p>Your Business, In Their Pocket</p>
</div>
<div class="container">
  <div class="greeting">
    <h2>Choose Your Plan</h2>
    <p>Hi ${escapeHtml(business_name || "there")}! Pick the plan that fits your business.</p>
  </div>
  <div class="plans">
    ${planCards}
  </div>
  <p style="text-align:center;margin-top:32px;font-size:13px;color:#9ca3af;">
    All plans include a 7-day free trial. Cancel anytime.
  </p>
</div>
</body>
</html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Stripe webhook handler
// ---------------------------------------------------------------------------

async function handleStripeWebhook(rawBody, stripeSignature, res) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    console.error("Webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return sendError(res, 500, "Webhook not configured");
  }

  try {
    const Stripe = await import("stripe").then(m => m.default);
    const stripe = new Stripe(stripeKey);

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return sendError(res, 400, `Webhook error: ${err.message}`);
    }

    // Handle successful checkout
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const businessId = session.metadata?.businessId;
      const planId = session.metadata?.planId;

      if (businessId && planId) {
        const tier = planId; // starter, pro, premium
        db.prepare(
          "UPDATE businesses SET subscription_tier = ?, subscription_status = 'active', updated_at = datetime('now') WHERE id = ?"
        ).run(tier, businessId);
        console.log(`Webhook: upgraded business ${businessId} to ${tier}`);
      } else {
        console.log("Webhook: no businessId/planId in session metadata, skipping DB update");
      }
    }

    // Handle subscription deleted / trial ended
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      // Find business by Stripe customer/subscription — we'd need a lookup table
      // For now, we log it; a full implementation would store stripeCustomerId in businesses
      console.log(`Webhook: subscription ${subscription.id} deleted`);
    }

    sendJson(res, 200, { received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    sendError(res, 500, err.message || "Webhook failed");
  }
}

// ---------------------------------------------------------------------------
// Dashboard API handlers
// ---------------------------------------------------------------------------

function requireAuth(body) {
  const sessionToken = body.sessionToken;
  if (!sessionToken) return { authorized: false, error: "Missing session token" };
  const row = db.prepare(
    "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(sessionToken);
  if (!row) return { authorized: false, error: "Invalid or expired session" };
  if (row.role !== "business") return { authorized: false, error: "Access denied" };
  return { authorized: true, userId: row.user_id, role: row.role };
}

async function handleLoadBusiness(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
  if (!biz) return sendError(res, 404, "Business not found");

  sendJson(res, 200, { error: null, business: biz });
}

async function handleSaveBusiness(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId, name, slug, logoUrl, primaryColor, secondaryColor } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  // Fetch existing values to fill in any missing fields
  const existing = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
  if (!existing) return sendError(res, 404, "Business not found");

  db.prepare(
    `UPDATE businesses SET name = ?, slug = ?, logo_url = ?, primary_color = ?, secondary_color = ? WHERE id = ?`
  ).run(
    name || existing.name,
    slug || existing.slug,
    logoUrl !== undefined ? logoUrl : existing.logo_url,
    primaryColor || existing.primary_color,
    secondaryColor || existing.secondary_color,
    businessId
  );

  sendJson(res, 200, { error: null });
}

async function handleToggleAi(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId, enabled } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
  if (!biz) return sendError(res, 404, "Business not found");
  if (biz.subscription_tier !== "premium") {
    return sendError(res, 403, "AI Assistant is a Premium feature");
  }

  db.prepare(
    "UPDATE businesses SET ai_assistant_enabled = ? WHERE id = ?"
  ).run(enabled ? 1 : 0, businessId);

  sendJson(res, 200, { error: null });
}

async function handleLoadWizard(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const biz = db.prepare(
    "SELECT id, name, slug, logo_url, primary_color, secondary_color FROM businesses WHERE id = ?"
  ).get(businessId);
  if (!biz) return sendError(res, 404, "Business not found");

  const pages = db.prepare(
    "SELECT page_type FROM pages WHERE business_id = ?"
  ).all(businessId);

  sendJson(res, 200, {
    business: {
      id: biz.id,
      name: biz.name,
      slug: biz.slug,
      logo_url: biz.logo_url,
      primary_color: biz.primary_color,
      secondary_color: biz.secondary_color,
    },
    pages: pages.map((p) => p.page_type),
  });
}

async function handleUpdateBranding(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId, logo_url, primary_color, secondary_color } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const updates = [];
  const values = [];

  if (logo_url !== undefined) {
    updates.push("logo_url = ?");
    values.push(logo_url);
  }
  if (primary_color) {
    updates.push("primary_color = ?");
    values.push(primary_color);
  }
  if (secondary_color) {
    updates.push("secondary_color = ?");
    values.push(secondary_color);
  }

  if (updates.length === 0) return sendError(res, 400, "No fields to update");

  values.push(businessId);
  db.prepare(
    `UPDATE businesses SET ${updates.join(", ")} WHERE id = ?`
  ).run(...values);

  sendJson(res, 200, { error: null });
}

async function handleCreateBioPage(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId, businessName } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const existing = db.prepare(
    "SELECT * FROM pages WHERE business_id = ? AND page_type = ?"
  ).get(businessId, "bio");

  if (existing) {
    const allPages = db.prepare(
      "SELECT * FROM pages WHERE business_id = ?"
    ).all(businessId);
    return sendJson(res, 200, { alreadyExists: true, page: existing, pages: allPages });
  }

  const allPages = db.prepare(
    "SELECT * FROM pages WHERE business_id = ?"
  ).all(businessId);
  const sortOrder = allPages.length;

  const id = crypto.randomUUID();
  const contentJson = JSON.stringify({
    headline: `Welcome to ${businessName || "Our Business"}`,
    aboutText: `We're excited to serve you. Learn more about ${businessName || "us"} here.`,
    mission: "",
  });

  db.prepare(
    "INSERT INTO pages (id, business_id, page_type, title, content_json, is_published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, businessId, "bio", "About Us", contentJson, 0, sortOrder);

  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(id);
  const updatedPages = db.prepare(
    "SELECT * FROM pages WHERE business_id = ?"
  ).all(businessId);

  sendJson(res, 200, { alreadyExists: false, page, pages: updatedPages });
}

// ---------------------------------------------------------------------------
// Analytics API handler
// ---------------------------------------------------------------------------

async function handleAnalytics(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId, period } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().split("T")[0];

  // Try analytics queries; return stub data if tables don't exist
  let totalPageViews = 0, uniqueVisitors = 0, signups = 0;
  const pageViewsByDay = [];
  const topPages = [];

  try {
    const pageRow = db.prepare(
      "SELECT COUNT(*) as count FROM analytics_events WHERE business_id = ? AND event_type = ? AND created_at >= ? AND created_at <= ?"
    ).get(businessId, "page_view", startDate, endDate);
    if (pageRow) totalPageViews = pageRow.count;

    const visitorRow = db.prepare(
      "SELECT COUNT(DISTINCT visitor_id) as count FROM analytics_events WHERE business_id = ? AND created_at >= ? AND created_at <= ?"
    ).get(businessId, startDate, endDate);
    if (visitorRow) uniqueVisitors = visitorRow.count;

    const signupRow = db.prepare(
      "SELECT COUNT(*) as count FROM analytics_events WHERE business_id = ? AND event_type = ? AND created_at >= ? AND created_at <= ?"
    ).get(businessId, "signup", startDate, endDate);
    if (signupRow) signups = signupRow.count;
  } catch {
    // Tables don't exist yet — return zeros
  }

  const totalPagesRow = db.prepare(
    "SELECT COUNT(*) as count FROM pages WHERE business_id = ?"
  ).get(businessId);

  sendJson(res, 200, {
    totalPageViews,
    uniqueVisitors,
    signups,
    avgPagesPerApp: totalPagesRow ? totalPagesRow.count : 0,
    pageViewsByDay,
    topPages,
  });
}

// ---------------------------------------------------------------------------
// Dashboard data API handler
// ---------------------------------------------------------------------------

async function handleLoadDashboard(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const biz = db.prepare(
    "SELECT name, slug, logo_url, primary_color, secondary_color FROM businesses WHERE id = ?"
  ).get(businessId);
  if (!biz) return sendError(res, 404, "Business not found");

  const pages = db.prepare(
    "SELECT id, title, page_type, is_published, updated_at FROM pages WHERE business_id = ? ORDER BY sort_order ASC"
  ).all(businessId);

  sendJson(res, 200, {
    business: {
      name: biz.name,
      slug: biz.slug,
      logo_url: biz.logo_url,
      primary_color: biz.primary_color,
      secondary_color: biz.secondary_color,
    },
    pages: pages.map((p) => ({
      id: p.id,
      title: p.title,
      pageType: p.page_type,
      status: p.is_published ? "published" : "draft",
      updated: p.updated_at,
    })),
  });
}

// ---------------------------------------------------------------------------
// Pages API handlers (list, toggle, create, delete, reorder)
// ---------------------------------------------------------------------------

async function handlePagesList(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const pages = db.prepare(
    "SELECT * FROM pages WHERE business_id = ? ORDER BY sort_order ASC"
  ).all(businessId);

  sendJson(res, 200, { error: null, pages });
}

async function handlePagesToggle(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { pageId, businessId, published } = body;
  if (!pageId) return sendError(res, 400, "Missing pageId");
  if (!businessId) return sendError(res, 400, "Missing businessId");

  db.prepare(
    "UPDATE pages SET is_published = ? WHERE id = ? AND business_id = ?"
  ).run(published ? 1 : 0, pageId, businessId);

  sendJson(res, 200, { error: null });
}

async function handlePagesCreate(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId, pageType, title } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");
  if (!pageType) return sendError(res, 400, "Missing pageType");
  if (!title) return sendError(res, 400, "Missing title");

  const existing = db.prepare(
    "SELECT COUNT(*) as count FROM pages WHERE business_id = ?"
  ).get(businessId);
  const sortOrder = existing ? existing.count : 0;

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO pages (id, business_id, page_type, title, content_json, is_published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, businessId, pageType, title, "{}", 0, sortOrder);

  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(id);
  sendJson(res, 200, { error: null, page });
}

async function handlePagesDelete(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { pageId, businessId } = body;
  if (!pageId) return sendError(res, 400, "Missing pageId");
  if (!businessId) return sendError(res, 400, "Missing businessId");

  db.prepare("DELETE FROM pages WHERE id = ? AND business_id = ?").run(pageId, businessId);
  sendJson(res, 200, { error: null });
}

async function handlePagesReorder(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId, pageIds } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");
  if (!Array.isArray(pageIds)) return sendError(res, 400, "Missing pageIds array");

  const stmt = db.prepare("UPDATE pages SET sort_order = ? WHERE id = ? AND business_id = ?");
  pageIds.forEach((id, index) => {
    stmt.run(index, id, businessId);
  });

  sendJson(res, 200, { success: true });
}

async function handlePagesGet(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { pageId, businessId } = body;
  if (!pageId) return sendError(res, 400, "Missing pageId");
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId);
  if (!page || page.business_id !== businessId) {
    return sendJson(res, 200, { error: "Page not found", page: null });
  }

  sendJson(res, 200, { error: null, page });
}

async function handlePagesSave(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { pageId, businessId, title, contentJson, isPublished } = body;
  if (!pageId) return sendError(res, 400, "Missing pageId");
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId);
  if (!page || page.business_id !== businessId) {
    return sendError(res, 404, "Page not found");
  }

  db.prepare(
    "UPDATE pages SET title = ?, content_json = ?, is_published = ? WHERE id = ?"
  ).run(
    title ?? page.title,
    contentJson ? JSON.stringify(contentJson) : page.content_json,
    isPublished !== undefined ? (isPublished ? 1 : 0) : page.is_published,
    pageId
  );

  const updated = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId);
  sendJson(res, 200, { error: null, page: updated });
}

// ---------------------------------------------------------------------------
// Domain API handlers
// ---------------------------------------------------------------------------

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z]$/i;

function isValidDomain(domain) {
  if (!DOMAIN_REGEX.test(domain)) return false;
  if (domain.length > 253) return false;
  const lower = domain.toLowerCase();
  if (lower === "brandedapp.us" || lower === "brandedapp.ctonew.app" || lower.endsWith(".brandedapp.us") || lower.endsWith(".brandedapp.ctonew.app")) {
    return false;
  }
  return true;
}

async function dnsLookupTxt(name) {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.Answer) return [];
    return data.Answer.map((a) => {
      const d = a.data;
      if (d.startsWith('"') && d.endsWith('"')) return d.slice(1, -1);
      return d;
    });
  } catch {
    return [];
  }
}

async function handleSetDomain(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId, domain } = body;
  if (!domain || typeof domain !== "string") return sendError(res, 400, "Domain is required");
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
  if (!biz) return sendError(res, 404, "Business not found");
  if (biz.subscription_tier !== "premium") {
    return sendError(res, 403, "Custom domains require a Premium subscription");
  }

  const domainStr = domain.trim().toLowerCase();
  if (!isValidDomain(domainStr)) {
    return sendError(res, 400, "Invalid domain format. Use a fully-qualified domain like app.example.com");
  }

  const existing = db.prepare(
    "SELECT id FROM businesses WHERE custom_domain = ? AND id != ? AND custom_domain_verified = 1"
  ).get(domainStr, businessId);
  if (existing) return sendError(res, 409, "This domain is already in use");

  const token = `branded-verify-${crypto.randomUUID()}`;
  db.prepare(
    "UPDATE businesses SET custom_domain = ?, custom_domain_verified = 0, custom_domain_verification_token = ? WHERE id = ?"
  ).run(domainStr, token, businessId);

  sendJson(res, 200, { success: true, domain: domainStr, verificationToken: token });
}

async function handleVerifyDomain(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
  if (!biz) return sendError(res, 404, "Business not found");
  if (!biz.custom_domain) return sendError(res, 400, "No custom domain configured");

  const verificationName = `_branded.${biz.custom_domain}`;
  const expectedToken = biz.custom_domain_verification_token;
  if (!expectedToken) return sendError(res, 400, "No verification token. Save your domain again.");

  const records = await dnsLookupTxt(verificationName);
  const found = records.some((r) => r === expectedToken);

  if (found) {
    db.prepare("UPDATE businesses SET custom_domain_verified = 1 WHERE id = ?").run(businessId);
    return sendJson(res, 200, { success: true, verified: true });
  }

  sendJson(res, 200, {
    success: true, verified: false,
    message: `Add a TXT record for "${verificationName}" with value "${expectedToken}"`,
  });
}

async function handleGetDomainStatus(body, res) {
  const auth = requireAuth(body);
  if (!auth.authorized) return sendError(res, 401, auth.error);

  const { businessId } = body;
  if (!businessId) return sendError(res, 400, "Missing businessId");

  const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
  if (!biz) return sendError(res, 404, "Business not found");

  sendJson(res, 200, {
    domain: biz.custom_domain || null,
    verified: biz.custom_domain_verified === 1,
    verificationToken: biz.custom_domain_verification_token || null,
  });
}

// ---------------------------------------------------------------------------
// Trial counter (limit first 10 businesses to free trials)
// ---------------------------------------------------------------------------

const MAX_TRIALS = 10;

function getTrialCount() {
  try {
    const row = db.prepare("SELECT COALESCE(MAX(count_id), 0) as cnt FROM trial_counter").get();
    return row ? row.cnt : 0;
  } catch {
    return 0; // table doesn't exist yet
  }
}

function incrementTrial() {
  try {
    db.prepare("INSERT INTO trial_counter DEFAULT VALUES").run();
  } catch {
    // table doesn't exist, ignore
  }
}

// ---------------------------------------------------------------------------
// Free port using lsof
// ---------------------------------------------------------------------------

import { execSync } from "node:child_process";
try {
  const pids = execSync(
    `lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true`,
    { encoding: "utf8" }
  ).trim();
  if (pids) {
    for (const pid of pids.split("\n").filter(Boolean)) {
      try { process.kill(parseInt(pid), "SIGTERM"); } catch { /* ok */ }
    }
  }
} catch { /* no server to free */ }

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const rawHost = req.headers.host || "localhost";
    const host = rawHost.split(":")[0].toLowerCase();
    const url = new URL(req.url || "/", `http://${rawHost}`);
    let pathname = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    // ── Checkout page (no JS required) ─────────────────────────────

    if (req.method === "GET" && pathname === "/checkout") {
      return handleCheckoutPage(req, res);
    }

    // ── Custom domain routing ──────────────────────────────────────

    if (!isBrandedHost(rawHost)) {
      try {
        const dm = await getDbModule();
        let business = null;
        if (typeof dm.getBusinessByDomain === "function") {
          business = dm.getBusinessByDomain(host);
        } else if (typeof dm.getDb === "function") {
          const db = dm.getDb();
          business = db.prepare(
            "SELECT * FROM businesses WHERE custom_domain = ? AND custom_domain_verified = 1"
          ).get(host);
        }
        if (business && business.slug) {
          pathname = pathname === "/" || pathname === "" ? `/app/${business.slug}` : `/app/${business.slug}${pathname}`;
          url.pathname = pathname;
        }
      } catch (err) {
        // custom_domain column may not exist — silently ignore
      }
    }

    // ── Static files ───────────────────────────────────────────────

    if (pathname !== "/") {
      const filePath = path.join(CLIENT_DIR, pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const content = fs.readFileSync(filePath);
        const mime = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime });
        res.end(content);
        return;
      }
    }

    // ── API routes ─────────────────────────────────────────────────

    // GET /api/billing/checkout — redirect-based checkout (works without JS)
    if (req.method === "GET" && pathname === "/api/billing/checkout") {
      const params = url.searchParams;
      const planId = params.get("planId") || "";
      const businessId = params.get("businessId") || "";
      const successUrl = params.get("successUrl") || "";
      const cancelUrl = params.get("cancelUrl") || "";
      if (planId) {
        const body = { planId, businessId, successUrl, cancelUrl };
        return handleBillingCheckout(body, res, true);
      }
      return sendError(res, 400, "Missing planId parameter");
    }

    // Stripe webhook needs raw body for signature verification
    if (req.method === "POST" && pathname === "/api/webhooks/stripe") {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const rawBody = Buffer.concat(chunks).toString("utf-8");
      const sig = req.headers["stripe-signature"] || "";
      return handleStripeWebhook(rawBody, sig, res);
    }

    // Billing checkout — handle form-encoded (redirect) and JSON (API response)
    if (req.method === "POST" && pathname === "/api/billing/checkout") {
      const body = await readBody(req);
      const ct = (req.headers["content-type"] || "").toLowerCase();
      return handleBillingCheckout(body, res, ct.includes("application/x-www-form-urlencoded"));
    }

    if (req.method === "POST" && pathname.startsWith("/api/")) {
      const body = await readJsonBody(req);

      if (pathname === "/api/auth/register") return handleRegister(body, res, req);
      if (pathname === "/api/auth/login") return handleLogin(body, res, req);
      if (pathname === "/api/auth/logout") return handleLogout(body, res);
      if (pathname === "/api/dashboard/load-business") return handleLoadBusiness(body, res);
      if (pathname === "/api/dashboard/save-business") return handleSaveBusiness(body, res);
      if (pathname === "/api/dashboard/toggle-ai") return handleToggleAi(body, res);
      if (pathname === "/api/dashboard/load-wizard") return handleLoadWizard(body, res);
      if (pathname === "/api/dashboard/update-branding") return handleUpdateBranding(body, res);
      if (pathname === "/api/dashboard/create-bio-page") return handleCreateBioPage(body, res);
      if (pathname === "/api/dashboard/analytics") return handleAnalytics(body, res);
      if (pathname === "/api/dashboard/load-dashboard") return handleLoadDashboard(body, res);
      if (pathname === "/api/dashboard/pages/list") return handlePagesList(body, res);
      if (pathname === "/api/dashboard/pages/toggle") return handlePagesToggle(body, res);
      if (pathname === "/api/dashboard/pages/create") return handlePagesCreate(body, res);
      if (pathname === "/api/dashboard/pages/delete") return handlePagesDelete(body, res);
      if (pathname === "/api/dashboard/pages/reorder") return handlePagesReorder(body, res);
      if (pathname === "/api/dashboard/pages/get") return handlePagesGet(body, res);
      if (pathname === "/api/dashboard/pages/save") return handlePagesSave(body, res);
      if (pathname === "/api/domains/set") return handleSetDomain(body, res);
      if (pathname === "/api/domains/verify") return handleVerifyDomain(body, res);
      if (pathname === "/api/domains/status") return handleGetDomainStatus(body, res);
    }

    // Also handle GET for load-business (query params)
    if (req.method === "GET" && pathname === "/api/dashboard/load-business") {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const sessionToken = url.searchParams.get("sessionToken") || "";
      const businessId = url.searchParams.get("businessId") || "";
      return handleLoadBusiness({ sessionToken, businessId }, res);
    }

    // ── SSR via handler ────────────────────────────────────────────

    if (!handler) {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("API server running — frontend not built. Run: bun run build && bun run publish");
      return;
    }

    const protocol = "http";
    const requestHost = req.headers.host || "localhost";
    const requestUrl = `${protocol}://${requestHost}${url.pathname}${url.search}`;

    let ssrBody = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      ssrBody = await new Promise((resolve) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => resolve(Buffer.concat(chunks)));
      });
    }

    const request = new Request(requestUrl, {
      method: req.method,
      headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v || ""])),
      body: ssrBody,
    });

    const response = await handler.fetch(request);

    const responseHeaders = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });
    res.writeHead(response.status, responseHeaders);

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
        }
      };
      pump().catch(() => res.end());
    } else {
      res.end();
    }
  } catch (err) {
    console.error("Request error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`team-site serving on http://${HOST}:${PORT}`);
});
