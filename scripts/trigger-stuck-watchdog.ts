import { runs, tasks } from "@trigger.dev/sdk/v3";

const STUCK_STATUSES = new Set(["DEQUEUED", "QUEUED", "PENDING_VERSION"]);
const EMAIL_TASKS = new Set(["process-inbound-email", "send-outbound-email"]);
/** Inbound email: recover faster — Resend webhook 200 only means queued, not processed. */
const STUCK_MS_BY_TASK: Record<string, number> = {
  "process-inbound-email": 12_000,
  "send-outbound-email": 20_000,
};
const DEFAULT_STUCK_MS = 20_000;
const POLL_MS = 10_000;

/** Runs we already spawned a recovery trigger for (avoid loops). */
const recoveryAttempted = new Set<string>();

async function recoverStuckRuns() {
  const listed = await runs.list({ limit: 100, period: "1d" });
  let recovered = 0;

  for (const run of listed.data) {
    if (!STUCK_STATUSES.has(run.status)) continue;
    if (!EMAIL_TASKS.has(run.taskIdentifier)) continue;
    if (recoveryAttempted.has(run.id)) continue;

    const ageMs = Date.now() - new Date(run.createdAt).getTime();
    const stuckMs = STUCK_MS_BY_TASK[run.taskIdentifier] ?? DEFAULT_STUCK_MS;
    if (ageMs < stuckMs) continue;

    const full = await runs.retrieve(run.id);
    const payload = full.payload as Record<string, unknown> | undefined;
    if (!payload) {
      console.warn(`skip ${run.id}: no payload on retrieve`);
      continue;
    }

    recoveryAttempted.add(run.id);

    // Re-trigger first — canceling before dispatch orphans runs on the server.
    await tasks.trigger(full.taskIdentifier, payload, {
      idempotencyKey: `${run.id}:recovery:${Date.now()}`,
    });
    console.log(
      `recovered ${run.id} (${full.taskIdentifier}, was ${run.status}, age ${Math.round(ageMs / 1000)}s)`,
    );
    recovered++;

    // Best-effort cleanup of the stuck run record (non-blocking for delivery).
    runs.cancel(run.id).catch(() => {});
  }

  if (recovered) {
    console.log(`Recovered ${recovered} stuck run(s).`);
  }
}

async function main() {
  console.log("Trigger.dev stuck-run watchdog started.");
  for (;;) {
    try {
      await recoverStuckRuns();
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
