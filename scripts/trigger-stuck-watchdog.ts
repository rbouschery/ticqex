import { runs, tasks } from "@trigger.dev/sdk/v3";

const STUCK_STATUSES = new Set(["DEQUEUED", "QUEUED", "PENDING_VERSION"]);
const EMAIL_TASKS = new Set(["process-inbound-email", "send-outbound-email"]);
const STUCK_MS = 45_000;
const POLL_MS = 15_000;

async function recoverStuckRuns() {
  const listed = await runs.list({ limit: 100, period: "1d" });
  let recovered = 0;

  for (const run of listed.data) {
    if (!STUCK_STATUSES.has(run.status)) continue;
    if (!EMAIL_TASKS.has(run.taskIdentifier)) continue;

    const ageMs = Date.now() - new Date(run.createdAt).getTime();
    if (ageMs < STUCK_MS) continue;

    const payload = run.payload as Record<string, unknown> | undefined;
    if (!payload) continue;

    await runs.cancel(run.id);
    await tasks.trigger(run.taskIdentifier, payload, {
      idempotencyKey: `${run.id}:recovery:${Date.now()}`,
    });
    console.log(
      `recovered ${run.id} (${run.taskIdentifier}, was ${run.status}, age ${Math.round(ageMs / 1000)}s)`,
    );
    recovered++;
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
