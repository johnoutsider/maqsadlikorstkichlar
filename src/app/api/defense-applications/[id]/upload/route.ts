import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateFile, safeStorageFileName } from "@/lib/upload-validation";
import { DEFENSE_STORAGE_BUCKET, defenseDocumentRule, findDefenseDocument } from "@/lib/defense-config";
import type { DefenseApplication } from "@/types/db";

export const runtime = "nodejs";

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: application, error: fetchError } = await admin
    .from("defense_applications")
    .select("id, status, documents")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return bad(fetchError.message, 500);
  if (!application) return bad("Ariza topilmadi.", 404);
  if (!["draft", "needs_revision"].includes(application.status)) {
    return bad("Ushbu ariza endi tahrirlanmaydi.", 409);
  }

  const formData = await req.formData();
  const docKey = formData.get("doc_key");
  const file = formData.get("file");

  if (typeof docKey !== "string" || !(file instanceof File)) {
    return bad("Fayl va hujjat turi kiritilishi shart.", 422);
  }

  const document = findDefenseDocument(docKey);
  if (!document) return bad("Noma'lum hujjat turi.", 422);

  const rule = defenseDocumentRule(document);
  const validationError = validateFile(file, rule);
  if (validationError) return bad(validationError, 422);

  const fileName = safeStorageFileName(file.name);
  const path = `${id}/${docKey}/${Date.now()}_${fileName}`;

  const { error: uploadError } = await admin.storage
    .from(DEFENSE_STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) return bad(uploadError.message, 500);

  const documents = ((application.documents ?? {}) as DefenseApplication["documents"]);
  const existing = documents[docKey] ?? [];
  const updatedDocuments = { ...documents, [docKey]: [...existing, path] };

  const { error: updateError } = await admin
    .from("defense_applications")
    .update({ documents: updatedDocuments })
    .eq("id", id);

  if (updateError) return bad(updateError.message, 500);

  return NextResponse.json({ path, documents: updatedDocuments });
}
