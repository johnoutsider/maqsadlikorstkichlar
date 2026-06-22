import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IndicatorSubmission, RoleName } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ indicatorId: string }>;
}

const ADMIN_ROLES: RoleName[] = [
  "super_admin",
  "university_admin",
  "vice_rector",
  "science_department",
];

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanFileName(value: string, fallback: string) {
  const cleaned = value.replace(/^\d+_/, "").replace(/[\\/]+/g, "_").trim();
  return cleaned || fallback;
}

function uniqueFileName(name: string, usedNames: Set<string>) {
  if (!usedNames.has(name.toLowerCase())) {
    usedNames.add(name.toLowerCase());
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  let candidate = `${base} (${index})${extension}`;
  while (usedNames.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${base} (${index})${extension}`;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export async function GET(request: Request, context: RouteContext) {
  const { indicatorId } = await context.params;
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const quarter = searchParams.get("quarter");

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return bad("Tizimga kirish talab qilinadi.", 401);

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("university_id, roles!users_role_id_fkey!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();
  if (profileError || !profile) return bad("Foydalanuvchi huquqlarini aniqlab bo'lmadi.", 403);

  const role = (profile as typeof profile & { roles: { name: RoleName } }).roles.name;
  if (!ADMIN_ROLES.includes(role)) {
    return bad("Ushbu fayllarni yuklab olishga ruxsat yo'q.", 403);
  }

  const admin = createAdminClient();
  const { data: indicator } = await admin
    .from("indicators")
    .select("no, name")
    .eq("id", indicatorId)
    .eq("university_id", profile.university_id)
    .maybeSingle();
  if (!indicator) return bad("Ko'rsatkich topilmadi.", 404);

  let query = admin
    .from("submissions")
    .select("indicators")
    .eq("university_id", profile.university_id);
  if (year) query = query.eq("year", Number(year));
  if (quarter) query = query.eq("quarter", quarter);

  const { data: submissions, error: submissionsError } = await query;
  if (submissionsError) return bad(submissionsError.message, 500);

  const filePaths = (submissions ?? []).flatMap((s) => {
    const indicators = (s.indicators ?? {}) as Record<string, IndicatorSubmission>;
    return indicators[indicatorId]?.files ?? [];
  }).filter((p): p is string => typeof p === "string" && !p.includes(".."));

  if (filePaths.length === 0) {
    return bad("Ushbu ko'rsatkich uchun yuklanadigan fayl yo'q.", 404);
  }

  // Signed URLs are valid for 2 hours — enough time to stream 1000 files even on
  // a slow connection. Generating them is cheap; no file bytes touch the server.
  const { data: signed, error: signError } = await admin.storage
    .from("submissions")
    .createSignedUrls(filePaths, 60 * 60 * 2);
  if (signError) return bad(signError.message, 500);

  const usedNames = new Set<string>();
  const files = (signed ?? [])
    .filter((s) => s.signedUrl && !s.error)
    .map((s, index) => {
      const rawName = (s.path ?? "").split("/").pop() ?? `file-${index + 1}`;
      const cleanName = cleanFileName(rawName, `file-${index + 1}`);
      return { url: s.signedUrl, name: uniqueFileName(cleanName, usedNames) };
    });

  if (files.length === 0) return bad("Yuklab olinadigan fayl topilmadi.", 404);

  const folderName = `${indicator.no}. ${indicator.name}`.replace(/[\\/]+/g, "_");
  const zipName = `${folderName}${year ? `-${year}` : ""}${quarter ? `-${quarter}` : ""}.zip`;

  return NextResponse.json({ folderName, zipName, files });
}
