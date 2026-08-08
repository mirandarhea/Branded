/**
 * Dashboard — Page Editor
 *
 * Split-pane layout showing a live preview of the page alongside editing controls.
 * For each page_type, renders editable fields dynamically based on the template's content schema.
 */
import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import type { Page } from "~/lib/db";
import { renderTemplate, TemplateSkeleton, TemplateErrorState, templateMetaList } from "~/lib/templates";
import type { BusinessInfo, PageContent } from "~/lib/templates";
import {
  TextEditor,
  ImageUploader,
  ListEditor,
  ToggleField,
  ScheduleEditor,
  createDefaultSchedule,
  PricingEditor,
  createDefaultTier,
} from "~/lib/page-editor";
import type { ScheduleDay, PricingTier } from "~/lib/page-editor";

// ---------------------------------------------------------------------------
// API helpers (replaces createServerFn — uses fetch() for production)
// ---------------------------------------------------------------------------

async function loadPageApi(payload: { sessionToken: string; pageId: string; businessId: string }) {
  const res = await fetch("/api/dashboard/pages/get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function savePageApi(payload: {
  sessionToken: string;
  pageId: string;
  businessId: string;
  title: string;
  contentJson: Record<string, unknown>;
  isPublished?: number;
}) {
  const res = await fetch("/api/dashboard/pages/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/dashboard/pages/$pageId")({
  component: PageEditor,
  pendingComponent: () => (
    <div className="flex items-center justify-center py-20">
      <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--color-primary)]" />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Mock business info for preview
// ---------------------------------------------------------------------------

const MOCK_BUSINESS: BusinessInfo = {
  name: "My Business",
  slug: "my-business",
  primaryColor: "#4f46e5",
  secondaryColor: "#7c3aed",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PageEditor() {
  const navigate = useNavigate();
  const { pageId } = Route.useParams();
  const [page, setPage] = useState<Page | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  // Load page on mount
  useEffect(() => {
    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("branded_session_token") : null;
    const businessId = typeof window !== "undefined" ? localStorage.getItem("branded_business_id") : null;

    if (!sessionToken || !businessId) {
      setError("Please log in");
      setLoading(false);
      return;
    }

    loadPageApi({ sessionToken, pageId, businessId }).then((result) => {
      setLoading(false);
      if (result.error) {
        setError(result.error as string);
        return;
      }
      const p = result.page as Page;
      if (!p) {
        setError("Page not found");
        return;
      }
      setPage(p);
      setTitle(p.title);
      setContent(JSON.parse(p.content_json || "{}"));
    });
  }, [pageId]);

  const handleSave = async (publish?: boolean) => {
    setSaving(true);
    setSaved(false);

    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("branded_session_token") : null;
    const businessId = typeof window !== "undefined" ? localStorage.getItem("branded_business_id") : null;
    if (!sessionToken || !businessId || !page) return;

    await savePageApi({
      sessionToken,
      pageId,
      businessId,
      title,
      contentJson: content,
      isPublished: publish !== undefined ? (publish ? 1 : 0) : undefined,
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateContent = (key: string, value: unknown) => {
    setContent((prev) => ({ ...prev, [key]: value }));
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
  if (error || !page) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <svg className="size-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-900">{error || "Page not found"}</h2>
        <Link to="/dashboard/pages" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
          Back to pages
        </Link>
      </div>
    );
  }

  const meta = templateMetaList.find((m) => m.pageType === page.page_type);
  const pageTypeLabel = meta?.label || page.page_type;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/pages"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base font-semibold text-gray-900 focus:outline-none focus:border-b focus:border-[var(--color-primary)] bg-transparent"
              placeholder="Page title"
            />
            <p className="text-xs text-gray-400">{pageTypeLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Preview toggle */}
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showPreview
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>

          {/* Save indicator */}
          {saved && (
            <span className="text-xs font-medium text-green-600">Saved!</span>
          )}

          {/* Save as draft */}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>

          {/* Publish / Unpublish */}
          <button
            type="button"
            onClick={() => handleSave(!page.is_published)}
            disabled={saving}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${
              page.is_published ? "bg-amber-500" : "bg-green-600"
            }`}
          >
            {page.is_published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Edit panel */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <PageFieldsEditor
            pageType={page.page_type}
            content={content}
            onChange={updateContent}
          />
        </div>

        {/* Preview panel */}
        {showPreview && (
          <div className="hidden w-[480px] shrink-0 border-l border-gray-200 bg-gray-50 lg:block">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
              <span className="text-xs font-medium text-gray-500">Mobile Preview</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Preview
              </span>
            </div>
            <div className="mx-auto my-4 h-[720px] w-[360px] overflow-y-auto rounded-2xl border-4 border-gray-800 bg-white shadow-xl">
              <div className="p-3">
                <div
                  className="rounded-lg px-3 py-2 text-white text-sm font-semibold"
                  style={{ backgroundColor: MOCK_BUSINESS.primaryColor }}
                >
                  {title}
                </div>
                <div className="mt-3">
                  {renderTemplate(
                    page.page_type as Parameters<typeof renderTemplate>[0],
                    MOCK_BUSINESS,
                    content as PageContent,
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageFieldsEditor — renders the right editing fields for each page type
// ---------------------------------------------------------------------------

function PageFieldsEditor({
  pageType,
  content,
  onChange,
}: {
  pageType: string;
  content: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  switch (pageType) {
    case "bio":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Headline"
            value={(content.headline as string) || ""}
            onChange={(v) => onChange("headline", v)}
            placeholder="Welcome to our business!"
            mode="text"
          />
          <TextEditor
            label="About Text"
            value={(content.aboutText as string) || ""}
            onChange={(v) => onChange("aboutText", v)}
            placeholder="Tell your story..."
            mode="rich"
            rows={6}
          />
          <TextEditor
            label="Mission Statement"
            value={(content.mission as string) || ""}
            onChange={(v) => onChange("mission", v)}
            placeholder="Our mission..."
            mode="textarea"
            rows={3}
          />
          <ImageUploader
            label="Hero Image"
            value={(content.imageUrl as string) || null}
            onChange={(v) => onChange("imageUrl", v)}
            aspectRatio="21/9"
          />
        </div>
      );

    case "team":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Our Team"
          />
          <ListEditor
            label="Team Members"
            items={(content.members as Array<{ id: string; name: string; role: string; bio: string; photoUrl: string }>) || []}
            onChange={(v) => onChange("members", v)}
            createNew={() => ({
              id: `member-${Date.now()}`,
              name: "",
              role: "",
              bio: "",
              photoUrl: "",
            })}
            addLabel="Add Member"
            renderItem={(item, _index, onItemChange) => (
              <div className="space-y-3">
                <ImageUploader
                  label="Photo"
                  value={(item.photoUrl as string) || null}
                  onChange={(v) => onItemChange({ ...item, photoUrl: v || "" })}
                  aspectRatio="1/1"
                />
                <TextEditor
                  label="Name"
                  value={(item.name as string) || ""}
                  onChange={(v) => onItemChange({ ...item, name: v })}
                  placeholder="John Doe"
                />
                <TextEditor
                  label="Role"
                  value={(item.role as string) || ""}
                  onChange={(v) => onItemChange({ ...item, role: v })}
                  placeholder="Owner & Founder"
                />
                <TextEditor
                  label="Bio"
                  value={(item.bio as string) || ""}
                  onChange={(v) => onItemChange({ ...item, bio: v })}
                  placeholder="Brief bio..."
                  mode="textarea"
                  rows={3}
                />
              </div>
            )}
          />
        </div>
      );

    case "hours":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Business Hours"
          />
          <ScheduleEditor
            label="Weekly Schedule"
            value={(content.schedule as ScheduleDay[]) || createDefaultSchedule()}
            onChange={(v) => onChange("schedule", v)}
          />
          <TextEditor
            label="Special Notes"
            value={(content.notes as string) || ""}
            onChange={(v) => onChange("notes", v)}
            placeholder="Holiday hours, special closures..."
            mode="textarea"
            rows={2}
          />
        </div>
      );

    case "contact":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Contact Us"
          />
          <TextEditor
            label="Email"
            value={(content.email as string) || ""}
            onChange={(v) => onChange("email", v)}
            placeholder="hello@example.com"
          />
          <TextEditor
            label="Phone"
            value={(content.phone as string) || ""}
            onChange={(v) => onChange("phone", v)}
            placeholder="(555) 123-4567"
          />
          <TextEditor
            label="Address"
            value={(content.address as string) || ""}
            onChange={(v) => onChange("address", v)}
            placeholder="123 Main St, City, State 12345"
            mode="textarea"
            rows={2}
          />
          <TextEditor
            label="Map Embed URL"
            value={(content.mapEmbedUrl as string) || ""}
            onChange={(v) => onChange("mapEmbedUrl", v)}
            placeholder="https://maps.google.com/..."
            helpText="Optional Google Maps embed URL"
          />
        </div>
      );

    case "pricing":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Services & Pricing"
          />
          <PricingEditor
            label="Pricing Tiers"
            value={(content.tiers as PricingTier[]) || []}
            onChange={(v) => onChange("tiers", v)}
          />
        </div>
      );

    case "gallery":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Photo Gallery"
          />
          <ListEditor
            label="Gallery Images"
            items={(content.images as Array<{ id: string; url: string; caption: string }>) || []}
            onChange={(v) => onChange("images", v)}
            createNew={() => ({
              id: `img-${Date.now()}`,
              url: "",
              caption: "",
            })}
            addLabel="Add Image"
            renderItem={(item, _index, onItemChange) => (
              <div className="space-y-3">
                <ImageUploader
                  label="Image"
                  value={(item.url as string) || null}
                  onChange={(v) => onItemChange({ ...item, url: v || "" })}
                  aspectRatio="4/3"
                />
                <TextEditor
                  label="Caption"
                  value={(item.caption as string) || ""}
                  onChange={(v) => onItemChange({ ...item, caption: v })}
                  placeholder="Optional caption..."
                />
              </div>
            )}
          />
        </div>
      );

    case "photo-submission":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Submit a Photo"
          />
          <TextEditor
            label="Instructions"
            value={(content.instructions as string) || ""}
            onChange={(v) => onChange("instructions", v)}
            placeholder="Share your photos with us..."
            mode="textarea"
            rows={3}
          />
          <ToggleField
            label="Require Approval"
            description="New photos need admin approval before being visible"
            value={(content.requireApproval as boolean) ?? true}
            onChange={(v) => onChange("requireApproval", v)}
          />
        </div>
      );

    case "quote-request":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Request a Quote"
          />
          <ListEditor
            label="Services"
            items={(content.services as Array<{ id: string; name: string; description: string }>) || []}
            onChange={(v) => onChange("services", v)}
            createNew={() => ({
              id: `svc-${Date.now()}`,
              name: "",
              description: "",
            })}
            addLabel="Add Service"
            renderItem={(item, _index, onItemChange) => (
              <div className="space-y-3">
                <TextEditor
                  label="Service Name"
                  value={(item.name as string) || ""}
                  onChange={(v) => onItemChange({ ...item, name: v })}
                  placeholder="e.g., Web Design"
                />
                <TextEditor
                  label="Description"
                  value={(item.description as string) || ""}
                  onChange={(v) => onItemChange({ ...item, description: v })}
                  placeholder="Brief description..."
                  mode="textarea"
                  rows={2}
                />
              </div>
            )}
          />
        </div>
      );

    case "appointments":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Book an Appointment"
          />
          <ListEditor
            label="Services"
            items={(content.services as Array<{ id: string; name: string; duration: number; price: string }>) || []}
            onChange={(v) => onChange("services", v)}
            createNew={() => ({
              id: `svc-${Date.now()}`,
              name: "",
              duration: 60,
              price: "",
            })}
            addLabel="Add Service"
            renderItem={(item, _index, onItemChange) => (
              <div className="space-y-3">
                <TextEditor
                  label="Service Name"
                  value={(item.name as string) || ""}
                  onChange={(v) => onItemChange({ ...item, name: v })}
                  placeholder="e.g., 1-Hour Massage"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Duration (minutes)</label>
                    <input
                      type="number"
                      value={(item.duration as number) || 60}
                      onChange={(e) => onItemChange({ ...item, duration: parseInt(e.target.value) || 60 })}
                      min={15}
                      step={15}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Price</label>
                    <input
                      type="text"
                      value={(item.price as string) || ""}
                      onChange={(e) => onItemChange({ ...item, price: e.target.value })}
                      placeholder="$80"
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
                  </div>
                </div>
              </div>
            )}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Default Duration (minutes)</label>
              <input
                type="number"
                value={(content.durationMinutes as number) || 60}
                onChange={(e) => onChange("durationMinutes", parseInt(e.target.value) || 60)}
                min={15}
                step={15}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Buffer (minutes)</label>
              <input
                type="number"
                value={(content.bufferMinutes as number) || 0}
                onChange={(e) => onChange("bufferMinutes", parseInt(e.target.value) || 0)}
                min={0}
                step={5}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>
          </div>
        </div>
      );

    case "messaging":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Messages"
          />
          <ToggleField
            label="Auto Reply"
            description="Automatically send a welcome message to new conversations"
            value={(content.autoReply as boolean) ?? false}
            onChange={(v) => onChange("autoReply", v)}
          />
          {content.autoReply && (
            <TextEditor
              label="Auto Reply Message"
              value={(content.autoReplyMessage as string) || ""}
              onChange={(v) => onChange("autoReplyMessage", v)}
              placeholder="Thanks for reaching out! We'll get back to you shortly."
              mode="textarea"
              rows={3}
            />
          )}
          <ToggleField
            label="AI Assistant"
            description="Let AI answer common questions when you're away"
            value={(content.aiAssistant as boolean) ?? false}
            onChange={(v) => onChange("aiAssistant", v)}
          />
        </div>
      );

    case "bill-pay":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="Pay Your Bill"
          />
          <ToggleField
            label="Allow Custom Amount"
            description="Let customers enter any amount instead of preset amounts"
            value={(content.allowCustomAmount as boolean) ?? true}
            onChange={(v) => onChange("allowCustomAmount", v)}
          />
          <ListEditor
            label="Preset Amounts"
            items={(content.presetAmounts as Array<{ id: string; label: string; amount: number }>) || []}
            onChange={(v) => onChange("presetAmounts", v)}
            createNew={() => ({
              id: `amt-${Date.now()}`,
              label: "",
              amount: 0,
            })}
            addLabel="Add Amount"
            renderItem={(item, _index, onItemChange) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextEditor
                  label="Label"
                  value={(item.label as string) || ""}
                  onChange={(v) => onItemChange({ ...item, label: v })}
                  placeholder="e.g., Monthly"
                />
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Amount (cents)</label>
                  <input
                    type="number"
                    value={(item.amount as number) || 0}
                    onChange={(e) => onItemChange({ ...item, amount: parseInt(e.target.value) || 0 })}
                    min={0}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                </div>
              </div>
            )}
          />
        </div>
      );

    case "account-view":
      return (
        <div className="space-y-4">
          <TextEditor
            label="Section Title"
            value={(content.title as string) || ""}
            onChange={(v) => onChange("title", v)}
            placeholder="My Account"
          />
          <ToggleField
            label="Show Balance"
            description="Display the customer's current balance"
            value={(content.showBalance as boolean) ?? true}
            onChange={(v) => onChange("showBalance", v)}
          />
          <ToggleField
            label="Show Transaction History"
            description="Display the customer's transaction history"
            value={(content.showHistory as boolean) ?? true}
            onChange={(v) => onChange("showHistory", v)}
          />
        </div>
      );

    default:
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <svg className="size-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-500">No editor available for this page type.</p>
        </div>
      );
  }
}