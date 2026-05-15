import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface HemisStatEmployeeData {
  position: Record<string, number>;
  gender: Record<string, number>;
  citizenship: Record<string, number>;
  academic_degree: Record<string, { Erkak: number; Ayol: number }>;
  academic_rank: Record<string, { Erkak: number; Ayol: number }>;
  direction: Record<string, number>;
  academic: Record<string, number>;
  age: Record<string, { Erkak: number; Ayol: number }>;
  employment_form: Record<string, number>;
}

const SOURCE = "stat-employee";
const HEMIS_URL = "https://student.uzswlu.uz/rest/v1/public/stat-employee";
const CACHE_HOURS = 24;

async function fetchFromHemis(): Promise<HemisStatEmployeeData> {
  const res = await fetch(HEMIS_URL, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HEMIS responded with ${res.status}`);
  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error ?? "HEMIS returned unsuccessful response");
  }
  return json.data as HemisStatEmployeeData;
}

export async function GET() {
  const supabase = createAdminClient();

  // 1. Try Supabase — return cached snapshot if < CACHE_HOURS old
  const cutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: row } = await supabase
    .from("hemis_snapshots")
    .select("data, fetched_at")
    .eq("source", SOURCE)
    .gte("fetched_at", cutoff)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (row) {
    return NextResponse.json(
      { success: true, error: null, data: row.data, cached_at: row.fetched_at },
      { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } }
    );
  }

  // 2. Snapshot missing or stale — fetch live from HEMIS
  let data: HemisStatEmployeeData;
  try {
    data = await fetchFromHemis();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Fall back to latest snapshot even if stale rather than returning an error
    const { data: stale } = await supabase
      .from("hemis_snapshots")
      .select("data, fetched_at")
      .eq("source", SOURCE)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (stale) {
      return NextResponse.json(
        { success: true, error: null, data: stale.data, cached_at: stale.fetched_at, stale: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 3. Persist new snapshot
  await supabase.from("hemis_snapshots").insert({ source: SOURCE, data });

  return NextResponse.json(
    { success: true, error: null, data },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } }
  );
}
