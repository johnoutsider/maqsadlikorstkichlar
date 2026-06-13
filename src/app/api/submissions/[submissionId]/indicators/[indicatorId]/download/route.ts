import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  IndicatorSubmission,
  RoleName,
  SubmissionStatus,
} from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    submissionId: string;
    indicatorId: string;
  }>;
}

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanFileName(value: string, fallback: string) {
  const cleaned = value
    .replace(/^\d+_/, "")
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "_")
    .trim();
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

function archiveFileName(year: number, quarter: string, indicatorNo: string) {
  const safeIndicator = indicatorNo.replace(/[^a-zA-Z0-9._-]+/g, "_") || "indicator";
  return `hisobot-${year}-${quarter}-${safeIndicator}.zip`;
}

function canDownloadSubmission(
  role: RoleName,
  profile: {
    university_id: string | null;
    faculty_id: string | null;
  },
  submission: {
    university_id: string;
    faculty_id: string;
    status: SubmissionStatus;
  }
) {
  if (role === "super_admin") return true;
  if (profile.university_id !== submission.university_id) return false;
  if (["university_admin", "vice_rector", "science_department"].includes(role)) {
    return true;
  }
  return (
    role === "dean"
    && profile.faculty_id === submission.faculty_id
    && submission.status !== "draft"
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { submissionId, indicatorId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return bad("Tizimga kirish talab qilinadi.", 401);

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("university_id, faculty_id, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError || !profile) {
    return bad("Foydalanuvchi huquqlarini aniqlab bo'lmadi.", 403);
  }

  const role = (profile as typeof profile & { roles: { name: RoleName } }).roles.name;
  const admin = createAdminClient();
  const { data: submission, error: submissionError } = await admin
    .from("submissions")
    .select("id, university_id, faculty_id, department_id, year, quarter, status, indicators")
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) return bad(submissionError.message, 500);
  if (!submission) return bad("Hisobot topilmadi.", 404);
  if (
    !canDownloadSubmission(
      role,
      {
        university_id: profile.university_id,
        faculty_id: profile.faculty_id,
      },
      {
        university_id: submission.university_id,
        faculty_id: submission.faculty_id,
        status: submission.status as SubmissionStatus,
      }
    )
  ) {
    return bad("Ushbu hisobot fayllarini yuklab olishga ruxsat yo'q.", 403);
  }

  const indicators =
    submission.indicators && typeof submission.indicators === "object"
      ? (submission.indicators as Record<string, IndicatorSubmission>)
      : {};
  const filePaths = indicators[indicatorId]?.files ?? [];

  if (filePaths.length === 0) {
    return bad("Ushbu ko'rsatkich uchun yuklanadigan fayl yo'q.", 404);
  }

  const { data: indicator } = await admin
    .from("indicators")
    .select("no")
    .eq("id", indicatorId)
    .eq("university_id", submission.university_id)
    .maybeSingle();

  const zip = new JSZip();
  const usedNames = new Set<string>();
  const expectedPrefix =
    `${submission.university_id}/${submission.year}/${submission.quarter}/`
    + `${submission.department_id}/${indicatorId}/`;

  for (let index = 0; index < filePaths.length; index += 1) {
    const path = filePaths[index];
    if (
      typeof path !== "string"
      || !path.startsWith(expectedPrefix)
      || path.includes("..")
    ) {
      return bad("Hisobotdagi fayl manzili noto'g'ri.", 422);
    }

    const { data: file, error: fileError } = await admin.storage
      .from("submissions")
      .download(path);

    if (fileError || !file) {
      return bad(
        `Arxiv yaratilmadi: ${path.split("/").pop() ?? "fayl"} topilmadi yoki ruxsat berilmagan.`,
        404
      );
    }

    const rawName = path.split("/").pop() ?? `file-${index + 1}`;
    const cleanName = cleanFileName(rawName, `file-${index + 1}`);
    const entryName = uniqueFileName(cleanName, usedNames);
    zip.file(entryName, await file.arrayBuffer());
  }

  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const fileName = archiveFileName(
    submission.year,
    submission.quarter,
    indicator?.no ?? indicatorId
  );
  const responseBody = new Uint8Array(archive.length);
  responseBody.set(archive);

  return new Response(responseBody.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(archive.length),
      "Cache-Control": "private, no-store",
    },
  });
}
