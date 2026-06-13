import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFENSE_STATUS_LABEL } from "@/lib/defense-workflow";
import type { DefenseStatus } from "@/types/db";

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: application, error } = await admin
    .from("defense_applications")
    .select(
      "id, reference_code, status, phone_verified, applicant_full_name, applicant_phone, dissertation_info, avtoreferat_info, documents, science_comment, vice_rector_comment"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return bad(error.message, 500);
  if (!application) return bad("Ariza topilmadi.", 404);

  return NextResponse.json({
    ...application,
    status_label: DEFENSE_STATUS_LABEL[application.status as DefenseStatus],
  });
}
