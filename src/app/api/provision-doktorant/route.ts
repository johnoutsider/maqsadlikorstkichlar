import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RoleName } from "@/types/db";
import { provisionRoleUser } from "@/lib/provision-role-user";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { email, password, full_name, student_id, enrollment_year, research_topic, department_id, supervisor_id, thesis_status, metadata } = body;
  if (!email || !password || !full_name || !student_id || !enrollment_year || !research_topic) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller, error: callerErr } = await supabase
    .from("users")
    .select("university_id, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();

  if (callerErr || !caller) return NextResponse.json({ error: "Caller profile missing" }, { status: 403 });

  const callerRole = (caller as any).roles.name as RoleName;
  const callerUniversityId = (caller as any).university_id as string | null;

  if (callerRole !== "science_department" && callerRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await provisionRoleUser({
    role: "doktorant",
    email,
    password,
    full_name,
    student_id,
    enrollment_year,
    research_topic,
    department_id,
    supervisor_id,
    thesis_status,
    metadata,
    callerRole: callerRole as "super_admin" | "science_department",
    callerUserId: authUser.id,
    callerUniversityId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ user: result.user, profile: result.profile }, { status: 201 });
}
