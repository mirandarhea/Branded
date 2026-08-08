import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, LoadingSpinner, Badge } from "~/lib/design/components";

export const Route = createFileRoute("/dashboard/analytics")({
  component: AnalyticsDashboard,
});

// ---------------------------------------------------------------------------
// API helper — load analytics
// ---------------------------------------------------------------------------

async function loadAnalyticsApi(payload: { sessionToken: string; businessId: string; period: string }) {
  const res = await fetch("/api/dashboard/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

type AnalyticsData = {
  error?: string;
  totalPageViews?: number;
  uniqueVisitors?: number;
  signups?: number;
  avgPagesPerApp?: number;
  pageViewsByDay?: { date: string; count: number }[];
  topPages?: { pageType: string; count: number }[];
};

// ---------------------------------------------------------------------------
// Chart dimensions
// ---------------------------------------------------------------------------

const CHART_W = 600;
const CHART_H = 200;
const CHART_PAD_L = 50;
const CHART_PAD_R = 20;
const CHART_PAD_T = 20;
const CHART_PAD_B = 30;

const BAR_W = 500;
const BAR_H = 240;
const BAR_PAD_L = 120;
const BAR_PAD_R = 20;
const BAR_PAD_T = 16;
const BAR_PAD_B = 24;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AnalyticsDashboard() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = (() => { try { return localStorage.getItem("branded_session_token"); } catch { return null; } })();
    const bid = (() => { try { return localStorage.getItem("branded_business_id"); } catch { return null; } })();
    if (!token || !bid) return;
    setSessionToken(token);
    setBusinessId(bid);
  }, []);

  useEffect(() => {
    if (!sessionToken || !businessId) return;
    setLoading(true);
    setError("");
    loadAnalyticsApi({ sessionToken, businessId, period })
      .then((result) => {
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
        setLoading(false);
      });
  }, [sessionToken, businessId, period]);

  // ---------- derive ----------

  const stats = data && !data.error
    ? [
        { label: "Page Views", value: String(data.totalPageViews ?? 0), icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
        { label: "Unique Visitors", value: String(data.uniqueVisitors ?? 0), icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
        { label: "Signups", value: String(data.signups ?? 0), icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
        { label: "Pages Built", value: String(data.avgPagesPerApp ?? 0), icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" },
      ]
    : [];

  const pageViewsByDay = data && !("error" in data) ? (data.pageViewsByDay ?? []) : [];
  const topPages = data && !("error" in data) ? (data.topPages ?? []) : [];

  // ---------- Loading ----------

  if (!sessionToken || !businessId) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 pb-20 sm:p-6 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track how customers are engaging with your app.
          </p>
        </div>

        {/* Period selector */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card padding="md">
          <p className="text-center text-red-600">{error}</p>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex min-h-[40dvh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && !("error" in data) && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} padding="md">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--color-primary-50)] p-2">
                    <svg
                      className="size-5 text-[var(--color-primary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                    </svg>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Line chart — Page views over time */}
          <Card padding="lg">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Page Views Over Time</h2>
            {pageViewsByDay.length === 0 ? (
              <EmptyChart message="No page views recorded yet" />
            ) : (
              <LineChart data={pageViewsByDay} />
            )}
          </Card>

          {/* Bar chart — Top pages */}
          <Card padding="lg">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Top Pages</h2>
            {topPages.length === 0 ? (
              <EmptyChart message="No page data yet" />
            ) : (
              <BarChart data={topPages} />
            )}
          </Card>

          {/* Page type list */}
          {topPages.length > 0 && (
            <Card padding="none">
              <div className="border-b border-gray-100 px-4 py-3 sm:px-6">
                <h2 className="text-base font-semibold text-gray-900">Page Breakdown</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {topPages.map((p, i) => (
                  <div
                    key={p.pageType}
                    className="flex items-center justify-between px-4 py-3 sm:px-6"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-400 tabular-nums">
                        #{i + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {p.pageType.replace(/-/g, " ")}
                      </span>
                    </div>
                    <Badge variant="info">{p.count} view{p.count !== 1 ? "s" : ""}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line chart (SVG)
// ---------------------------------------------------------------------------

function LineChart({ data }: { data: { date: string; count: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const plotW = CHART_W - CHART_PAD_L - CHART_PAD_R;
  const plotH = CHART_H - CHART_PAD_T - CHART_PAD_B;

  const points = data.map((d, i) => {
    const x = CHART_PAD_L + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
    const y = CHART_PAD_T + plotH - (d.count / maxVal) * plotH;
    return `${x},${y}`;
  });

  const polylinePoints = points.join(" ");

  // Y-axis ticks
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  // X-axis labels (show ~5 evenly spaced)
  const xLabelInterval = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data.filter((_, i) => i % xLabelInterval === 0 || i === data.length - 1);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-auto w-full min-w-[500px] max-w-full"
        role="img"
        aria-label="Line chart of page views over time"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = CHART_PAD_T + plotH - (tick / maxVal) * plotH;
          return (
            <g key={tick}>
              <line
                x1={CHART_PAD_L}
                y1={y}
                x2={CHART_W - CHART_PAD_R}
                y2={y}
                stroke="#f3f4f6"
                strokeWidth={1}
              />
              <text
                x={CHART_PAD_L - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-400 text-[10px]"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((d) => {
          const i = data.indexOf(d);
          const x = CHART_PAD_L + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
          return (
            <text
              key={d.date}
              x={x}
              y={CHART_H - 4}
              textAnchor="middle"
              className="fill-gray-400 text-[10px]"
            >
              {formatDateShort(d.date)}
            </text>
          );
        })}

        {/* Area fill */}
        {data.length > 0 && (
          <polygon
            points={`${CHART_PAD_L},${CHART_PAD_T + plotH} ${polylinePoints} ${points[points.length - 1].split(",")[0]},${CHART_PAD_T + plotH}`}
            fill="var(--color-primary)"
            fillOpacity={0.08}
          />
        )}

        {/* Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const x = CHART_PAD_L + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
          const y = CHART_PAD_T + plotH - (d.count / maxVal) * plotH;
          return (
            <circle
              key={d.date}
              cx={x}
              cy={y}
              r={3}
              fill="white"
              stroke="var(--color-primary)"
              strokeWidth={2}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar chart (SVG)
// ---------------------------------------------------------------------------

function BarChart({ data }: { data: { pageType: string; count: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const plotH = BAR_H - BAR_PAD_T - BAR_PAD_B;
  const plotW = BAR_W - BAR_PAD_L - BAR_PAD_R;
  const barGap = 8;
  const barCount = data.length;
  const barWidth = Math.max(8, Math.min(40, (plotW - (barCount - 1) * barGap) / barCount));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${BAR_W} ${BAR_H}`}
        className="h-auto w-full min-w-[500px] max-w-full"
        role="img"
        aria-label="Bar chart of top pages by views"
      >
        {data.map((d, i) => {
          const x = BAR_PAD_L + i * (barWidth + barGap);
          const barH = Math.max(2, (d.count / maxVal) * plotH);
          const y = BAR_PAD_T + plotH - barH;

          return (
            <g key={d.pageType}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={3}
                fill="var(--color-primary)"
                fillOpacity={0.85}
              />
              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={BAR_H - 4}
                textAnchor="middle"
                className="fill-gray-500 text-[9px]"
              >
                {truncateLabel(d.pageType.replace(/-/g, " "), 8)}
              </text>
              {/* Value above bar */}
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                className="fill-gray-600 text-[10px] font-medium"
              >
                {d.count}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={BAR_PAD_L - 4}
          y1={BAR_PAD_T + plotH}
          x2={BAR_W - BAR_PAD_R}
          y2={BAR_PAD_T + plotH}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty chart state
// ---------------------------------------------------------------------------

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <svg className="size-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncateLabel(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}
