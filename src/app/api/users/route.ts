import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RoleName } from "@/types/db";

interface CreateUserBody {
  email: string;
  password: string;
  display_name: string;
  role: RoleName;
  university_id?: string | null;
  faculty_id?: string | null;
  department_id?: string | null;
}

const ROLES_REQUIRING_UNIVERSITY: RoleName[] = [
  "university_admin",
  "vice_rector",
  "science_department",
  "dean",
  "staff_manager",
];

const ROLES_REQUIRING_FACULTY: RoleName[] = ["dean"];
const ROLES_REQUIRING_DEPARTMENT: RoleName[] = ["staff_manager"];

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CreateUserBody | null;
  if (!body) return bad("Invalid JSON body");

  const { email, password, display_name, role } = body;
  if (!email || !password || !display_name || !role) {
    return bad("email, password, display_name, role are required");
  }
  if (password.length < 8) return bad("Password must be at least 8 characters");

  // 1. Identify caller via session cookies
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return bad("Not authenticated", 401);

  // 2. Load caller profile (with role)
  const { data: caller, error: callerErr } = await supabase
    .from("users")
    .select("id, university_id, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();
  if (callerErr || !caller) return bad("Caller profile missing", 403);

  const callerRole = (caller as any).roles.name as RoleName;
  const callerUniversityId = (caller as any).university_id as string | null;

  // 3. Permission check
  if (callerRole !== "super_admin" && callerRole !== "university_admin") {
    return bad("Forbidden: only super_admin or university_admin can create users", 403);
  }
  if (callerRole === "university_admin") {
    if (role === "super_admin") return bad("Forbidden: cannot create super_admin", 403);
    if (!callerUniversityId) return bad("Caller has no university assigned", 403);
    // Force scope to caller's university
    body.university_id = callerUniversityId;
  }

  // 4. Validate scope fields against role
  if (ROLES_REQUIRING_UNIVERSITY.includes(role) && !body.university_id) {
    return bad(`Role "${role}" requires university_id`);
  }
  if (ROLES_REQUIRING_FACULTY.includes(role) && !body.faculty_id) {
    return bad(`Role "${role}" requires faculty_id`);
  }
  if (ROLES_REQUIRING_DEPARTMENT.includes(role) && !body.department_id) {
    return bad(`Role "${role}" requires department_id`);
  }
  if (role === "super_admin") {
    body.university_id = null;
    body.faculty_id = null;
    body.department_id = null;
  }

  // 5. Service-role client for the privileged ops
  const admin = createAdminClient();

  const { data: roleRow, error: roleErr } = await admin
    .from("roles")
    .select("id")
    .eq("name", role)
    .maybeSingle();
  if (roleErr || !roleRow) return bad(`Unknown role "${role}"`, 400);

  // Cross-check that faculty/department actually belong to the target university
  if (body.faculty_id) {
    const { data: f } = await admin
      .from("faculties")
      .select("university_id")
      .eq("id", body.faculty_id)
      .maybeSingle();
    if (!f || (body.university_id && f.university_id !== body.university_id)) {
      return bad("Faculty does not belong to the given university");
    }
  }
  if (body.department_id) {
    const { data: d } = await admin
      .from("departments")
      .select("university_id, faculty_id")
      .eq("id", body.department_id)
      .maybeSingle();
    if (!d || (body.university_id && d.university_id !== body.university_id)) {
      return bad("Department does not belong to the given university");
    }
    if (body.faculty_id && d.faculty_id !== body.faculty_id) {
      return bad("Department does not belong to the given faculty");
    }
  }

  // 6. Create auth user (email pre-confirmed so they can log in immediately)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name },
  });
  if (createErr || !created.user) {
    return bad(createErr?.message ?? "Failed to create auth user", 400);
  }

  // 7. Insert public.users row
  const { data: profile, error: insertErr } = await admin
    .from("users")
    .insert({
      id: created.user.id,
      email,
      display_name,
      role_id: roleRow.id,
      university_id: body.university_id ?? null,
      faculty_id: body.faculty_id ?? null,
      department_id: body.department_id ?? null,
      must_change_password: true,
      created_by: authUser.id,
    })
    .select()
    .single();

  if (insertErr) {
    // Roll back auth user so we don't leave an orphan
    await admin.auth.admin.deleteUser(created.user.id);
    return bad(insertErr.message, 400);
  }

  return NextResponse.json({ user: profile }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("id");
  if (!targetId) return bad("id query param required");

  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return bad("Not authenticated", 401);

  const { data: caller } = await supabase
    .from("users")
    .select("university_id, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!caller) return bad("Caller profile missing", 403);
  const callerRole = (caller as any).roles.name as RoleName;
  const callerUniversityId = (caller as any).university_id as string | null;

  if (callerRole !== "super_admin" && callerRole !== "university_admin") {
    return bad("Forbidden", 403);
  }

  const admin = createAdminClient();

  if (callerRole === "university_admin") {
    const { data: target } = await admin
      .from("users")
      .select("university_id")
      .eq("id", targetId)
      .maybeSingle();
    if (!target || target.university_id !== callerUniversityId) {
      return bad("Forbidden: target user is outside your university", 403);
    }
  }

  // Deleting from auth.users cascades to public.users via FK
  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) return bad(error.message, 400);
  return NextResponse.json({ ok: true });
}
