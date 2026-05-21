import { Resend } from "resend";

const webhookClient = new Resend("");

export function verifySvixWebhook(
  payload: string,
  headers: Headers,
  webhookSecret: string | undefined,
): boolean {
  if (!webhookSecret) return process.env.NODE_ENV !== "production";

  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;

  try {
    webhookClient.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
    return true;
  } catch {
    return false;
  }
}
