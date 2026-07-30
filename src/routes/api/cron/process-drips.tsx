import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/process-drips")({
  loader: async () => {
    // Dynamically import to ensure SSR-only execution
    const { processPendingDrips } = await import(
      "~/lib/server/email-drip"
    );
    const result = await processPendingDrips();
    return result;
  },
  component: ProcessDripsResult,
});

function ProcessDripsResult() {
  const data = Route.useLoaderData();
  return (
    <pre style={{ padding: "1rem", fontFamily: "monospace", fontSize: "14px" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
