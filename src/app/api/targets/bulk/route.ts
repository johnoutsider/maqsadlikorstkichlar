import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXCEL_IMPORT_FILE_RULE, validateFile } from "@/lib/upload-validation";
import type { Indicator, Quarter } from "@/types/db";

export const runtime = "nodejs";

const CAN_EDIT_ROLES = new Set(["super_admin", "university_admin", "science_department"]);
const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
  }
  return String(value);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return bad("Not authenticated", 401);

  const { data: caller } = await supabase
    .from("users")
    .select("university_id, id, roles!users_role_id_fkey!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!caller) return bad("Caller profile missing", 403);

  const callerRole = (caller as any).roles.name as string;
  const universityId = (caller as any).university_id as string | null;
  if (!CAN_EDIT_ROLES.has(callerRole)) return bad("Forbidden: faqat admin rejalarni import qila oladi", 403);
  if (!universityId) return bad("Caller has no university assigned", 403);

  const formData = await req.formData().catch(() => null);
  if (!formData) return bad("Expected multipart/form-data");

  const file = formData.get("file") as File | null;
  if (!file) return bad("No file uploaded");
  const year = Number(formData.get("year"));
  const quarter = String(formData.get("quarter") ?? "") as Quarter;
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return bad("Yil noto'g'ri");
  if (!QUARTERS.includes(quarter)) return bad("Chorak noto'g'ri");

  const validationError = validateFile(file, EXCEL_IMPORT_FILE_RULE);
  if (validationError) return bad(validationError);

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.getWorksheet("Rejalar") ?? workbook.worksheets[0];
  if (!worksheet) return bad("Excel faylida varaq topilmadi");

  const admin = createAdminClient();
  const [indRes, deptRes] = await Promise.all([
    admin.from("indicators").select("*").eq("university_id", universityId),
    admin.from("departments").select("id, short_code, faculty_id").eq("university_id", universityId),
  ]);

  const indicators = (indRes.data as Indicator[]) ?? [];
  const parentIds = new Set(indicators.filter((i) => i.parent_id).map((i) => i.parent_id as string));
  const indByNo = new Map<string, Indicator>();
  indicators.forEach((i) => {
    if (!parentIds.has(i.id)) indByNo.set(String(i.no).trim().toUpperCase(), i);
  });
  const deptByCode = new Map<string, { id: string; faculty_id: string }>(
    ((deptRes.data as { id: string; short_code: string; faculty_id: string }[]) ?? []).map((d) => [
      d.short_code.trim().toUpperCase(),
      { id: d.id, faculty_id: d.faculty_id },
    ])
  );

  // Map each column index (>=3) to an indicator id, using the `no` in row 1.
  const headerRow = worksheet.getRow(1);
  const colToIndicator = new Map<number, Indicator>();
  const unknownColumns: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber <= 2) return; // cols 1,2 are dept code/name
    const no = cellText(cell.value).trim().toUpperCase();
    if (!no) return;
    const ind = indByNo.get(no);
    if (ind) colToIndicator.set(colNumber, ind);
    else unknownColumns.push(no);
  });

  if (colToIndicator.size === 0) {
    return bad("Hech qanday ko'rsatkich ustuni topilmadi. Shablondan foydalaning.");
  }

  type RowResult = { row: number; department: string; status: "success" | "error"; error?: string };
  const results: RowResult[] = [];
  const upserts: any[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = cellText(row.getCell(1).value).trim();
    const name = cellText(row.getCell(2).value).trim();
    const label = code || name;
    if (!code && !name) return; // skip blank rows

    const dept = deptByCode.get(code.toUpperCase());
    if (!dept) {
      results.push({ row: rowNumber, department: label, status: "error", error: `Kafedra kodi topilmadi: "${code}"` });
      return;
    }

    const values: Record<string, number | null> = {};
    let invalid: string | null = null;
    for (const [colNumber, ind] of colToIndicator) {
      const raw = cellText(row.getCell(colNumber).value).trim();
      if (!raw) continue;
      const n = Number(raw.replace(",", "."));
      if (Number.isNaN(n)) {
        invalid = `"${ind.no}" ustunida son emas: "${raw}"`;
        break;
      }
      values[ind.id] = n;
    }
    if (invalid) {
      results.push({ row: rowNumber, department: label, status: "error", error: invalid });
      return;
    }

    upserts.push({
      university_id: universityId,
      faculty_id: dept.faculty_id,
      department_id: dept.id,
      year,
      quarter,
      values,
      created_by: (caller as any).id,
    });
    results.push({ row: rowNumber, department: label, status: "success" });
  });

  if (upserts.length > 0) {
    const { error: e } = await admin
      .from("targets")
      .upsert(upserts, { onConflict: "department_id,year,quarter" });
    if (e) return bad(`Saqlashda xatolik: ${e.message}`, 500);
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  return NextResponse.json(
    { succeeded, failed, results, unknownColumns: [...new Set(unknownColumns)] },
    { status: 200 }
  );
}
