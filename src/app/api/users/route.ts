import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/telegram";
import type { RoleName } from "@/types/db";

interface CreateUserBody {
  email: string;
  password: string;
  display_name: string;
  role: RoleName;
  phone?: string | null;
  university_id?: string | null;
  faculty_id?: string | null;
  department_id?: string | null;
}

interface UpdateUserBody {
  id: string;
  email: string;
  password?: string;
  display_name: string;
  role: RoleName;
  phone?: string | null;
  faculty_id?: string | null;
  department_id?: string | null;
}

const ROLES_REQUIRING_UNIVERSITY: RoleName[] = [
  "university_admin",
  "vice_rector",
  "science_department",
  "dean",
  "staff_manager"
];

const ROLES_REQUIRING_FACULTY: RoleName[] = ["dean"];
const ROLES_REQUIRING_DEPARTMENT: RoleName[] = ["staff_manager"];

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

async function getCaller() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { error: bad("Not authenticated", 401) };

  const { data: caller, error: callerErr } = await supabase
    .from("users")
    .select("id, university_id, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();

  if (callerErr || !caller) return { error: bad("Caller profile missing", 403) };

  return {
    authUser,
    callerRole: (caller as any).roles.name as RoleName,
    callerUniversityId: (caller as any).university_id as string | null,
  };
}

async function validateUserScope(admin: ReturnType<typeof createAdminClient>, body: {
  university_id?: string | null;
  faculty_id?: string | null;
  department_id?: string | null;
}) {
  if (body.faculty_id) {
    const { data: f } = await admin
      .from("faculties")
      .select("university_id")
      .eq("id", body.faculty_id)
      .maybeSingle();
    if (!f || (body.university_id && f.university_id !== body.university_id)) {
      return "Faculty does not belong to the given university";
    }
  }
  if (body.department_id) {
    const { data: d } = await admin
      .from("departments")
      .select("university_id, faculty_id")
      .eq("id", body.department_id)
      .maybeSingle();
    if (!d || (body.university_id && d.university_id !== body.university_id)) {
      return "Department does not belong to the given university";
    }
    if (body.faculty_id && d.faculty_id !== body.faculty_id) {
      return "Department does not belong to the given faculty";
    }
  }

  return null;
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
  const callerInfo = await getCaller();
  if (callerInfo.error) return callerInfo.error;
  const { authUser, callerRole, callerUniversityId } = callerInfo;

  // 3. Permission check
  if (callerRole !== "super_admin" && callerRole !== "university_admin" && callerRole !== "science_department") {
    return bad("Forbidden: insufficient permissions to manage users", 403);
  }
  
  if (callerRole === "science_department") {
    return bad("science_department foydalanuvchilari doktorant va supervisorlarni doktorantura moduli orqali yaratishi kerak.", 403);
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

  if (role === "supervisor" || role === "doktorant") {
    return bad("Supervisor va doktorant rollari maxsus doktorantura yaratish jarayoni orqali qo'shiladi.", 400);
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
  const scopeError = await validateUserScope(admin, body);
  if (scopeError) return bad(scopeError);

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
        phone: body.phone ? normalizePhone(body.phone) : null,
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

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as UpdateUserBody | null;
  if (!body) return bad("Invalid JSON body");

  const { id, email, password, display_name, role } = body;
  if (!id || !email || !display_name || !role) {
    return bad("id, email, display_name, role are required");
  }
  if (password && password.length < 8) return bad("Password must be at least 8 characters");
  if (role === "supervisor" || role === "doktorant") {
    return bad("Supervisor va doktorant rollari maxsus doktorantura jarayoni orqali tahrirlanadi.", 400);
  }

  const callerInfo = await getCaller();
  if (callerInfo.error) return callerInfo.error;
  const { callerRole, callerUniversityId } = callerInfo;

  if (callerRole !== "super_admin" && callerRole !== "university_admin") {
    return bad("Forbidden: insufficient permissions to manage users", 403);
  }
  if (callerRole === "university_admin") {
    if (role === "super_admin") return bad("Forbidden: cannot assign super_admin", 403);
    if (!callerUniversityId) return bad("Caller has no university assigned", 403);
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("users")
    .select("university_id")
    .eq("id", id)
    .maybeSingle();
  if (!target) return bad("Target user not found", 404);
  if (callerRole === "university_admin" && target.university_id !== callerUniversityId) {
    return bad("Forbidden: target user is outside your university", 403);
  }

  const university_id = callerRole === "university_admin" ? callerUniversityId : target.university_id;
  const faculty_id = role === "dean" || role === "staff_manager" ? body.faculty_id ?? null : null;
  const department_id = role === "staff_manager" ? body.department_id ?? null : null;

  if (ROLES_REQUIRING_FACULTY.includes(role) && !faculty_id) {
    return bad(`Role "${role}" requires faculty_id`);
  }
  if (ROLES_REQUIRING_DEPARTMENT.includes(role) && !department_id) {
    return bad(`Role "${role}" requires department_id`);
  }

  const { data: roleRow, error: roleErr } = await admin
    .from("roles")
    .select("id")
    .eq("name", role)
    .maybeSingle();
  if (roleErr || !roleRow) return bad(`Unknown role "${role}"`, 400);

  const scopeError = await validateUserScope(admin, { university_id, faculty_id, department_id });
  if (scopeError) return bad(scopeError);

  const authUpdate: { email: string; password?: string; user_metadata: { display_name: string } } = {
    email,
    user_metadata: { display_name },
  };
  if (password) authUpdate.password = password;

  const { error: authErr } = await admin.auth.admin.updateUserById(id, authUpdate);
  if (authErr) return bad(authErr.message, 400);

  const { data: profile, error: updateErr } = await admin
    .from("users")
    .update({
      email,
      display_name,
      role_id: roleRow.id,
      phone: body.phone ? normalizePhone(body.phone) : null,
      faculty_id,
      department_id,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) return bad(updateErr.message, 400);

  return NextResponse.json({ user: profile });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("id");
  if (!targetId) return bad("id query param required");

  const supabase = await createClient();
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

  if (callerRole !== "super_admin" && callerRole !== "university_admin" && callerRole !== "science_department") {
    return bad("Forbidden", 403);
  }

  // A science_department shouldn't blindly delete other admins. Add a targeted DB check:
  if (callerRole === "science_department") {
    const { data: target } = await supabase
      .from("users")
      .select("university_id, roles!inner(name)")
      .eq("id", targetId)
      .maybeSingle();

    if (!target || target.university_id !== callerUniversityId) {
      return bad("Forbidden: target user is outside your university", 403);
    }
    const targetRole = (target as any).roles.name;
    if (targetRole !== "doktorant" && targetRole !== "supervisor") {
       return bad("Forbidden: science_department can only delete doktorants and supervisors", 403);
    }
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
