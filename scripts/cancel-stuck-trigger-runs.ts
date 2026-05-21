import { runs } from "@trigger.dev/sdk/v3";

const STUCK_STATUSES = new Set([
  "DEQUEUED",
  "EXECUTING",
  "QUEUED",
  "PENDING_VERSION",
]);

async function main() {
  const listed = await runs.list({ limit: 100, period: "1d" });
  let cancelled = 0;

  for (const run of listed.data) {
    if (!STUCK_STATUSES.has(run.status)) continue;
    await runs.cancel(run.id);
    console.log(`cancelled ${run.id} (${run.taskIdentifier}, ${run.status})`);
    cancelled++;
  }

  console.log(cancelled ? `Cancelled ${cancelled} stuck run(s).` : "No stuck runs found.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
