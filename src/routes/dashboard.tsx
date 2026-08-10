import { Outlet, Link, useLocation, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dashboard")({
  loader: async ({ context }: { context: any }) => {
    // Opportunistic email drip processing — fire and forget
    import("~/lib/server/email-drip")
      .then(({ processPendingDrips }) => processPendingDrips())
      .catch(() => {});

    // Extract session from cookies for SSR auth hydration
    let authData = null;
    try {
      // Access the raw request from TanStack Start's server context
      const request = (context as any)?.request;
      if (request?.headers) {
        const cookieHeader = request.headers.get("cookie") || "";
        const cookies: Record<string, string> = {};
        cookieHeader.split(";").forEach((c: string) => {
          const idx = c.indexOf("=");
          if (idx > 0) cookies[c.slice(0, idx).trim()] = c.slice(idx + 1).trim();
        });
        const token = cookies["branded_session"];
        if (token) {
          authData = { token };
        }
      }
    } catch {}

    // Also try URL params (set by login/register redirect)
    try {
      const url = new URL((context as any)?.request?.url || "http://localhost");
      const token = url.searchParams.get("token");
      const businessId = url.searchParams.get("businessId");
      if (token && businessId) {
        authData = { token, businessId };
      }
    } catch {}

    return { authData };
  },
  component: DashboardLayout,
});

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  path: string;
  icon: string; // SVG path (simplified — just the path d attribute)
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
  },
  {
    label: "Analytics",
    path: "/dashboard/analytics",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    label: "Pages",
    path: "/dashboard/pages",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  },
  {
    label: "Appointments",
    path: "/dashboard/appointments",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    label: "Messages",
    path: "/dashboard/messages",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    label: "Customers",
    path: "/dashboard/customers",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
  },
  {
    label: "Settings",
    path: "/dashboard/settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  },
];

// ---------------------------------------------------------------------------
// Layout component
// ---------------------------------------------------------------------------

function DashboardLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Inject SSR auth into window.__AUTH__ for client hydration
  const loaderData = Route.useLoaderData();
  const authData = (loaderData as any)?.authData;

  const activePath = location.pathname;

  return (
    <div className="flex min-h-dvh bg-gray-50">
      {/* SSR auth hydration: inject session data from cookies/URL into window.__AUTH__ */}
      {authData ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__AUTH__ = ${JSON.stringify(authData)};`,
          }}
        />
      ) : null}
      {/* Mobile header bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Toggle navigation"
        >
          {sidebarOpen ? (
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
            B
          </div>
          <span className="text-sm font-semibold text-gray-900">Branded</span>
        </div>

        <div className="size-10" /> {/* Spacer for centering */}
      </header>

      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        {/* Logo area */}
        <div className="flex h-14 items-center gap-2.5 border-b border-gray-200 px-6">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
            B
          </div>
          <span className="text-base font-semibold text-gray-900">Branded</span>
        </div>

        {/* Business name placeholder */}
        <div className="border-b border-gray-100 px-6 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">My Business</p>
          <p className="truncate text-sm font-medium text-gray-700">Your Business Name</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.path === "/dashboard"
                ? activePath === "/dashboard"
                : activePath.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--color-primary-50)] text-[var(--color-primary)]"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg
                      className="size-5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={isActive ? 2 : 1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-bold text-[var(--color-primary)]">
              JD
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-700">Jane Doe</p>
              <p className="truncate text-xs text-gray-400">Free Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-gray-200 bg-white transition-transform duration-200 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-gray-200 px-6">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
            B
          </div>
          <span className="text-base font-semibold text-gray-900">Branded</span>
        </div>

        <nav className="overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.path === "/dashboard"
                ? activePath === "/dashboard"
                : activePath.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--color-primary-50)] text-[var(--color-primary)]"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg
                      className="size-5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={isActive ? 2 : 1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pt-0 pt-14">
        {/* Desktop top bar */}
        <header className="hidden h-14 items-center justify-between border-b border-gray-200 bg-white px-6 lg:flex">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="flex size-8 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-bold text-[var(--color-primary)]">
              JD
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white lg:hidden">
          <ul className="flex justify-around">
            {navItems.slice(0, 5).map((item) => {
              const isActive = item.path === "/dashboard"
                ? activePath === "/dashboard"
                : activePath.startsWith(item.path);
              return (
                <li key={item.path} className="flex-1">
                  <Link
                    to={item.path}
                    className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                      isActive
                        ? "text-[var(--color-primary)]"
                        : "text-gray-400"
                    }`}
                  >
                    <svg
                      className="size-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={isActive ? 2 : 1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="flex-1">
              <Link
                to="/dashboard/settings"
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  activePath === "/dashboard/settings"
                    ? "text-[var(--color-primary)]"
                    : "text-gray-400"
                }`}
              >
                <svg
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={activePath === "/dashboard/settings" ? 2 : 1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={navItems[5].icon} />
                </svg>
                More
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}