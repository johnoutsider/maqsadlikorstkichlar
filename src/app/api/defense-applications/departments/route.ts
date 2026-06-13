import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
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

  const { data: departments, error } = await admin
    .from("departments")
    .select("id, name")
    .eq("university_id", universityId)
    .order("name");

  if (error) return bad(error.message, 500);

  return NextResponse.json({ departments: departments ?? [] });
}
