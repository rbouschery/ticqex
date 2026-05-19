import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let staff: { username: string; role: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("username, role")
      .eq("id", user.id)
      .single();
    staff = data;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Ticqex
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Phase 0 foundation is running. The Kanban admin arrives in Phase 2.
        </p>
        {staff && (
          <p className="mt-4 text-sm text-zinc-500">
            Signed in as <span className="font-medium">{staff.username}</span>{" "}
            ({staff.role})
          </p>
        )}
      </div>
      <Link
        href="/api/health"
        className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Health check
      </Link>
    </div>
  );
}
