import { runs, tasks } from "@trigger.dev/sdk/v3";

async function main() {
  const suffix = Date.now();
  const handle = await tasks.trigger(
    "process-inbound-email",
    {
      raw: {
        type: "email.received",
        data: {
          email_id: `smoke-test-${suffix}`,
          from: "smoke@test.local",
          to: ["support@ticqex.local"],
          subject: "Trigger smoke test",
          message_id: `<smoke-${suffix}@test.local>`,
        },
      },
    },
    { idempotencyKey: `smoke:${suffix}` },
  );

  for (let i = 0; i < 30; i++) {
    const run = await runs.retrieve(handle.id);
    if (
      run.status === "COMPLETED" ||
      run.status === "FAILED" ||
      run.status === "CRASHED"
    ) {
      console.log(
        JSON.stringify({
          ok: run.status === "COMPLETED",
          status: run.status,
          output: run.output,
          error: run.error,
        }),
      );
      process.exit(run.status === "COMPLETED" ? 0 : 1);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.error(JSON.stringify({ ok: false, error: "timeout" }));
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
