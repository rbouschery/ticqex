import { NextResponse } from "next/server";
import { ApiError } from "./errors";

export function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function jsonList<T>(
  data: T[],
  meta: { total: number; page: number; per_page: number; filters?: Record<string, unknown> },
  status = 200,
) {
  return NextResponse.json({ data, meta }, { status });
}

export function jsonError(error: ApiError) {
  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status },
  );
}

export function handleRouteError(err: unknown) {
  if (err instanceof ApiError) return jsonError(err);
  console.error(err);
  return jsonError(ApiError.internal());
}
