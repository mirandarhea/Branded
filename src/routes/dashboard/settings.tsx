/**
 * Dashboard — Settings
 *
 * Business profile, branding, and subscription info.
 * Allows editing business name, slug, description, logo, and colors.
 */
import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { TextEditor, ColorPicker, ImageUploader } from "~/lib/page-editor";
import { BillingManager } from "~/lib/billing-ui";
import { Toggle } from "~/lib/design/components";

// ---------------------------------------------------------------------------
// Types (local — replaced createServerFn + db imports)
// ---------------------------------------------------------------------------

interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  ai_assistant_enabled: number;
  subscription_tier: string;
  custom_domain: string | null;
  custom_domain_verified: number;
  custom_domain_verification_token: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// API helpers (replaces createServerFn — uses direct fetch to serve.js routes)
// ---------------------------------------------------------------------------

async function loadBusinessApi(sessionToken: string, businessId: string) {
  const res = await fetch('/api/dashboard/load-business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, businessId }),
  });
  return res.json();
}

async function saveBusinessApi(data: {
  sessionToken: string; businessId: string; name: string; slug: string;
  logoUrl: string | null; primaryColor: string; secondaryColor: string;
}) {
  const res = await fetch('/api/dashboard/save-business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function toggleAiApi(sessionToken: string, businessId: string, enabled: boolean) {
  const res = await fetch('/api/dashboard/toggle-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, businessId, enabled }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
  pendingComponent: () => (
    <div className="flex items-center justify-center py-20">
      <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--color-primary)]" />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState("#7c3aed");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "branding" | "subscription" | "domain" | "features">("profile");

  // AI assistant state
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);

  // Custom domain state
  const [customDomain, setCustomDomain] = useState("");
  const [domainVerified, setDomainVerified] = useState(false);
  const [domainToken, setDomainToken] = useState<string | null>(null);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainMessage, setDomainMessage] = useState<string | null>(null);

  // Load business on mount
  useEffect(() => {
    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("branded_session_token") : null;
    const businessId = typeof window !== "undefined" ? localStorage.getItem("branded_business_id") : null;

    if (!sessionToken || !businessId) {
      window.location.href = '/api/auth/login';
      return;
    }

    loadBusinessApi(sessionToken, businessId).then((result) => {
      setLoading(false);
      if ("error" in result && result.error) {
        setError(result.error as string);
        return;
      }
      const b = result.business as Business;
      setBusiness(b);
      setName(b.name);
      setSlug(b.slug);
      setLogoUrl(b.logo_url);
      setPrimaryColor(b.primary_color);
      setSecondaryColor(b.secondary_color);
      setAiAssistantEnabled(b.ai_assistant_enabled === 1);
      // Load domain state
      setCustomDomain(b.custom_domain || "");
      setDomainVerified(b.custom_domain_verified === 1);
      setDomainToken(b.custom_domain_verification_token || null);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("branded_session_token") : null;
    const businessId = typeof window !== "undefined" ? localStorage.getItem("branded_business_id") : null;
    if (!sessionToken || !businessId) return;

    const result = await saveBusinessApi({
      sessionToken,
      businessId,
      name,
      slug,
      logoUrl,
      primaryColor,
      secondaryColor,
    });

    setSaving(false);
    if ("error" in result && result.error) {
      alert(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleToggleAi = async (enabled: boolean) => {
    setTogglingAi(true);
    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("branded_session_token") : null;
    const businessId = typeof window !== "undefined" ? localStorage.getItem("branded_business_id") : null;
    if (!sessionToken || !businessId) return;

    const result = await toggleAiApi(sessionToken, businessId, enabled);
    setTogglingAi(false);
    if ("error" in result && result.error) {
      alert(result.error);
      return;
    }
    setAiAssistantEnabled(enabled);
  };

  // Domain handlers
  const handleSetDomain = async () => {
    setDomainSaving(true);
    setDomainError(null);
    setDomainMessage(null);

    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("branded_session_token") : null;
    const businessId = typeof window !== "undefined" ? localStorage.getItem("branded_business_id") : null;
    if (!sessionToken || !businessId) return;

    const res = await fetch("/api/domains/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken, businessId, domain: customDomain.trim() }),
    });
    const result = await res.json();

    setDomainSaving(false);
    if ("error" in result && result.error) {
      setDomainError(result.error as string);
    } else if ("success" in result && result.success) {
      setDomainToken((result as { verificationToken: string }).verificationToken);
      setDomainVerified(false);
      setDomainMessage("Domain saved! Now verify ownership via DNS.");
    }
  };

  const handleVerifyDomain = async () => {
    setDomainVerifying(true);
    setDomainError(null);
    setDomainMessage(null);

    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("branded_session_token") : null;
    const businessId = typeof window !== "undefined" ? localStorage.getItem("branded_business_id") : null;
    if (!sessionToken || !businessId) return;

    const res = await fetch("/api/domains/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken, businessId }),
    });
    const result = await res.json();

    setDomainVerifying(false);
    if ("error" in result && result.error) {
      setDomainError(result.error as string);
    } else if ("verified" in result) {
      if (result.verified) {
        setDomainVerified(true);
        setDomainMessage("Domain verified! Your app is now available at your custom domain.");
      } else {
        setDomainMessage((result as { message: string }).message || "Verification record not found");
      }
    }
  };

  // Fetch domain status on mount
  const fetchDomainStatus = async () => {
    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("branded_session_token") : null;
    const businessId = typeof window !== "undefined" ? localStorage.getItem("branded_business_id") : null;
    if (!sessionToken || !businessId) return;

    const res = await fetch("/api/domains/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken, businessId }),
    });
    const result = await res.json();
    if ("verified" in result) {
      setDomainVerified(result.verified);
      if (result.domain) setCustomDomain(result.domain);
      if (result.verificationToken) setDomainToken(result.verificationToken);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--color-primary)]" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <svg className="size-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-900">Authentication required</h2>
        <p className="text-sm text-gray-500">{error}</p>
        <Link to="/login" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage your business profile and branding
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs font-medium text-green-600">Saved!</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: "profile" as const, label: "Profile" },
            { id: "branding" as const, label: "Branding" },
            { id: "features" as const, label: "Features" },
            { id: "domain" as const, label: "Custom Domain" },
            { id: "subscription" as const, label: "Subscription" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="max-w-lg space-y-4">
          <TextEditor
            label="Business Name"
            value={name}
            onChange={setName}
            placeholder="My Business"
            required
          />
          <TextEditor
            label="URL Slug"
            value={slug}
            onChange={setSlug}
            placeholder="my-business"
            helpText="Used in your app URL: branded.app/app/your-slug"
            required
          />
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              <span className="font-medium">App URL preview:</span>{" "}
              <code className="text-[var(--color-primary)]">
                branded.app/app/{slug || "your-slug"}
              </code>
            </p>
          </div>
        </div>
      )}

      {/* Branding tab */}
      {activeTab === "branding" && (
        <div className="max-w-lg space-y-6">
          <ImageUploader
            label="Business Logo"
            value={logoUrl}
            onChange={setLogoUrl}
            aspectRatio="1/1"
            helpText="Square image recommended. Will appear in your app header."
          />

          <ColorPicker
            label="Primary Color"
            value={primaryColor}
            onChange={setPrimaryColor}
            helpText="Main brand color — used for headers, buttons, and accents"
          />

          <ColorPicker
            label="Secondary Color"
            value={secondaryColor}
            onChange={setSecondaryColor}
            helpText="Secondary brand color — used for gradients and highlights"
          />

          {/* Color preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Preview</p>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ backgroundColor: primaryColor }}
              >
                <div
                  className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white"
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-white">{name}</span>
              </div>
              <div className="space-y-2 p-4">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Primary Button
                </button>
                <button
                  type="button"
                  className="ml-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Secondary Button
                </button>
                <div
                  className="mt-2 h-2 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Domain tab */}
      {activeTab === "domain" && business && (
        <div className="max-w-lg space-y-6">
          {business.subscription_tier !== "premium" ? (
            /* Not Premium — show upsell */
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <svg className="mx-auto size-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Premium Feature</h3>
              <p className="mt-2 text-sm text-gray-500">
                Custom domains are available on the Premium plan. Upgrade to serve your app on your own domain.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("subscription")}
                className="mt-4 inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                View Plans →
              </button>
            </div>
          ) : (
            /* Premium — show domain management */
            <>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Custom Domain</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Serve your branded app on your own domain like app.yourbusiness.com
                </p>
              </div>

              {/* Status badge */}
              {customDomain && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Status:</span>
                  {domainVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Pending
                    </span>
                  )}
                </div>
              )}

              {/* Domain input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Domain Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ""))}
                    placeholder="app.yourbusiness.com"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleSetDomain}
                    disabled={domainSaving || !customDomain.trim()}
                    className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {domainSaving ? "Saving..." : "Save"}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Enter the full subdomain you want to use, e.g. app.example.com
                </p>
              </div>

              {/* Error */}
              {domainError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {domainError}
                </div>
              )}

              {/* Success message */}
              {domainMessage && (
                <div className={`rounded-lg p-3 text-sm ${domainVerified ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                  {domainMessage}
                </div>
              )}

              {/* Verification instructions — shown after domain is saved but not yet verified */}
              {customDomain && domainToken && !domainVerified && (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">Verify Your Domain</h4>
                  <p className="text-xs text-gray-500">
                    Add these DNS records with your domain provider to verify ownership and point your domain to Branded:
                  </p>

                  {/* CNAME instruction */}
                  <div className="rounded-md bg-white p-3 border border-gray-200">
                    <p className="text-xs font-medium text-gray-700">1. Add a CNAME record:</p>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Name:</span>{" "}
                        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">{customDomain.split(".")[0] === "app" ? "app" : "@"}</code>
                      </div>
                      <div>
                        <span className="text-gray-400">Target:</span>{" "}
                        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">brandedapp.us</code>
                      </div>
                    </div>
                  </div>

                  {/* TXT instruction */}
                  <div className="rounded-md bg-white p-3 border border-gray-200">
                    <p className="text-xs font-medium text-gray-700">2. Add a TXT record for verification:</p>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Name:</span>{" "}
                        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">_branded.{customDomain}</code>
                      </div>
                      <div>
                        <span className="text-gray-400">Value:</span>{" "}
                        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono break-all">{domainToken}</code>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyDomain}
                    disabled={domainVerifying}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:bg-green-500 disabled:opacity-50"
                  >
                    {domainVerifying ? "Checking DNS..." : "Verify Domain"}
                  </button>
                  <p className="text-xs text-gray-400">
                    DNS changes can take a few minutes to propagate. If verification fails, wait a moment and try again.
                  </p>
                </div>
              )}

              {/* Verified success state */}
              {customDomain && domainVerified && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-800">
                    Your app is live at:
                  </p>
                  <a
                    href={`https://${customDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    https://{customDomain} →
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Features tab */}
      {activeTab === "features" && business && (
        <div className="max-w-lg space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Premium Features</h2>
            <p className="mt-1 text-sm text-gray-500">
              Unlock powerful tools to automate and enhance your app.
            </p>
          </div>

          {/* AI Assistant */}
          <div className="rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">AI Assistant</h3>
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                    PREMIUM
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Automatically generate smart reply suggestions to customer messages.
                  Review and send — you stay in control.
                </p>
              </div>
              {business.subscription_tier === "premium" ? (
                <Toggle
                  checked={aiAssistantEnabled}
                  onChange={handleToggleAi}
                  disabled={togglingAi}
                />
              ) : (
                <div className="shrink-0 text-right">
                  <button
                    type="button"
                    onClick={() => setActiveTab("subscription")}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700"
                  >
                    Upgrade to Premium
                  </button>
                  <p className="mt-1 text-[10px] text-gray-400">$199/mo</p>
                </div>
              )}
            </div>

            {business.subscription_tier === "premium" && aiAssistantEnabled && (
              <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50 p-3">
                <p className="text-xs text-purple-700">
                  <span className="font-medium">✓ AI Assistant is active.</span>{" "}
                  When viewing messages, you'll see an "✨ Generate Reply" button after
                  each customer message on your Direct Messaging page.
                </p>
              </div>
            )}

            {business.subscription_tier === "premium" && !aiAssistantEnabled && (
              <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">
                  Toggle the switch above to enable AI-powered reply suggestions for
                  your messaging page.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscription tab */}
      {activeTab === "subscription" && business && (
        <div className="max-w-4xl">
          <BillingManager
            currentTier={business.subscription_tier}
            businessId={business.id}
            businessName={business.name}
            createdAt={business.created_at}
          />

          {/* Business info */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-medium text-gray-900">Business Details</h3>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">ID</dt>
                <dd className="font-mono text-xs text-gray-700">{business.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-700">{business.created_at}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}