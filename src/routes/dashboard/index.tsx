import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  Badge,
  LoadingSpinner,
} from "~/lib/design/components";
import { OnboardingBanner, OnboardingChecklist, type OnboardingProgress } from "~/lib/onboarding";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

// ---------------------------------------------------------------------------
// API helper — load dashboard data
// ---------------------------------------------------------------------------

async function loadDashboardApi(sessionToken: string, businessId: string) {
  const res = await fetch("/api/dashboard/load-dashboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, businessId }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DashboardOverview() {
  // Auth
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Dashboard state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState("#7c3aed");
  const [pages, setPages] = useState<Array<{
    id: string;
    title: string;
    pageType: string;
    status: "published" | "draft";
    updated: string;
  }>>([]);

  // Banner dismiss state (persisted in localStorage)
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Initialize
  useEffect(() => {
    const token = (() => {
      try {
        return localStorage.getItem("branded_session_token");
      } catch {
        return null;
      }
    })();
    const bid = (() => {
      try {
        return localStorage.getItem("branded_business_id");
      } catch {
        return null;
      }
    })();
    const dismissed = (() => {
      try {
        return localStorage.getItem("branded_banner_dismissed");
      } catch {
        return null;
      }
    })();

    if (!token || !bid) return;

    setSessionToken(token);
    setBusinessId(bid);
    if (dismissed === "true") setBannerDismissed(true);

    loadDashboardApi(token, bid)
      .then((result) => {
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
        const data = result;
        if (!data.business) return;
        setBusinessName(data.business.name);
        setBusinessSlug(data.business.slug);
        setBusinessLogo(data.business.logo_url);
        setPrimaryColor(data.business.primary_color);
        setSecondaryColor(data.business.secondary_color);
        setPages(data.pages);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
        setLoading(false);
      });
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      localStorage.setItem("branded_banner_dismissed", "true");
    } catch {}
  }, []);

  // ---------- Derived data ----------

  const publishedCount = pages.filter((p) => p.status === "published").length;
  const totalPages = pages.length;
  const isNewBusiness = totalPages === 0;

  const onboardingProgress: OnboardingProgress = {
    hasLogo: !!businessLogo || businessName.length > 0,
    hasColors: primaryColor !== "#4f46e5" || secondaryColor !== "#7c3aed",
    hasPages: totalPages > 0,
    hasPublishedPages: publishedCount > 0,
  };

  // Stats
  const stats = [
    { label: "Total Pages", value: String(totalPages), change: "", trend: "neutral" as const },
    { label: "Published", value: String(publishedCount), change: "", trend: "neutral" as const },
    { label: "Drafts", value: String(totalPages - publishedCount), change: "", trend: "neutral" as const },
    { label: "App Slug", value: `/${businessSlug}`, change: "", trend: "neutral" as const },
  ];

  // ---------- Loading / error ----------

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-600">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 pb-20 sm:p-6 lg:pb-6">
      {/* ---------- Onboarding welcome banner ---------- */}
      {!bannerDismissed && (
        <OnboardingBanner
          progress={onboardingProgress}
          onDismiss={dismissBanner}
        />
      )}

      {/* Welcome header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {businessName || "Welcome back"} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's what's happening with your app today.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/app/${businessSlug}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Preview App
            </Button>
          </a>
          <a href="/dashboard/pages">
            <Button size="sm">Edit Pages</Button>
          </a>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} padding="md">
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              {stat.change && (
                <span
                  className={`text-sm font-medium ${
                    stat.trend === "up"
                      ? "text-green-600"
                      : stat.trend === "down"
                        ? "text-red-600"
                        : "text-gray-500"
                  }`}
                >
                  {stat.change}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent pages */}
        <Card padding="none">
          <div className="border-b border-gray-100 px-4 py-3 sm:px-6">
            <h2 className="text-base font-semibold text-gray-900">Recent Pages</h2>
          </div>
          {pages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <svg className="size-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-500">No pages yet</p>
              <a href="/dashboard/pages">
                <Button variant="outline" size="sm">Create Your First Page</Button>
              </a>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {pages.slice(0, 5).map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between px-4 py-3 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{page.title}</p>
                      <p className="text-xs text-gray-500">
                        {page.pageType} · Updated {formatTimeAgo(page.updated)}
                      </p>
                    </div>
                    <Badge variant={page.status === "published" ? "success" : "default"}>
                      {page.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </div>
                ))}
              </div>
              {pages.length > 5 && (
                <div className="border-t border-gray-100 px-4 py-3 sm:px-6">
                  <a href="/dashboard/pages">
                    <Button variant="ghost" size="sm">View All {pages.length} Pages →</Button>
                  </a>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Onboarding checklist + quick actions */}
        <div className="space-y-6">
          {!isNewBusiness && (
            <OnboardingChecklist progress={onboardingProgress} />
          )}

          {isNewBusiness && (
            <OnboardingChecklist progress={onboardingProgress} />
          )}

          {/* Quick actions */}
          <Card padding="none">
            <div className="border-b border-gray-100 px-4 py-3 sm:px-6">
              <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="space-y-1 p-4 sm:p-6">
              <ActionButton
                label="Add a New Page"
                description="Create a Bio, Team, Hours, or Pricing page"
                href="/dashboard/pages"
              />
              <ActionButton
                label="Customize Branding"
                description="Update your logo, colors, and app name"
                href="/dashboard/settings"
              />
              <ActionButton
                label="Share Your App"
                description="Copy your app link to share with customers"
                href={`/app/${businessSlug}`}
                external
              />
              <ActionButton
                label="View Customers"
                description="See who's using your app"
                href="/dashboard/customers"
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Page type completion grid */}
      {totalPages > 0 && (
        <Card padding="lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">App Setup Progress</h2>
              <p className="mt-1 text-sm text-gray-500">
                {publishedCount} of {totalPages} pages published.
              </p>
            </div>
            <Badge variant="info">{totalPages} page{totalPages !== 1 ? "s" : ""} created</Badge>
          </div>
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                style={{ width: `${totalPages > 0 ? (publishedCount / totalPages) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pages.map((page) => (
              <a
                key={page.id}
                href={`/dashboard/pages/${page.id}`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  page.status === "published"
                    ? "bg-green-50 text-green-700 hover:bg-green-100"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {page.status === "published" ? (
                  <svg className="size-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
                {page.title}
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionButton sub-component
// ---------------------------------------------------------------------------

function ActionButton({
  label,
  description,
  href,
  external = false,
}: {
  label: string;
  description: string;
  href: string;
  external?: boolean;
}) {
  const Component = external ? "a" : "a";
  const extraProps = external ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <Component
      href={href}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
      {...extraProps}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-50)]">
        <svg
          className="size-5 text-[var(--color-primary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="truncate text-xs text-gray-500">{description}</p>
      </div>
      <svg
        className="size-4 shrink-0 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </Component>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
