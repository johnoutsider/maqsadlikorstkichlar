import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFENSE_STORAGE_BUCKET, findDefenseDocument } from "@/lib/defense-config";
import type { DefenseApplication, RoleName } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; docKey: string }>;
}

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function canDownloadDefenseApplication(
  role: RoleName,
  profile: { university_id: string | null; department_id: string | null },
  application: { university_id: string; department_id: string | null }
) {
  if (role === "super_admin") return true;
  if (profile.university_id !== application.university_id) return false;
  if (["university_admin", "science_department", "vice_rector"].includes(role)) return true;
  return role === "staff_manager" && profile.department_id === application.department_id;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id, docKey } = await context.params;
  const document = findDefenseDocument(docKey);
  if (!document) return bad("Noma'lum hujjat turi.", 404);

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return bad("Tizimga kirish talab qilinadi.", 401);

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("university_id, department_id, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError || !profile) return bad("Foydalanuvchi huquqlarini aniqlab bo'lmadi.", 403);

  const role = (profile as typeof profile & { roles: { name: RoleName } }).roles.name;
  const admin = createAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("defense_applications")
    .select("id, university_id, department_id, reference_code, documents")
    .eq("id", id)
    .maybeSingle();

  if (applicationError) return bad(applicationError.message, 500);
  if (!application) return bad("Ariza topilmadi.", 404);

  if (
    !canDownloadDefenseApplication(
      role,
      { university_id: profile.university_id, department_id: profile.department_id },
      { university_id: application.university_id, department_id: application.department_id }
    )
  ) {
    return bad("Ushbu hujjatni yuklab olishga ruxsat yo'q.", 403);
  }

  const documents = (application.documents ?? {}) as DefenseApplication["documents"];
  const filePaths = documents[docKey] ?? [];
  if (filePaths.length === 0) return bad("Ushbu hujjat uchun yuklangan fayl yo'q.", 404);

  const expectedPrefix = `${id}/${docKey}/`;
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (let index = 0; index < filePaths.length; index += 1) {
    const path = filePaths[index];
    if (typeof path !== "string" || !path.startsWith(expectedPrefix) || path.includes("..")) {
      return bad("Hujjat manzili noto'g'ri.", 422);
    }

    const { data: file, error: fileError } = await admin.storage.from(DEFENSE_STORAGE_BUCKET).download(path);
    if (fileError || !file) {
      return bad(`Fayl topilmadi: ${path.split("/").pop() ?? "fayl"}.`, 404);
    }

    const rawName = path.split("/").pop() ?? `file-${index + 1}`;
    const cleanName = rawName.replace(/^\d+_/, "");
    let entryName = cleanName;
    let suffix = 2;
    while (usedNames.has(entryName.toLowerCase())) {
      const dot = cleanName.lastIndexOf(".");
      const base = dot > 0 ? cleanName.slice(0, dot) : cleanName;
      const extension = dot > 0 ? cleanName.slice(dot) : "";
      entryName = `${base} (${suffix})${extension}`;
      suffix += 1;
    }
    usedNames.add(entryName.toLowerCase());
    zip.file(entryName, await file.arrayBuffer());
  }

  if (filePaths.length === 1) {
    const onlyPath = filePaths[0];
    const { data: file, error: fileError } = await admin.storage.from(DEFENSE_STORAGE_BUCKET).download(onlyPath);
    if (fileError || !file) return bad("Fayl topilmadi.", 404);

    const cleanName = (onlyPath.split("/").pop() ?? "fayl").replace(/^\d+_/, "");
    const buffer = new Uint8Array(await file.arrayBuffer());
    return new Response(buffer.buffer, {
      status: 200,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${cleanName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const responseBody = new Uint8Array(archive.length);
  responseBody.set(archive);
  const archiveName = `${application.reference_code}-${docKey}.zip`;

  return new Response(responseBody.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archiveName}"`,
      "Content-Length": String(archive.length),
      "Cache-Control": "private, no-store",
    },
  });
}
