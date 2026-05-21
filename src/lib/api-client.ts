"use client";

type ApiResponse<T> = { data: T } | { error: { code: string; message: string } };

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const json = (await res.json()) as ApiResponse<T>;
  if ("error" in json) {
    throw new Error(json.error.message);
  }
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return json.data;
}

export async function apiFetchText(path: string): Promise<string> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error("Request failed");
  return res.text();
}
