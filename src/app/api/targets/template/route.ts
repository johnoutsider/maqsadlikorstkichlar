import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Indicator } from "@/types/db";

export const runtime = "nodejs";

const CAN_EDIT_ROLES = new Set(["super_admin", "university_admin", "science_department"]);

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// Build the importable Excel template for reja (target) values.
// Sheet "Rejalar": one row per department, one column per leaf indicator
//   (parent / auto-sum indicators are excluded — they are computed, not entered).
//   Header row holds each indicator's `no`, which the import matches columns by.
// Sheet "Ko'rsatkichlar": a legend mapping each `no` to its name and unit.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return bad("Not authenticated", 401);

  const { data: caller } = await supabase
    .from("users")
    .select("university_id, roles!users_role_id_fkey!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!caller) return bad("Caller profile missing", 403);

  const callerRole = (caller as any).roles.name as string;
  const universityId = (caller as any).university_id as string | null;
  if (!CAN_EDIT_ROLES.has(callerRole)) return bad("Forbidden", 403);
  if (!universityId) return bad("Caller has no university assigned", 403);

  const admin = createAdminClient();
  const [indRes, deptRes] = await Promise.all([
    admin.from("indicators").select("*").eq("university_id", universityId).order("order_idx"),
    admin.from("departments").select("id, short_code, name").eq("university_id", universityId).order("short_code"),
  ]);

  const indicators = (indRes.data as Indicator[]) ?? [];
  const departments = ((deptRes.data as { short_code: string; name: string }[]) ?? []);

  // Parent (auto-sum) indicators are the ones referenced as a parent_id.
  const parentIds = new Set(indicators.filter((i) => i.parent_id).map((i) => i.parent_id as string));
  const leafIndicators = indicators.filter((i) => !parentIds.has(i.id));

  const workbook = new ExcelJS.Workbook();

  // ── Sheet 1: Rejalar ──────────────────────────────────────────────────────
  const sheet = workbook.addWorksheet("Rejalar");
  const headerNames = ["Kafedra kodi", "Kafedra nomi", ...leafIndicators.map((i) => i.no)];
  sheet.addRow(headerNames);
  sheet.getRow(1).font = { bold: true };
  // Pre-fill every department so the admin only types numbers.
  departments.forEach((d) => sheet.addRow([d.short_code, d.name]));
  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 40;
  for (let c = 3; c <= headerNames.length; c++) sheet.getColumn(c).width = 10;
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  // ── Sheet 2: Ko'rsatkichlar (legend) ──────────────────────────────────────
  const legend = workbook.addWorksheet("Ko'rsatkichlar");
  legend.addRow(["No", "Ko'rsatkich", "Birlik"]);
  legend.getRow(1).font = { bold: true };
  leafIndicators.forEach((i) => legend.addRow([i.no, i.name, i.unit]));
  legend.getColumn(1).width = 10;
  legend.getColumn(2).width = 70;
  legend.getColumn(3).width = 14;

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="rejalar-shablon.xlsx"',
    },
  });
}
