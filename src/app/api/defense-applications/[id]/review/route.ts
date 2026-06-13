import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReviewDefenseApplication } from "@/lib/defense-workflow";
import { notifyRolesByTelegram, notifyApplicant } from "@/lib/telegram-notify";
import type { DefenseApplication, DefenseReviewHistoryEntry, RoleName } from "@/types/db";

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return bad("Tizimga kirish talab qilinadi.", 401);

  const { data: profile } = await supabase
    .from("users")
    .select("university_id, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();

  const role = (profile as (typeof profile & { roles: { name: RoleName } }) | null)?.roles.name ?? null;
  if (!profile || role !== "science_department") {
    return bad("Ushbu amalga ruxsat yo'q.", 403);
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const comment = typeof body?.comment === "string" ? body.comment.trim() : null;
  const departmentId = typeof body?.department_id === "string" ? body.department_id : null;

  if (action !== "advance" && action !== "needs_revision") {
    return bad("Noto'g'ri amal.", 422);
  }
  if (action === "advance" && !departmentId) {
    return bad("Kafedra/bo'lim tanlanishi shart.", 422);
  }

  const admin = createAdminClient();
  const { data: application, error: fetchError } = await admin
    .from("defense_applications")
    .select("id, university_id, reference_code, status, applicant_chat_id, applicant_full_name, review_history")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return bad(fetchError.message, 500);
  if (!application) return bad("Ariza topilmadi.", 404);
  if (application.university_id !== profile.university_id) return bad("Ushbu amalga ruxsat yo'q.", 403);
  if (!canReviewDefenseApplication(role, application.status as DefenseApplication["status"])) {
    return bad("Ushbu ariza hozir ko'rib chiqish bosqichida emas.", 409);
  }

  if (action === "advance") {
    const { data: department } = await admin
      .from("departments")
      .select("id")
      .eq("id", departmentId!)
      .eq("university_id", application.university_id)
      .maybeSingle();

    if (!department) return bad("Tanlangan kafedra topilmadi.", 422);
  }

  const historyEntry: DefenseReviewHistoryEntry = {
    stage: "science",
    reviewer_id: authUser.id,
    at: new Date().toISOString(),
    outcome: action === "advance" ? "advanced" : "needs_revision",
    comment,
  };
  const reviewHistory = [...((application.review_history ?? []) as DefenseReviewHistoryEntry[]), historyEntry];

  const update: Record<string, unknown> = {
    science_reviewed_by: authUser.id,
    science_reviewed_at: historyEntry.at,
    science_comment: comment,
    review_history: reviewHistory,
    status: action === "advance" ? "pending_vice_rector" : "needs_revision",
  };
  if (action === "advance") update.department_id = departmentId;

  const { error: updateError } = await admin.from("defense_applications").update(update).eq("id", id);
  if (updateError) return bad(updateError.message, 500);

  if (action === "advance") {
    await notifyRolesByTelegram(admin, {
      universityId: application.university_id,
      roles: ["vice_rector"],
      type: "defense_application_pending_vice_rector",
      title: "Tasdiqlash kutilayotgan himoya arizasi",
      message: `${application.reference_code} raqamli himoya arizasi tasdiqlash uchun yuborildi.`,
      data: { defense_application_id: id },
    });
    await notifyApplicant(
      application.applicant_chat_id,
      `Hurmatli ${application.applicant_full_name}, sizning ${application.reference_code} raqamli arizangiz ilmiy prorektor tasdig'iga yuborildi.`
    );
  } else {
    await notifyApplicant(
      application.applicant_chat_id,
      `Hurmatli ${application.applicant_full_name}, sizning ${application.reference_code} raqamli arizangiz qayta ko'rib chiqish uchun qaytarildi.${comment ? `\nIzoh: ${comment}` : ""}`
    );
  }

  return NextResponse.json({ ok: true, status: update.status });
}
