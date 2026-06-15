/**
 * Seeds a conversation ticket with long HTML email bodies for scroll testing.
 * Run: pnpm seed:long-email-demo
 * Reset: pnpm seed:long-email-demo -- --reset
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const DEMO_TITLE = "Long email scroll demo";
const DEMO_CONTACT = "long-email-demo@example.com";

function longEmailHtml(label: string, paragraphCount = 40): string {
  const paragraphs = Array.from({ length: paragraphCount }, (_, index) => {
    const n = index + 1;
    return `<p><strong>${label} — paragraph ${n}.</strong> Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>`;
  }).join("\n");

  return `<h2>${label}</h2>${paragraphs}<blockquote>This quoted section is also long enough to require scrolling inside the email body preview.</blockquote>${paragraphs}`;
}

function plainBody(label: string, paragraphCount = 40): string {
  return Array.from({ length: paragraphCount }, (_, index) => {
    const n = index + 1;
    return `${label} — paragraph ${n}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`;
  }).join("\n\n");
}

async function main() {
  const reset = process.argv.includes("--reset");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    console.error("Missing Supabase URL or SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  const db = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (reset) {
    const { data: existing, error: listError } = await db
      .from("tickets")
      .select("id")
      .eq("title", DEMO_TITLE);
    if (listError) {
      console.error("Failed to list demo ticket:", listError.message);
      process.exit(1);
    }
    if (existing?.length) {
      const { error: deleteError } = await db
        .from("tickets")
        .delete()
        .in(
          "id",
          existing.map((row) => row.id as string),
        );
      if (deleteError) {
        console.error("Failed to delete demo ticket:", deleteError.message);
        process.exit(1);
      }
      console.log("Removed prior long email demo ticket");
    }
  }

  const { data: existingTicket } = await db
    .from("tickets")
    .select("id")
    .eq("title", DEMO_TITLE)
    .maybeSingle();

  if (existingTicket) {
    console.log(`Demo ticket already exists: ${DEMO_TITLE}`);
    console.log("Use --reset to recreate it.");
    return;
  }

  const { data: status, error: statusError } = await db
    .from("status_types")
    .select("id")
    .eq("name", "In Process")
    .maybeSingle();
  if (statusError || !status) {
    console.error("Missing In Process status:", statusError?.message);
    process.exit(1);
  }

  let contactId: string;
  const { data: existingContact } = await db
    .from("contacts")
    .select("id")
    .eq("username", DEMO_CONTACT)
    .maybeSingle();

  if (existingContact) {
    contactId = existingContact.id as string;
  } else {
    const { data: createdContact, error: contactError } = await db
      .from("contacts")
      .insert({ username: DEMO_CONTACT })
      .select("id")
      .single();
    if (contactError || !createdContact) {
      console.error("Failed to create contact:", contactError?.message);
      process.exit(1);
    }
    contactId = createdContact.id as string;
  }

  const { data: ticket, error: ticketError } = await db
    .from("tickets")
    .insert({
      title: DEMO_TITLE,
      kind: "conversation",
      channel: "email",
      contact_address: DEMO_CONTACT,
      contact_id: contactId,
      status_id: status.id,
      origin: "manual",
    })
    .select("id")
    .single();

  if (ticketError || !ticket) {
    console.error("Failed to create demo ticket:", ticketError?.message);
    process.exit(1);
  }

  const ticketId = ticket.id as string;
  const messages = [
    {
      ticket_id: ticketId,
      body: plainBody("Incoming HTML email", 12),
      visibility: "public",
      author_type: "contact",
      channel: "email",
      email_from: DEMO_CONTACT,
      email_to: ["support@ticqex.local"],
      email_subject: "Need help with a very long issue description",
      email_body_html: longEmailHtml("Incoming HTML email", 45),
      email_message_id: `seed-long-email-inbound-${ticketId}`,
    },
    {
      ticket_id: ticketId,
      body: plainBody("Support reply", 10),
      visibility: "public",
      author_type: "agent",
      channel: "email",
      email_from: "support@ticqex.local",
      email_to: [DEMO_CONTACT],
      email_subject: "Re: Need help with a very long issue description",
      email_body_html: longEmailHtml("Support reply", 35),
      email_message_id: `seed-long-email-outbound-${ticketId}`,
    },
    {
      ticket_id: ticketId,
      body: plainBody("Follow-up from contact", 14),
      visibility: "public",
      author_type: "contact",
      channel: "email",
      email_from: DEMO_CONTACT,
      email_to: ["support@ticqex.local"],
      email_subject: "Re: Need help with a very long issue description",
      email_body_html: longEmailHtml("Follow-up from contact", 50),
      email_message_id: `seed-long-email-followup-${ticketId}`,
    },
  ];

  const { error: messagesError } = await db.from("messages").insert(messages);
  if (messagesError) {
    console.error("Failed to create demo messages:", messagesError.message);
    process.exit(1);
  }

  console.log(`Created demo ticket: ${DEMO_TITLE}`);
  console.log(`Ticket id: ${ticketId}`);
  console.log("Open the board and look for it in In Process.");
}

main();
