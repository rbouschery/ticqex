import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = {
    app: "ok",
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    checks.database = "unconfigured";
    return NextResponse.json(
      {
        status: "degraded",
        checks,
        version: process.env.npm_package_version ?? "0.1.0",
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/status_types?select=id&limit=1`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
    });

    checks.database = res.ok ? "ok" : "error";
  } catch {
    checks.database = "error";
  }

  const healthy = checks.database === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      version: "0.1.0",
    },
    { status: healthy ? 200 : 503 },
  );
}
