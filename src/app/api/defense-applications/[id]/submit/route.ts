import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DISSERTATION_FIELDS, AVTOREFERAT_FIELDS, DEFENSE_DOCUMENTS } from "@/lib/defense-config";
import { notifyRolesByTelegram, notifyApplicant } from "@/lib/telegram-notify";
import type { DefenseApplication } from "@/types/db";

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json().catch(() => null);

  const fullName = typeof body?.applicant_full_name === "string" ? body.applicant_full_name.trim() : "";
  const dissertationInfo = (body?.dissertation_info ?? {}) as Record<string, string>;
  const avtoreferatInfo = (body?.avtoreferat_info ?? {}) as Record<string, string>;

  const admin = createAdminClient();
  const { data: application, error: fetchError } = await admin
    .from("defense_applications")
    .select("id, university_id, reference_code, status, phone_verified, applicant_chat_id, documents")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return bad(fetchError.message, 500);
  if (!application) return bad("Ariza topilmadi.", 404);
  if (!["draft", "needs_revision"].includes(application.status)) {
    return bad("Ushbu ariza endi tahrirlanmaydi.", 409);
  }
  if (!application.phone_verified) {
    return bad("Telefon raqami Telegram orqali tasdiqlanmagan.", 422);
  }
  if (!fullName) return bad("F.I.Sh. kiritilishi shart.", 422);

  for (const field of DISSERTATION_FIELDS) {
    if (field.required && !dissertationInfo[field.key]?.toString().trim()) {
      return bad(`"${field.label}" maydoni to'ldirilishi shart.`, 422);
    }
  }
  for (const field of AVTOREFERAT_FIELDS) {
    if (field.required && !avtoreferatInfo[field.key]?.toString().trim()) {
      return bad(`"${field.label}" maydoni to'ldirilishi shart.`, 422);
    }
  }

  const documents = (application.documents ?? {}) as DefenseApplication["documents"];
  for (const document of DEFENSE_DOCUMENTS) {
    if (document.required && !(documents[document.key]?.length > 0)) {
      return bad(`"${document.label}" fayli yuklanishi shart.`, 422);
    }
  }

  const { error: updateError } = await admin
    .from("defense_applications")
    .update({
      applicant_full_name: fullName,
      dissertation_info: dissertationInfo,
      avtoreferat_info: avtoreferatInfo,
      status: "pending_science",
    })
    .eq("id", id);

  if (updateError) return bad(updateError.message, 500);

  await notifyRolesByTelegram(admin, {
    universityId: application.university_id,
    roles: ["science_department"],
    type: "defense_application_pending_science",
    title: "Yangi himoya arizasi",
    message: `${application.reference_code} raqamli himoya arizasi ko'rib chiqish uchun yuborildi.`,
    data: { defense_application_id: id },
  });

  await notifyApplicant(
    application.applicant_chat_id,
    `Hurmatli ${fullName}, sizning ${application.reference_code} raqamli arizangiz ilmiy bo'lim tekshiruviga yuborildi.`
  );

  return NextResponse.json({ ok: true, status: "pending_science" });
}
