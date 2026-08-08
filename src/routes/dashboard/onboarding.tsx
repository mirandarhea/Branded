/**
 * Dashboard — Onboarding Wizard
 *
 * Step-by-step post-signup setup flow for new business owners:
 *   Step 1: Upload logo or preview business name
 *   Step 2: Pick brand colors (preset palettes)
 *   Step 3: Create first page (auto-create Bio)
 *   Step 4: Preview link & finish
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Input, Card } from "~/lib/design/components";
import { colorPalettes, type ColorPalette } from "~/lib/onboarding";
import type { Page } from "~/lib/db";

export const Route = createFileRoute("/dashboard/onboarding")({
  component: OnboardingWizard,
});

// ---------------------------------------------------------------------------
// API helpers (replaces createServerFn — uses fetch() for production)
// ---------------------------------------------------------------------------

async function loadWizardApi(sessionToken: string, businessId: string) {
  const res = await fetch("/api/dashboard/load-wizard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, businessId }),
  });
  return res.json();
}

async function updateBrandingApi(payload: {
  sessionToken: string;
  businessId: string;
  logo_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
}) {
  const res = await fetch("/api/dashboard/update-branding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function createBioPageApi(payload: {
  sessionToken: string;
  businessId: string;
  businessName: string;
}) {
  const res = await fetch("/api/dashboard/create-bio-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepId = "brand-logo" | "brand-colors" | "first-page" | "ready";

const stepLabels: Record<StepId, string> = {
  "brand-logo": "Logo",
  "brand-colors": "Colors",
  "first-page": "First Page",
  ready: "Ready!",
};

const stepOrder: StepId[] = ["brand-logo", "brand-colors", "first-page", "ready"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function OnboardingWizard() {
  const navigate = useNavigate();

  // Auth
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<StepId>("brand-logo");
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette>(colorPalettes[0]);
  const [existingPageTypes, setExistingPageTypes] = useState<string[]>([]);
  const [previewSlug, setPreviewSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ---------- Load auth & initial data ----------

  useEffect(() => {
    const token = (() => {
      try {
        return localStorage.getItem("branded_session_token");
      } catch {
        return null;
      }
    })();
    if (!token) {
      navigate({ to: "/api/auth/login" });
      return;
    }

    const bid = (() => {
      try {
        return localStorage.getItem("branded_business_id");
      } catch {
        return null;
      }
    })();
    if (!bid) {
      navigate({ to: "/api/auth/login" });
      return;
    }

    setSessionToken(token);
    setBusinessId(bid);

    loadWizardApi(token, bid)
      .then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        const data = result;
        if (!data.business) return;
        setBusinessName(data.business.name);
        setBusinessSlug(data.business.slug);
        setLogoUrl(data.business.logo_url);
        setPreviewSlug(data.business.slug);
        setExistingPageTypes(data.pages);

        // Match current colors to a palette, or keep defaults
        const matched = colorPalettes.find(
          (p) => p.primary === data.business.primary_color,
        );
        if (matched) setSelectedPalette(matched);

        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });
  }, [navigate]);

  // ---------- Step navigation ----------

  const goToStep = useCallback(
    (step: StepId) => {
      setCurrentStep(step);
      setError("");
    },
    [],
  );

  const handleNext = useCallback(async () => {
    const idx = stepOrder.indexOf(currentStep);
    if (idx < stepOrder.length - 1) {
      goToStep(stepOrder[idx + 1]);
    }
  }, [currentStep, goToStep]);

  const handleBack = useCallback(() => {
    const idx = stepOrder.indexOf(currentStep);
    if (idx > 0) {
      goToStep(stepOrder[idx - 1]);
    }
  }, [currentStep, goToStep]);

  // ---------- Save handlers ----------

  const handleSaveLogo = useCallback(async () => {
    if (!sessionToken || !businessId) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateBrandingApi({
        sessionToken,
        businessId,
        logo_url: logoUrl,
      });
      if (result && result.error) {
        setError(result.error);
      } else {
        await handleNext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [sessionToken, businessId, logoUrl, handleNext]);

  const handleSaveColors = useCallback(async () => {
    if (!sessionToken || !businessId) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateBrandingApi({
        sessionToken,
        businessId,
        primary_color: selectedPalette.primary,
        secondary_color: selectedPalette.secondary,
      });
      if (result && result.error) {
        setError(result.error);
      } else {
        await handleNext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [sessionToken, businessId, selectedPalette, handleNext]);

  const handleCreateBio = useCallback(async () => {
    if (!sessionToken || !businessId) return;
    setSaving(true);
    setError("");
    try {
      const result = await createBioPageApi({
        sessionToken,
        businessId,
        businessName,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setExistingPageTypes(result.pages.map((p: Page) => p.page_type));
        await handleNext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }, [sessionToken, businessId, businessName, handleNext]);

  // ---------- Loading ----------

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <span className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--color-primary)]" />
      </div>
    );
  }

  // ---------- Render ----------

  const stepIdx = stepOrder.indexOf(currentStep);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 sm:p-6 lg:pb-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Set Up Your App</h1>
        <p className="mt-1 text-sm text-gray-500">
          Just a few steps to get your branded app ready for customers.
        </p>
      </div>

      {/* Step indicators */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {stepOrder.map((s, i) => {
            const isActive = s === currentStep;
            const isDone = i < stepIdx;
            return (
              <div key={s} className="flex flex-1 flex-col items-center">
                {/* Connector line */}
                {i > 0 && (
                  <div className="absolute -ml-[50%] mt-2.5 h-0.5 w-full">
                    <div
                      className={`h-full transition-colors ${
                        isDone || isActive ? "bg-[var(--color-primary)]" : "bg-gray-200"
                      }`}
                      style={{ width: "100%" }}
                    />
                  </div>
                )}
                <div className="relative flex flex-col items-center">
                  <span
                    className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isDone
                        ? "bg-[var(--color-primary)] text-white"
                        : isActive
                          ? "border-2 border-[var(--color-primary)] bg-white text-[var(--color-primary)]"
                          : "border-2 border-gray-200 bg-white text-gray-400"
                    }`}
                  >
                    {isDone ? (
                      <svg className="size-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={`mt-1 text-center text-[11px] font-medium ${
                      isActive ? "text-[var(--color-primary)]" : "text-gray-400"
                    }`}
                  >
                    {stepLabels[s]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Step content */}
      <Card padding="lg">
        {currentStep === "brand-logo" && (
          <StepLogo
            businessName={businessName}
            logoUrl={logoUrl}
            setLogoUrl={setLogoUrl}
          />
        )}

        {currentStep === "brand-colors" && (
          <StepColors
            selectedPalette={selectedPalette}
            onSelect={setSelectedPalette}
          />
        )}

        {currentStep === "first-page" && (
          <StepFirstPage
            businessName={businessName}
            hasBio={existingPageTypes.includes("bio")}
            onCreate={handleCreateBio}
            saving={saving}
          />
        )}

        {currentStep === "ready" && (
          <StepReady businessName={businessName} slug={previewSlug} />
        )}
      </Card>

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between">
        {stepIdx > 0 ? (
          <Button variant="ghost" size="md" onClick={handleBack} disabled={saving}>
            ← Back
          </Button>
        ) : (
          <div />
        )}

        {currentStep === "ready" ? (
          <div className="flex gap-3">
            <Button variant="outline" size="md" onClick={() => navigate({ to: "/dashboard" })}>
              Go to Dashboard
            </Button>
            <Link to="/dashboard/pages">
              <Button size="md">Create More Pages</Button>
            </Link>
          </div>
        ) : currentStep === "first-page" ? (
          <Button size="md" onClick={handleCreateBio} loading={saving} disabled={saving}>
            Create Page & Continue
          </Button>
        ) : currentStep === "brand-colors" ? (
          <Button size="md" onClick={handleSaveColors} loading={saving} disabled={saving}>
            Save Colors & Continue
          </Button>
        ) : (
          <Button size="md" onClick={handleSaveLogo} loading={saving} disabled={saving}>
            Save Logo & Continue
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Logo
// ---------------------------------------------------------------------------

function StepLogo({
  businessName,
  logoUrl,
  setLogoUrl,
}: {
  businessName: string;
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
}) {
  const [textLogo, setTextLogo] = useState(!logoUrl);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Add Your Logo</h2>
      <p className="mt-1 text-sm text-gray-500">
        Upload your business logo or use a text-based preview.
      </p>

      <div className="mt-6 space-y-4">
        {/* Toggle: text vs image */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setTextLogo(true)}
            className={`flex-1 rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors ${
              textLogo
                ? "border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary)]"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Text Logo
          </button>
          <button
            type="button"
            onClick={() => setTextLogo(false)}
            className={`flex-1 rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors ${
              !textLogo
                ? "border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary)]"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Image Logo
          </button>
        </div>

        {textLogo ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex size-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-2xl font-bold text-white shadow-lg">
              {businessName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "?"}
            </div>
            <p className="text-sm font-medium text-gray-700">{businessName}</p>
            <p className="text-xs text-gray-400">
              You can upload an image logo later in Settings.
            </p>
            {/* Clear image logo when using text */}
            <input type="hidden" value="" onChange={() => setLogoUrl(null)} />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700">Logo URL</label>
            <Input
              type="url"
              value={logoUrl || ""}
              onChange={(e) => setLogoUrl(e.target.value || null)}
              placeholder="https://example.com/your-logo.png"
              className="mt-1"
            />
            {logoUrl && (
              <div className="mt-3 flex items-center gap-4 rounded-lg border border-gray-200 p-3">
                <img
                  src={logoUrl}
                  alt={`${businessName} logo`}
                  className="size-16 rounded-lg object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">Logo Preview</p>
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Brand Colors
// ---------------------------------------------------------------------------

function StepColors({
  selectedPalette,
  onSelect,
}: {
  selectedPalette: ColorPalette;
  onSelect: (p: ColorPalette) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Pick Your Brand Colors</h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose a color palette that matches your business identity.
      </p>

      {/* Live preview */}
      <div className="mt-6 overflow-hidden rounded-xl border">
        {/* Preview header */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ backgroundColor: selectedPalette.primary }}
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white">
            B
          </div>
          <span className="text-sm font-semibold text-white">Your App</span>
        </div>
        {/* Preview body */}
        <div className="space-y-3 bg-gray-50 p-4">
          <div
            className="h-2 w-2/3 rounded-full"
            style={{ backgroundColor: selectedPalette.primary }}
          />
          <div
            className="h-2 w-1/2 rounded-full opacity-60"
            style={{ backgroundColor: selectedPalette.secondary }}
          />
          <div className="flex gap-2">
            <div
              className="h-8 w-20 rounded-lg opacity-80"
              style={{ backgroundColor: selectedPalette.primary }}
            />
            <div
              className="h-8 w-20 rounded-lg border-2 opacity-80"
              style={{ borderColor: selectedPalette.primary }}
            />
          </div>
          <div className="flex gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: selectedPalette.primary }}
            >
              Primary
            </span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: selectedPalette.secondary }}
            >
              Secondary
            </span>
          </div>
        </div>
      </div>

      {/* Color palettes */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {colorPalettes.map((palette) => (
          <button
            key={palette.id}
            type="button"
            onClick={() => onSelect(palette)}
            className={`group flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
              selectedPalette.id === palette.id
                ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] ring-2 ring-[var(--color-primary-200)]"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl">
              <div
                className="h-full w-1/2"
                style={{ backgroundColor: palette.primary }}
              />
              <div
                className="h-full w-1/2"
                style={{ backgroundColor: palette.secondary }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700">{palette.name}</span>
            {selectedPalette.id === palette.id && (
              <svg className="size-4 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — First Page
// ---------------------------------------------------------------------------

function StepFirstPage({
  businessName,
  hasBio,
  onCreate,
  saving,
}: {
  businessName: string;
  hasBio: boolean;
  onCreate: () => void;
  saving: boolean;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Create Your First Page</h2>
      <p className="mt-1 text-sm text-gray-500">
        Every app needs an About Us page. We'll create one for you automatically.
      </p>

      {hasBio ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <svg
            className="mx-auto size-10 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-3 text-base font-semibold text-green-800">
            Bio page already exists!
          </h3>
          <p className="mt-1 text-sm text-green-600">
            You can edit it from the dashboard anytime. Click continue to move on.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-gray-200 p-6">
          {/* Page preview */}
          <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xs font-bold text-white">
              {businessName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "?"}
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {businessName}
            </span>
          </div>

          <h4 className="text-lg font-bold text-gray-900">About Us</h4>
          <p className="mt-2 text-sm text-gray-600">
            Welcome to {businessName}! We're excited to serve you.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Learn more about {businessName} here.
          </p>

          <button
            type="button"
            onClick={onCreate}
            disabled={saving}
            className="mt-4 w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create This Page"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Ready!
// ---------------------------------------------------------------------------

function StepReady({
  businessName,
  slug,
}: {
  businessName: string;
  slug: string;
}) {
  return (
    <div className="text-center">
      {/* Confetti-style checkmark */}
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-green-100">
        <svg
          className="size-10 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h2 className="mt-5 text-2xl font-bold text-gray-900">Your App Is Ready!</h2>
      <p className="mt-2 text-sm text-gray-500">
        {businessName} is now live. Customers can access it at:
      </p>

      {/* Preview link */}
      <a
        href={`/app/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-4 py-3 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-100)]"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        /app/{slug}
      </a>

      <div className="mt-6 border-t border-gray-100 pt-6">
        <h3 className="text-sm font-semibold text-gray-900">What's next?</h3>
        <ul className="mt-3 space-y-2 text-left">
          {[
            "Add more pages: Team, Hours, Pricing, Contact, and more",
            "Customize your branding further in Settings",
            "Share your app link with customers",
            "Enable appointments, messaging, and bill pay",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-sm text-gray-600">
              <svg
                className="mt-0.5 size-4 shrink-0 text-[var(--color-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
