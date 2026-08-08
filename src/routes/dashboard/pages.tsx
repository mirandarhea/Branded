/**
 * Dashboard — Page Manager
 *
 * Lists all pages for the business with:
 * - Title, page type icon, published toggle
 * - Edit/delete buttons
 * - "Add Page" button to create new pages
 * - Sort-order up/down reordering
 */
import { useState, useEffect } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { templateMetaList } from "~/lib/templates";
import type { Page } from "~/lib/db";

// ---------------------------------------------------------------------------
// API helpers (replaces createServerFn — uses fetch() for production)
// ---------------------------------------------------------------------------

async function loadPagesApi(sessionToken: string, businessId: string) {
  const res = await fetch("/api/dashboard/pages/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, businessId }),
  });
  return res.json();
}

async function togglePublishedApi(payload: { sessionToken: string; pageId: string; businessId: string; published: boolean }) {
  const res = await fetch("/api/dashboard/pages/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function createPageApi(payload: { sessionToken: string; businessId: string; pageType: string; title: string }) {
  const res = await fetch("/api/dashboard/pages/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function deletePageApi(payload: { sessionToken: string; pageId: string; businessId: string }) {
  const res = await fetch("/api/dashboard/pages/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function reorderPagesApi(payload: { sessionToken: string; businessId: string; pageIds: string[] }) {
  const res = await fetch("/api/dashboard/pages/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Page type metadata
// ---------------------------------------------------------------------------

const pageTypeIcons: Record<string, string> = {
  bio: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  team: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197",
  hours: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  contact: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  pricing: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1",
  gallery: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  "photo-submission": "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  "quote-request": "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  appointments: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  messaging: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  "bill-pay": "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  "account-view": "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
};

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/dashboard/pages")({
  component: PagesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    addModal: search.addModal === "true",
  }),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PagesPage() {
  const navigate = useNavigate();
  const { addModal } = Route.useSearch();
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load pages on mount
  useEffect(() => {
    const sessionToken = typeof window !== "undefined"
      ? localStorage.getItem("branded_session_token")
      : null;
    const businessId = typeof window !== "undefined"
      ? localStorage.getItem("branded_business_id")
      : null;

    if (!sessionToken || !businessId) {
      setError("Please log in to manage pages");
      setLoading(false);
      return;
    }

    loadPagesApi(sessionToken, businessId).then((result) => {
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.pages) {
        setPages(result.pages as Page[]);
      }
    });
  }, []);

  const handleTogglePublished = async (page: Page) => {
    setTogglingId(page.id);
    const sessionToken = localStorage.getItem("branded_session_token");
    const businessId = localStorage.getItem("branded_business_id");
    if (!sessionToken || !businessId) return;

    await togglePublishedApi({
      sessionToken,
      pageId: page.id,
      businessId,
      published: !page.is_published,
    });

    setPages((prev) =>
      prev.map((p) =>
        p.id === page.id ? { ...p, is_published: p.is_published ? 0 : 1 } : p,
      ),
    );
    setTogglingId(null);
  };

  const handleDelete = async (pageId: string) => {
    if (!confirm("Are you sure you want to delete this page? This cannot be undone.")) return;

    setDeletingId(pageId);
    const sessionToken = localStorage.getItem("branded_session_token");
    const businessId = localStorage.getItem("branded_business_id");
    if (!sessionToken || !businessId) return;

    await deletePageApi({ sessionToken, pageId, businessId });
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    setDeletingId(null);
  };

  const handleAddPage = async (pageType: string, title: string) => {
    const sessionToken = localStorage.getItem("branded_session_token");
    const businessId = localStorage.getItem("branded_business_id");
    if (!sessionToken || !businessId) return;

    const result = await createPageApi({ sessionToken, businessId, pageType, title });
    if (result.error) {
      alert(result.error);
      return;
    }

    // Reload pages
    const loaded = await loadPagesApi(sessionToken, businessId);
    if (loaded.pages) {
      setPages(loaded.pages as Page[]);
    }

    navigate({ to: "/dashboard/pages", search: { addModal: undefined } });
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === pages.length - 1)
    )
      return;

    const newPages = [...pages];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newPages[index], newPages[swapIndex]] = [newPages[swapIndex], newPages[index]];

    setPages(newPages);

    const sessionToken = localStorage.getItem("branded_session_token");
    const businessId = localStorage.getItem("branded_business_id");
    if (!sessionToken || !businessId) return;

    await reorderPagesApi({
      sessionToken,
      businessId,
      pageIds: newPages.map((p) => p.id),
    });
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

  // Group pages by published status
  const publishedPages = pages.filter((p) => p.is_published);
  const draftPages = pages.filter((p) => !p.is_published);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pages</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {pages.length} page{pages.length !== 1 ? "s" : ""} total &middot;{" "}
            {publishedPages.length} published
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/dashboard/pages", search: { addModal: "true" } })}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Page
        </button>
      </div>

      {/* Empty state */}
      {pages.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <svg className="mb-4 size-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <h3 className="text-base font-semibold text-gray-900">No pages yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first page to get started.</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard/pages", search: { addModal: "true" } })}
            className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Create your first page
          </button>
        </div>
      )}

      {/* Page list */}
      {pages.length > 0 && (
        <div className="space-y-4">
          {/* Published section */}
          {publishedPages.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Published ({publishedPages.length})
              </h2>
              <div className="space-y-2">
                {publishedPages.map((page, index) => (
                  <PageRow
                    key={page.id}
                    page={page}
                    index={index}
                    total={pages.length}
                    togglingId={togglingId}
                    deletingId={deletingId}
                    onToggle={() => handleTogglePublished(page)}
                    onDelete={() => handleDelete(page.id)}
                    onMove={(dir) => handleMove(index, dir)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Draft section */}
          {draftPages.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Drafts ({draftPages.length})
              </h2>
              <div className="space-y-2">
                {draftPages.map((page, index) => {
                  const realIndex = pages.indexOf(page);
                  return (
                    <PageRow
                      key={page.id}
                      page={page}
                      index={realIndex}
                      total={pages.length}
                      togglingId={togglingId}
                      deletingId={deletingId}
                      onToggle={() => handleTogglePublished(page)}
                      onDelete={() => handleDelete(page.id)}
                      onMove={(dir) => handleMove(realIndex, dir)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Page Modal */}
      {addModal && (
        <AddPageModal
          existingTypes={pages.map((p) => p.page_type)}
          onAdd={handleAddPage}
          onClose={() => navigate({ to: "/dashboard/pages", search: { addModal: undefined } })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageRow component
// ---------------------------------------------------------------------------

function PageRow({
  page,
  index,
  total,
  togglingId,
  deletingId,
  onToggle,
  onDelete,
  onMove,
}: {
  page: Page;
  index: number;
  total: number;
  togglingId: string | null;
  deletingId: string | null;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const iconPath = pageTypeIcons[page.page_type] || "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z";
  const meta = templateMetaList.find((m) => m.pageType === page.page_type);
  const label = meta?.label || page.page_type;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md">
      {/* Reorder buttons */}
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={index === 0}
          className="leading-none text-gray-300 hover:text-gray-500 disabled:opacity-30"
        >
          <svg className="size-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={index === total - 1}
          className="leading-none text-gray-300 hover:text-gray-500 disabled:opacity-30"
        >
          <svg className="size-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Icon */}
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: page.is_published ? "var(--color-primary)" : "#f3f4f6" }}
      >
        <svg
          className={`size-5 ${page.is_published ? "text-white" : "text-gray-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <Link
          to="/dashboard/pages/$pageId"
          params={{ pageId: page.id }}
          className="text-sm font-medium text-gray-900 hover:text-[var(--color-primary)]"
        >
          {page.title}
        </Link>
        <p className="text-xs text-gray-400">{label}</p>
      </div>

      {/* Published toggle */}
      <button
        type="button"
        onClick={onToggle}
        disabled={togglingId === page.id}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
          page.is_published ? "bg-green-500" : "bg-gray-200"
        } ${togglingId === page.id ? "opacity-50" : ""}`}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            page.is_published ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>

      {/* Edit button */}
      <Link
        to="/dashboard/pages/$pageId"
        params={{ pageId: page.id }}
        className="rounded px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
      >
        Edit
      </Link>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        disabled={deletingId === page.id}
        className={`rounded px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 ${
          deletingId === page.id ? "opacity-50" : ""
        }`}
      >
        {deletingId === page.id ? "..." : "Delete"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddPageModal component
// ---------------------------------------------------------------------------

function AddPageModal({
  existingTypes,
  onAdd,
  onClose,
}: {
  existingTypes: string[];
  onAdd: (pageType: string, title: string) => void;
  onClose: () => void;
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");

  const availableTemplates = templateMetaList.filter(
    (meta) => !existingTypes.includes(meta.pageType),
  );

  const handleConfirm = () => {
    if (!selectedType) return;
    const meta = templateMetaList.find((m) => m.pageType === selectedType);
    const title = customTitle.trim() || meta?.label || selectedType;
    onAdd(selectedType, title);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 sm:pt-20">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Add a Page</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {availableTemplates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <svg className="size-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-500">All page types have been added.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">Select a page type to add:</p>

              {/* Template grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {availableTemplates.map((meta) => (
                  <button
                    key={meta.pageType}
                    type="button"
                    onClick={() => {
                      setSelectedType(meta.pageType);
                      setCustomTitle(meta.label);
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                      selectedType === meta.pageType
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor:
                          selectedType === meta.pageType
                            ? "var(--color-primary)"
                            : "#f3f4f6",
                      }}
                    >
                      <svg
                        className={`size-5 ${
                          selectedType === meta.pageType ? "text-white" : "text-gray-400"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{meta.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom title */}
              {selectedType && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Page Title
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Enter a custom title..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedType}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Page
          </button>
        </div>
      </div>
    </div>
  );
}