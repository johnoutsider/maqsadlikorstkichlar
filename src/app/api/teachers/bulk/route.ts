import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXCEL_IMPORT_FILE_RULE,
  MAX_BULK_IMPORT_ROWS,
  validateFile,
} from "@/lib/upload-validation";
import {
  ILMIY_DARAJA_LABEL,
  ILMIY_UNVON_LABEL,
  ISH_TURI_LABEL,
  LAVOZIM_OPTIONS,
  STAVKA_OPTIONS,
  labelToSlug,
} from "@/app/(shared)/teachers/_lib/options";
import type { RoleName, Stavka } from "@/types/db";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText))
      return value.richText.map((p) => p.text).join("");
    if ("hyperlink" in value && "text" in value && typeof (value as any).text === "string")
      return (value as any).text;
  }
  return String(value);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[''ʼ`]/g, "'");

// Header aliases → canonical field key
const HEADER_ALIASES: Record<string, string> = {
  // name
  "f.i.sh": "name", "f.i.sh.": "name", "fish": "name", "fio": "name",
  "f.i.o": "name", "f.i.o.": "name", "to'liq ism": "name", "toliq ism": "name",
  // birth
  "tug'ilgan_yili": "birth", "tugulgan_yili": "birth", "tug'ilgan sana": "birth",
  "tug'ilgan_sana": "birth", "birth_date": "birth",
  // gender
  "jinsi": "gender", "jins": "gender",
  // faculty
  "fakultet": "faculty", "faculty": "faculty",
  // department
  "kafedra nomi": "dept", "kafedra": "dept", "department": "dept",
  "kafedra_nomi": "dept",
  // lavozim
  "lavozimi": "lavozim", "lavozim": "lavozim",
  // stavka
  "stavkasi": "stavka", "stavka": "stavka",
  // ish_turi
  "holati": "ish_turi", "ish turi": "ish_turi", "ish_turi": "ish_turi",
  "faoliyat": "ish_turi",
  // ilmiy_unvon
  "ilmiy unvoni": "ilmiy_unvon", "ilmiy_unvon": "ilmiy_unvon", "unvon": "ilmiy_unvon",
  // ilmiy_daraja
  "ilmiy darajasi": "ilmiy_daraja", "ilmiy_daraja": "ilmiy_daraja", "daraja": "ilmiy_daraja",
};

function parseDate(raw: string): string | null {
  if (!raw) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD.MM.YYYY or DD/MM/YYYY
  const m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parseStavka(raw: string): Stavka | null {
  const n = raw.replace(",", ".").trim();
  // Normalize "1" → "1.0"
  const map: Record<string, Stavka> = {
    "0.25": "0.25", ".25": "0.25",
    "0.5": "0.5", ".5": "0.5", "0,5": "0.5",
    "0.75": "0.75", ".75": "0.75",
    "1": "1.0", "1.0": "1.0",
    "1.25": "1.25",
    "1.5": "1.5",
  };
  return map[n] ?? null;
}

function normalizeLavozim(raw: string): string | null {
  if (!raw) return null;
  const n = norm(raw);
  const match = LAVOZIM_OPTIONS.find((l) => norm(l) === n);
  return (match ?? raw.trim()) || null;
}

// ---------------------------------------------------------------------------
// GET — download template
// ---------------------------------------------------------------------------

export async function GET() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("O'qituvchilar");

  const headers = [
    "F.I.Sh",
    "Tug'ilgan sana",
    "Jinsi",
    "Fakultet",
    "Kafedra",
    "Lavozimi",
    "Stavkasi",
    "Ish turi",
    "Ilmiy unvoni",
    "Ilmiy darajasi",
  ];

  ws.addRow(headers);
  ws.addRow([
    "Karimov Alisher Bahodirovich",
    "15.03.1985",
    "erkak",
    "Tarjimonlik",
    "Arab tili tarjima nazariyasi va amaliyoti kafedrasi",
    "O'qituvchi",
    "1.0",
    "Asosiy",
    "Dotsent",
    "PhD",
  ]);

  // Bold header row
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((col) => { col.width = 28; });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="teachers-template.xlsx"',
    },
  });
}

// ---------------------------------------------------------------------------
// POST — bulk import
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return bad("Not authenticated", 401);

  const { data: caller } = await supabase
    .from("users")
    .select("university_id, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!caller) return bad("Caller profile missing", 403);

  const callerRole = (caller as any).roles.name as RoleName;
  const callerUniversityId = (caller as any).university_id as string | null;

  if (callerRole !== "super_admin" && callerRole !== "university_admin")
    return bad("Faqat universitet admini o'qituvchilarni ommaviy import qila oladi", 403);
  if (callerRole === "university_admin" && !callerUniversityId)
    return bad("Caller has no university assigned", 403);

  const formData = await req.formData().catch(() => null);
  if (!formData) return bad("Expected multipart/form-data");

  const file = formData.get("file") as File | null;
  if (!file) return bad("No file uploaded");

  const validationError = validateFile(file, EXCEL_IMPORT_FILE_RULE);
  if (validationError) return bad(validationError);

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return bad("Excel faylida varaq topilmadi");

  const MAX_TEACHER_ROWS = 2000;
  // worksheet.rowCount includes blank styled rows; count only non-empty rows after header
  let nonEmptyDataRows = 0;
  worksheet.eachRow({ includeEmpty: false }, (_, rowNumber) => {
    if (rowNumber > 1) nonEmptyDataRows++;
  });
  if (nonEmptyDataRows > MAX_TEACHER_ROWS)
    return bad(`Excel faylida ko'pi bilan ${MAX_TEACHER_ROWS} ta qator bo'lishi mumkin.`);

  // Build header → field map from row 1
  const fieldCol: Record<string, number> = {};
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = HEADER_ALIASES[norm(cellText(cell.value))];
    if (key) fieldCol[key] = colNumber;
  });

  const required = ["name", "dept"];
  for (const r of required) {
    if (!fieldCol[r]) return bad(`Majburiy ustun topilmadi: "${r === "name" ? "F.I.Sh" : "Kafedra"}"`);
  }

  const admin = createAdminClient();

  // Load reference data
  const universityId = callerRole === "super_admin" ? null : callerUniversityId;

  const [facRes, deptRes, existingRes] = await Promise.all([
    universityId
      ? admin.from("faculties").select("id, name").eq("university_id", universityId)
      : admin.from("faculties").select("id, name"),
    universityId
      ? admin.from("departments").select("id, name, faculty_id").eq("university_id", universityId)
      : admin.from("departments").select("id, name, faculty_id"),
    universityId
      ? admin.from("teachers").select("id, department_id, last_name, first_name, middle_name").eq("university_id", universityId)
      : admin.from("teachers").select("id, department_id, last_name, first_name, middle_name"),
  ]);

  // Department name → [{id, faculty_id}] (may have duplicates across faculties)
  const deptMap = new Map<string, { id: string; faculty_id: string }[]>();
  for (const d of (deptRes.data ?? []) as { id: string; name: string; faculty_id: string }[]) {
    const key = norm(d.name);
    if (!deptMap.has(key)) deptMap.set(key, []);
    deptMap.get(key)!.push({ id: d.id, faculty_id: d.faculty_id });
  }

  // Faculty name → id
  const facMap = new Map<string, string>();
  for (const f of (facRes.data ?? []) as { id: string; name: string }[]) {
    facMap.set(norm(f.name), f.id);
  }

  // key → existing teacher id (for upsert)
  const existingMap = new Map<string, string>();
  for (const t of (existingRes.data ?? []) as { id: string; department_id: string; last_name: string; first_name: string; middle_name: string | null }[]) {
    existingMap.set(`${t.department_id}|${t.last_name.toLowerCase()}|${t.first_name.toLowerCase()}|${(t.middle_name ?? "").toLowerCase()}`, t.id);
  }

  // Process rows
  type RowResult = {
    row: number;
    name: string;
    status: "success" | "updated" | "error";
    error?: string;
  };
  const results: RowResult[] = [];

  const col = (row: ExcelJS.Row, field: string) =>
    fieldCol[field] ? cellText(row.getCell(fieldCol[field]).value).trim() : "";

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);

    const rawName = col(row, "name");
    if (!rawName) continue; // blank row

    const fail = (msg: string) => results.push({ row: rowNum, name: rawName, status: "error", error: msg });

    // Split name
    const parts = rawName.trim().split(/\s+/);
    const last_name   = parts[0] ?? "";
    const first_name  = parts[1] ?? "";
    const middle_name = parts.slice(2).join(" ") || null;

    if (!last_name || !first_name) { fail("F.I.Sh kamida 2 so'zdan iborat bo'lishi kerak"); continue; }

    // Resolve department
    const rawDept = col(row, "dept");
    const rawFaculty = col(row, "faculty");
    const deptCandidates = deptMap.get(norm(rawDept));
    if (!deptCandidates || deptCandidates.length === 0) {
      fail(`Kafedra topilmadi: "${rawDept}"`); continue;
    }

    let deptId: string;
    let facultyId: string;

    if (deptCandidates.length === 1) {
      deptId   = deptCandidates[0].id;
      facultyId = deptCandidates[0].faculty_id;
    } else if (rawFaculty) {
      // Disambiguate by faculty name
      const facId = facMap.get(norm(rawFaculty));
      const match = facId ? deptCandidates.find((d) => d.faculty_id === facId) : null;
      if (!match) { fail(`Kafedra "${rawDept}" bir nechta fakultetda mavjud, lekin "${rawFaculty}" fakulteti topilmadi`); continue; }
      deptId   = match.id;
      facultyId = match.faculty_id;
    } else {
      fail(`Kafedra "${rawDept}" bir nechta fakultetda mavjud — Fakultet ustunini to'ldiring`); continue;
    }

    // Build lookup key
    const dupKey = `${deptId}|${last_name.toLowerCase()}|${first_name.toLowerCase()}|${(middle_name ?? "").toLowerCase()}`;
    const existingId = existingMap.get(dupKey);

    // Parse fields
    const birth_date   = parseDate(col(row, "birth")) ?? null;
    const genderRaw    = norm(col(row, "gender"));
    const gender       = genderRaw === "erkak" || genderRaw === "ayol" ? genderRaw : null;
    const lavozim      = normalizeLavozim(col(row, "lavozim"));
    const stavka       = parseStavka(col(row, "stavka")) ?? null;
    const ilmiy_unvon  = labelToSlug(ILMIY_UNVON_LABEL,  col(row, "ilmiy_unvon"))  ?? null;
    const ilmiy_daraja = labelToSlug(ILMIY_DARAJA_LABEL, col(row, "ilmiy_daraja")) ?? null;
    const ish_turi     = labelToSlug(ISH_TURI_LABEL,      col(row, "ish_turi"))     ?? null;

    if (existingId) {
      // UPDATE existing teacher (preserve phone/email/created_by)
      const { error: updateErr } = await admin.from("teachers").update({
        faculty_id:    facultyId,
        department_id: deptId,
        last_name,
        first_name,
        middle_name,
        birth_date,
        gender,
        lavozim,
        stavka,
        ish_turi,
        ilmiy_unvon,
        ilmiy_daraja,
      }).eq("id", existingId);
      if (updateErr) { fail(updateErr.message); continue; }
      existingMap.set(dupKey, existingId); // already there, no-op — prevents within-file dups
      results.push({ row: rowNum, name: rawName, status: "updated" });
    } else {
      // INSERT new teacher
      const { error: dbErr } = await admin.from("teachers").insert({
        university_id:   callerRole === "super_admin" ? null : callerUniversityId,
        faculty_id:      facultyId,
        department_id:   deptId,
        last_name,
        first_name,
        middle_name,
        birth_date,
        gender,
        phone:           null,
        email:           null,
        lavozim,
        stavka,
        ish_turi,
        ilmiy_unvon,
        ilmiy_daraja,
        faoliyat_holati: "faol",
        created_by:      authUser.id,
      });
      if (dbErr) { fail(dbErr.message); continue; }
      existingMap.set(dupKey, "new"); // prevent within-file duplicates
      results.push({ row: rowNum, name: rawName, status: "success" });
    }
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const updated   = results.filter((r) => r.status === "updated").length;
  const failed    = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ succeeded, updated, failed, results }, { status: 200 });
}
