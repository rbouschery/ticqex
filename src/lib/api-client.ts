"use client";

import { createClient } from "@/lib/supabase/client";

type ApiResponse<T> = { data: T } | { error: { code: string; message: string } };

async function getAuthHeader(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return `Bearer ${token}`;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const auth = await getAuthHeader();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
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
  const auth = await getAuthHeader();
  const res = await fetch(path, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error("Request failed");
  return res.text();
}
