import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RoleName } from "@/types/db";

const ROLE_LABEL_TO_NAME: Record<string, RoleName> = {
  "Universitet admin": "university_admin",
  "Prorektor": "vice_rector",
  "Ilmiy bo'lim": "science_department",
  "Dekan": "dean",
  "Kafedra mudiri": "staff_manager",
};

const ROLES_REQUIRING_FACULTY: RoleName[] = ["dean"];
const ROLES_REQUIRING_DEPARTMENT: RoleName[] = ["staff_manager"];

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
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
    return bad("Forbidden: only university_admin can bulk import users", 403);
  }
  if (callerRole === "university_admin" && !callerUniversityId) {
    return bad("Caller has no university assigned", 403);
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return bad("Expected multipart/form-data");

  const file = formData.get("file") as File | null;
  if (!file) return bad("No file uploaded");

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return bad("Excel file has no sheets");

  const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
  // Skip header row
  const dataRows = rawRows.slice(1) as string[][];

  if (dataRows.length === 0) {
    return bad("Excel file has no data rows (only header found)");
  }

  const admin = createAdminClient();

  // Load all roles, faculties, departments for this university once
  const [rolesRes, facultiesRes, departmentsRes] = await Promise.all([
    admin.from("roles").select("id, name"),
    admin.from("faculties").select("id, short_code").eq("university_id", callerUniversityId!),
    admin.from("departments").select("id, short_code, faculty_id").eq("university_id", callerUniversityId!),
  ]);

  const rolesMap = new Map<string, string>(
    ((rolesRes.data as any[]) ?? []).map((r) => [r.name, r.id])
  );
  const facultyByCode = new Map<string, string>(
    ((facultiesRes.data as any[]) ?? []).map((f) => [f.short_code.toUpperCase(), f.id])
  );
  const deptByCode = new Map<string, { id: string; faculty_id: string }>(
    ((departmentsRes.data as any[]) ?? []).map((d) => [
      d.short_code.toUpperCase(),
      { id: d.id, faculty_id: d.faculty_id },
    ])
  );

  type RowResult = {
    row: number;
    display_name: string;
    email: string;
    status: "success" | "error";
    error?: string;
  };

  const results: RowResult[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2; // 1-based, +1 for header
    const cols = dataRows[i];

    const display_name = String(cols[0] ?? "").trim();
    const email = String(cols[1] ?? "").trim();
    const password = String(cols[2] ?? "").trim();
    const roleLabelRaw = String(cols[3] ?? "").trim();
    const facultyCode = String(cols[4] ?? "").trim().toUpperCase();
    const deptCode = String(cols[5] ?? "").trim().toUpperCase();

    // Skip fully empty rows
    if (!display_name && !email && !password && !roleLabelRaw) continue;

    const fail = (msg: string) =>
      results.push({ row: rowNum, display_name, email, status: "error", error: msg });

    if (!display_name) { fail("To'liq ism bo'sh"); continue; }
    if (!email) { fail("Email bo'sh"); continue; }
    if (!password) { fail("Parol bo'sh"); continue; }
    if (password.length < 8) { fail("Parol kamida 8 ta belgidan iborat bo'lishi kerak"); continue; }
    if (!roleLabelRaw) { fail("Rol bo'sh"); continue; }

    const role = ROLE_LABEL_TO_NAME[roleLabelRaw];
    if (!role) {
      fail(`Noto'g'ri rol: "${roleLabelRaw}". Ruxsat etilgan: ${Object.keys(ROLE_LABEL_TO_NAME).join(", ")}`);
      continue;
    }

    const roleId = rolesMap.get(role);
    if (!roleId) { fail(`Tizimda rol topilmadi: "${role}"`); continue; }

    let faculty_id: string | null = null;
    let department_id: string | null = null;

    if (ROLES_REQUIRING_FACULTY.includes(role) || facultyCode) {
      if (!facultyCode) { fail("Dekan uchun Fakultet kodi majburiy"); continue; }
      const fid = facultyByCode.get(facultyCode);
      if (!fid) { fail(`Fakultet kodi topilmadi: "${facultyCode}"`); continue; }
      faculty_id = fid;
    }

    if (ROLES_REQUIRING_DEPARTMENT.includes(role) || deptCode) {
      if (!deptCode) { fail("Kafedra mudiri uchun Kafedra kodi majburiy"); continue; }
      const dept = deptByCode.get(deptCode);
      if (!dept) { fail(`Kafedra kodi topilmadi: "${deptCode}"`); continue; }
      department_id = dept.id;
      faculty_id = dept.faculty_id;
    }

    // Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name },
    });

    if (createErr || !created.user) {
      fail(createErr?.message ?? "Auth user yaratishda xatolik");
      continue;
    }

    const { error: insertErr } = await admin.from("users").insert({
      id: created.user.id,
      email,
      display_name,
      role_id: roleId,
      university_id: callerUniversityId,
      faculty_id,
      department_id,
      must_change_password: true,
      created_by: authUser.id,
    });

    if (insertErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      fail(insertErr.message);
      continue;
    }

    results.push({ row: rowNum, display_name, email, status: "success" });
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ succeeded, failed, results }, { status: 200 });
}
