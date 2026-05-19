export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string) {
    return new ApiError("bad_request", message, 400);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError("unauthorized", message, 401);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError("forbidden", message, 403);
  }

  static notFound(message: string) {
    return new ApiError("not_found", message, 404);
  }

  static conflict(message: string) {
    return new ApiError("conflict", message, 409);
  }

  static internal(message = "Internal server error") {
    return new ApiError("internal", message, 500);
  }
}
