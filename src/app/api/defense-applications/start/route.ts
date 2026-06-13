import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/telegram";
import { generateReferenceCode } from "@/lib/defense-workflow";

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const phoneRaw = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!fullName) return bad("F.I.Sh. kiritilishi shart.", 422);
  if (!phoneRaw) return bad("Telefon raqami kiritilishi shart.", 422);

  const phone = normalizePhone(phoneRaw);
  const admin = createAdminClient();

  let universityId = process.env.DEFENSE_APPLICATIONS_UNIVERSITY_ID;
  if (!universityId) {
    const { data: university, error: universityError } = await admin
      .from("universities")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (universityError || !university) {
      return bad("Universitet topilmadi.", 500);
    }
    universityId = university.id;
  }

  const id = randomUUID();
  const referenceCode = generateReferenceCode(id, new Date().getFullYear());

  const { error: insertError } = await admin.from("defense_applications").insert({
    id,
    university_id: universityId,
    reference_code: referenceCode,
    applicant_full_name: fullName,
    applicant_phone: phone,
    status: "draft",
  });

  if (insertError) return bad(insertError.message, 500);

  return NextResponse.json({ id, reference_code: referenceCode });
}
