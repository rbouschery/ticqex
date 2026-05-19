import type { NextRequest } from "next/server";
import { ApiError } from "./errors";
import { handleRouteError, jsonError } from "./response";
import {
  authenticateRequest,
  requireAdmin,
  type AuthContext,
} from "@server/middleware/auth";

type RouteOptions = {
  admin?: boolean;
};

export async function withAuth(
  request: NextRequest,
  handler: (auth: AuthContext, request: NextRequest) => Promise<Response>,
  options: RouteOptions = {},
): Promise<Response> {
  try {
    const auth = await authenticateRequest(request);
    if (options.admin) requireAdmin(auth);
    return await handler(auth, request);
  } catch (err) {
    if (err instanceof Error && !(err instanceof ApiError)) {
      if (err.message.includes("Invalid") || err.message.includes("required")) {
        return jsonError(ApiError.badRequest(err.message));
      }
    }
    return handleRouteError(err);
  }
}

export async function parseJsonBody<T>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw ApiError.badRequest("Invalid JSON body");
  }
}
