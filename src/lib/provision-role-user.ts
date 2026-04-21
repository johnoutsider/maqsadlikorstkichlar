import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { DoktorantMetadata } from "@/lib/doktorant-profile";
import type { RoleName } from "@/types/db";

type CallerRole = "super_admin" | "science_department";

interface ProvisionBaseInput {
  email: string;
  password: string;
  callerRole: CallerRole;
  callerUserId: string;
  callerUniversityId: string | null;
}

export interface ProvisionSupervisorInput extends ProvisionBaseInput {
  role: "supervisor";
  full_name: string;
  staff_id: string;
  academic_title: string;
  is_external?: boolean;
  faculty_id?: string | null;
  department_id?: string | null;
  workplace?: string | null;
}

export interface ProvisionDoktorantInput extends ProvisionBaseInput {
  role: "doktorant";
  full_name: string;
  student_id: string;
  enrollment_year: number;
  research_topic: string;
  department_id: string;
  supervisor_id?: string | null;
  thesis_status?: string;
  metadata?: DoktorantMetadata | null;
}

export type ProvisionRoleInput = ProvisionSupervisorInput | ProvisionDoktorantInput;

interface DepartmentScope {
  id: string;
  university_id: string;
  faculty_id: string;
}

function bad(error: string, status = 400) {
  return { ok: false as const, error, status };
}

async function loadRoleId(role: RoleName) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("roles")
    .select("id")
    .eq("name", role)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id as string;
}

async function loadDepartmentScope(departmentId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .select("id, university_id, faculty_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as DepartmentScope;
}

async function ensureSupervisorInUniversity(supervisorId: string, universityId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("supervisors")
    .select("id, university_id")
    .eq("id", supervisorId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false as const, error: "Ilmiy rahbar topilmadi." };
  }

  if (data.university_id && data.university_id !== universityId) {
    return { ok: false as const, error: "Ilmiy rahbar boshqa universitetga tegishli." };
  }

  return { ok: true as const };
}

export async function provisionRoleUser(input: ProvisionRoleInput) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.full_name.trim();

  if (!email || !input.password || !fullName) {
    return bad("Majburiy maydonlar to'ldirilmagan.");
  }

  if (input.password.length < 8) {
    return bad("Parol kamida 8 ta belgidan iborat bo'lishi kerak.");
  }

  if (input.callerRole !== "super_admin" && !input.callerUniversityId) {
    return bad("Joriy foydalanuvchiga universitet biriktirilmagan.", 403);
  }

  const roleId = await loadRoleId(input.role);
  if (!roleId) {
    return bad(`"${input.role}" roli topilmadi.`, 400);
  }

  let universityId = input.callerUniversityId;
  let facultyId: string | null = null;
  let departmentId: string | null = null;

  if (input.role === "supervisor") {
    const isExternal = !!input.is_external;
    if (!input.staff_id?.trim() || !input.academic_title?.trim()) {
      return bad("Staff ID va ilmiy daraja majburiy.");
    }

    if (isExternal) {
      if (!input.workplace?.trim()) {
        return bad("Tashqi rahbar uchun ish joyi majburiy.");
      }
      facultyId = null;
      departmentId = null;
    } else {
      if (!input.department_id) {
        return bad("Ichki ilmiy rahbar uchun kafedra tanlanishi kerak.");
      }

      const scope = await loadDepartmentScope(input.department_id);
      if (!scope) {
        return bad("Tanlangan kafedra topilmadi.");
      }

      if (input.callerRole !== "super_admin" && scope.university_id !== input.callerUniversityId) {
        return bad("Tanlangan kafedra sizning universitetingizga tegishli emas.", 403);
      }

      universityId = input.callerRole === "super_admin"
        ? scope.university_id
        : input.callerUniversityId;
      facultyId = scope.faculty_id;
      departmentId = scope.id;
    }
  } else {
    if (!input.student_id?.trim() || !input.department_id || !Number.isFinite(input.enrollment_year) || !input.research_topic?.trim()) {
      return bad("Doktorant uchun barcha majburiy maydonlarni to'ldiring.");
    }

    const scope = await loadDepartmentScope(input.department_id);
    if (!scope) {
      return bad("Tanlangan kafedra topilmadi.");
    }

    if (input.callerRole !== "super_admin" && scope.university_id !== input.callerUniversityId) {
      return bad("Tanlangan kafedra sizning universitetingizga tegishli emas.", 403);
    }

    universityId = input.callerRole === "super_admin"
      ? scope.university_id
      : input.callerUniversityId;
    facultyId = scope.faculty_id;
    departmentId = scope.id;

    if (input.supervisor_id) {
      const supervisorCheck = await ensureSupervisorInUniversity(input.supervisor_id, universityId!);
      if (!supervisorCheck.ok) {
        return bad(supervisorCheck.error, 400);
      }
    }
  }

  if (!universityId) {
    return bad("Universitet aniqlanmadi.");
  }

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: fullName, role: input.role },
  });

  if (createErr || !created.user) {
    return bad(createErr?.message ?? "Auth foydalanuvchini yaratib bo'lmadi.");
  }

  const authUserId = created.user.id;

  const rollback = async (message: string, status = 400) => {
    await admin.auth.admin.deleteUser(authUserId);
    return bad(message, status);
  };

  const { data: userRow, error: userErr } = await admin
    .from("users")
    .insert({
      id: authUserId,
      university_id: universityId,
      role_id: roleId,
      faculty_id: facultyId,
      department_id: departmentId,
      display_name: fullName,
      email,
      must_change_password: true,
      created_by: input.callerUserId,
    })
    .select("id, university_id, faculty_id, department_id, display_name, email")
    .single();

  if (userErr || !userRow) {
    return rollback(userErr?.message ?? "Foydalanuvchi profili yaratilmadi.");
  }

  if (input.role === "supervisor") {
    const { data: profile, error: profileErr } = await admin
      .from("supervisors")
      .insert({
        auth_user_id: authUserId,
        university_id: input.is_external ? null : universityId,
        faculty_id: input.is_external ? null : facultyId,
        department_id: input.is_external ? null : departmentId,
        full_name: fullName,
        staff_id: input.staff_id.trim(),
        academic_title: input.academic_title.trim(),
        workplace: input.is_external ? input.workplace?.trim() ?? null : null,
        is_external: !!input.is_external,
        email,
      })
      .select("*")
      .single();

    if (profileErr || !profile) {
      return rollback(profileErr?.message ?? "Ilmiy rahbar profili yaratilmadi.");
    }

    return {
      ok: true as const,
      user: userRow,
      profile,
    };
  }

  const { data: profile, error: profileErr } = await admin
    .from("doktorantlar")
    .insert({
      auth_user_id: authUserId,
      university_id: universityId,
      faculty_id: facultyId,
      department_id: departmentId,
      supervisor_id: input.supervisor_id ?? null,
      full_name: fullName,
      student_id: input.student_id.trim(),
      enrollment_year: input.enrollment_year,
      research_topic: input.research_topic.trim(),
      thesis_status: input.thesis_status ?? "taklif",
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (profileErr || !profile) {
    return rollback(profileErr?.message ?? "Doktorant profili yaratilmadi.");
  }

  return {
    ok: true as const,
    user: userRow,
    profile,
  };
}
