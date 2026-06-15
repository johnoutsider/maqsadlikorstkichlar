import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RoleName } from "@/types/db";

const DEFAULT_PASSWORD = "12345678";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const targetId = body?.id;
  if (!targetId) return bad("id is required");

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return bad("Not authenticated", 401);

  const { data: caller, error: callerErr } = await supabase
    .from("users")
    .select("university_id, roles!users_role_id_fkey!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();
  if (callerErr || !caller) return bad("Caller profile missing", 403);

  const callerRole = (caller as any).roles.name as RoleName;
  const callerUniversityId = (caller as any).university_id as string | null;

  if (callerRole !== "super_admin" && callerRole !== "university_admin" && callerRole !== "science_department") {
    return bad("Forbidden: insufficient permissions to reset passwords", 403);
  }

  if (targetId === authUser.id) {
    return bad("O'zingizning parolingizni profil sahifasidan o'zgartiring.", 400);
  }

  const admin = createAdminClient();

  if (callerRole !== "super_admin") {
    const { data: target } = await admin
      .from("users")
      .select("university_id")
      .eq("id", targetId)
      .maybeSingle();
    if (!target || !callerUniversityId || target.university_id !== callerUniversityId) {
      return bad("Forbidden: target user is outside your university", 403);
    }
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(targetId, {
    password: DEFAULT_PASSWORD,
  });
  if (authErr) return bad(authErr.message, 400);

  const { error: updateErr } = await admin
    .from("users")
    .update({ must_change_password: true })
    .eq("id", targetId);
  if (updateErr) return bad(updateErr.message, 400);

  return NextResponse.json({ ok: true });
}
