import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface GenderCount {
  Erkak: number;
  Ayol: number;
}

export interface BMCount {
  Bakalavr: number;
  Magistr: number;
}

export interface HemisStatStudentData {
  education_type: Record<string, GenderCount>;
  age: Record<string, Record<string, GenderCount>>;
  payment: Record<string, BMCount>;
  region: Record<string, BMCount>;
  citizenship: Record<string, BMCount>;
  accommodation: Record<string, BMCount>;
  education_form: Record<string, Record<string, GenderCount>>;
  level: Record<string, Record<string, Record<string, number>>>;
}

const SOURCE = "stat-student";
const HEMIS_URL = "https://student.uzswlu.uz/rest/v1/public/stat-student";
const CACHE_HOURS = 24;

async function fetchFromHemis(): Promise<HemisStatStudentData> {
  const res = await fetch(HEMIS_URL, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HEMIS responded with ${res.status}`);
  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error ?? "HEMIS returned unsuccessful response");
  }
  return json.data as HemisStatStudentData;
}

export async function GET() {
  const supabase = createAdminClient();

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

  let data: HemisStatStudentData;
  try {
    data = await fetchFromHemis();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

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

  await supabase.from("hemis_snapshots").insert({ source: SOURCE, data });

  return NextResponse.json(
    { success: true, error: null, data },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } }
  );
}
