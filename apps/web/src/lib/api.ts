import { cookies } from "next/headers";

export type WorkspacePayload = {
  id: string;
  slug: string;
  name: string;
  brands: Array<{ id: string; slug: string; name: string }>;
};
export type OverviewPayload = {
  range: { from: string; to: string };
  metrics: Array<{
    metric: string;
    value: number;
    previousValue: number | null;
    unit: string;
    currency?: string;
    source: string;
    quality: string;
    updatedAt: string;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    detail: string;
  }>;
};

export async function apiGet<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get("anycol_session")?.value;
  if (!token) return null;
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return null;
  try {
    const response = await fetch(new URL(path, baseUrl), {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
