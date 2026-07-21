import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isMcpRoute(pathname: string) {
  return pathname === "/api/mcp" || pathname.startsWith("/api/mcp/");
}

function isWellKnownRoute(pathname: string) {
  return pathname === "/.well-known" || pathname.startsWith("/.well-known/");
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isHealth = pathname === "/api/health";
  const isMcp = isMcpRoute(pathname);
  const isWebhook = pathname.startsWith("/api/webhooks");
  const isWellKnown = isWellKnownRoute(pathname);
  const isApiV1 = pathname.startsWith("/api/v1");

  // Skip login redirect for machine clients (MCP, webhooks, OAuth probes).
  if (isHealth || isMcp || isWebhook || isWellKnown) {
    return NextResponse.next({ request });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    if (pathname.startsWith("/login") || isApiV1) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // API routes: refresh session cookies, but let handlers return 401 JSON
  if (isApiV1) {
    return supabaseResponse;
  }

  const isLogin = pathname.startsWith("/login");
  const isPublicApi = pathname.startsWith("/api/auth");

  if (!user && !isLogin && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/board";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
