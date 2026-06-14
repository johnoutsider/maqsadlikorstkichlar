import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXCEL_IMPORT_FILE_RULE,
  validateFile,
} from "@/lib/upload-validation";
import {
  classifyTuri,
  norm,
  normalizeGender,
} from "@/app/(shared)/izlanuvchilar/_lib/options";
import type { IzlanuvchiTuri, RoleName } from "@/types/db";

export const runtime = "nodejs";

const MAX_IZLANUVCHI_IMPORT_ROWS = 2000;
const PAGE_SIZE = 1000;

type FieldKey =
  | "source_no"
  | "full_name"
  | "specialty_name"
  | "specialty_code"
  | "education_stage"
  | "admission_year"
  | "age"
  | "gender"
  | "pinfl"
  | "submission_date"
  | "course"
  | "monitoring_1"
  | "monitoring_2"
  | "monitoring_3"
  | "district"
  | "research_topic"
  | "supervisor_name"
  | "status";

type ExistingRow = {
  id: string;
  turi: IzlanuvchiTuri;
  full_name: string;
  specialty_code: string | null;
  pinfl: string | null;
  metadata: Record<string, unknown> | null;
};

type RowResult = {
  row: number;
  name: string;
  pinfl: string;
  status: "success" | "updated" | "error";
  error?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("hyperlink" in value && "text" in value && typeof value.text === "string") {
      return value.text;
    }
  }
  return String(value);
}

function headerKey(value: string) {
  return norm(value)
    .replace(/[_.:/\\()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_ALIASES: Record<string, FieldKey> = {
  "#": "source_no",
  "№": "source_no",
  "no": "source_no",
  "n": "source_no",
  "t r": "source_no",

  "talabgor f i o": "full_name",
  "talabgor fio": "full_name",
  "talabgor f i sh": "full_name",
  "talabgor fish": "full_name",
  "f i o": "full_name",
  "fio": "full_name",
  "f i sh": "full_name",
  "fish": "full_name",
  "to'liq ism": "full_name",

  "ixtisoslik nomi": "specialty_name",
  "mutaxassislik nomi": "specialty_name",
  "ixtisoslik": "specialty_name",

  "ixtisoslik shifri": "specialty_code",
  "ixtisoslik kodi": "specialty_code",
  "mutaxassislik shifri": "specialty_code",
  "shifr": "specialty_code",

  "ta'lim bosqichi": "education_stage",
  "talim bosqichi": "education_stage",
  "ta'lim shakli": "education_stage",
  "talim shakli": "education_stage",

  "o'qishga kirgan yil": "admission_year",
  "o'qishga kirgan yili": "admission_year",
  "o'qishga kirgan": "admission_year",
  "oqishga kirgan yil": "admission_year",
  "oqishga kirgan yili": "admission_year",
  "qabul yili": "admission_year",

  "yoshi": "age",
  "yosh": "age",
  "jinsi": "gender",
  "jins": "gender",
  "pinfl": "pinfl",
  "pnfl": "pinfl",
  "jshshir": "pinfl",

  "topshirgan vaqti": "submission_date",
  "topshirqan vaqti": "submission_date",
  "topshirilgan vaqt": "submission_date",
  "topshirish sanasi": "submission_date",

  "kursi": "course",
  "kurs": "course",
  "monitoring natijasi 1": "monitoring_1",
  "monitoring 1": "monitoring_1",
  "1 monitoring": "monitoring_1",
  "monitoring natijasi 2": "monitoring_2",
  "monitoring 2": "monitoring_2",
  "2 monitoring": "monitoring_2",
  "monitoring natijasi 3": "monitoring_3",
  "monitoring 3": "monitoring_3",
  "3 monitoring": "monitoring_3",

  "tumani": "district",
  "tuman": "district",
  "ilmiy ish mavzusi": "research_topic",
  "dissertatsiya mavzusi": "research_topic",
  "ilmiy mavzu": "research_topic",
  "ilmiy rahbar": "supervisor_name",
  "ilmiy raxbari": "supervisor_name",
  "ilmiy rahbari": "supervisor_name",
  "ilmiy rahbar f i o": "supervisor_name",
  "rahbar": "supervisor_name",
  "holat": "status",
  "holati": "status",
  "statesi": "status",
  "statusi": "status",
  "status": "status",
};

function parseDateValue(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 0) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  if (typeof value === "object" && value && "result" in value) {
    return parseDateValue(value.result as ExcelJS.CellValue);
  }

  const raw = cellText(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dayFirst = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function parseAge(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 && value <= 120 ? value : null;
}

function normalizePinfl(raw: string) {
  return raw.trim().replace(/\s+/g, "").replace(/\.0$/, "");
}

function fallbackKey(
  turi: IzlanuvchiTuri,
  fullName: string,
  specialtyCode: string
) {
  return `${turi}|${norm(fullName)}|${norm(specialtyCode)}`;
}

function isMissingSourceNoColumn(error: { message?: string } | null) {
  return Boolean(error?.message?.toLowerCase().includes("source_no"));
}

function withoutSourceNo<T extends { source_no: string | null }>(
  payload: T
): Omit<T, "source_no"> {
  const copy: Partial<T> = { ...payload };
  delete copy.source_no;
  return copy as Omit<T, "source_no">;
}

async function loadExistingRows(
  admin: ReturnType<typeof createAdminClient>,
  universityId: string
) {
  const rows: ExistingRow[] = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await admin
      .from("izlanuvchilar")
      .select("id, turi, full_name, specialty_code, pinfl, metadata")
      .eq("university_id", universityId)
      .order("id")
      .range(start, start + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (data as ExistingRow[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Izlanuvchilar");

  worksheet.addRow([
    "#",
    "Tashkilot nomi",
    "Joylashgan hudud",
    "Tashkilot turi",
    "Talabgor F.I.O",
    "Ixtisoslik nomi",
    "Ixtisoslik shifri",
    "Ta'lim bosqichi",
    "O'qishga kirgan yil",
    "Yoshi",
    "Jinsi",
    "PINFL",
    "Topshirgan vaqti",
    "Kursi",
    "Monitoring natijasi 1",
    "Monitoring natijasi 2",
    "Monitoring natijasi 3",
    "Tumani",
    "Ilmiy ish mavzusi",
    "Ilmiy rahbar",
    "Holat",
  ]);
  worksheet.addRow([
    "1",
    "",
    "",
    "",
    "Karimov Alisher Bahodirovich",
    "Filologiya fanlari",
    "10.00.04",
    "Tayanch doktorantura, PhD",
    "2025",
    28,
    "Erkak",
    "30101991234567",
    "15.09.2025",
    "1-kurs",
    "",
    "",
    "",
    "Chilonzor tumani",
    "Zamonaviy tilshunoslik masalalari",
    "Dots. A. A. Rahimov",
    "Talabgor o'qishga qabul qilingan",
  ]);
  worksheet.addRow([
    "2",
    "",
    "",
    "",
    "Aliyeva Mohira Komilovna",
    "Pedagogika fanlari",
    "13.00.02",
    "Mustaqil tadqiqotchi, PhD",
    "2025",
    32,
    "Ayol",
    "30202991234567",
    "20.09.2025",
    "",
    "",
    "",
    "",
    "Yunusobod tumani",
    "Ta'limda raqamli texnologiyalar",
    "Prof. B. B. Ergashev",
    "O'qishni davom ettirmoqda",
  ]);

  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF5B21B6" },
  };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 34;
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: "A1", to: "U1" };
  worksheet.columns.forEach((column, index) => {
    column.width = [8, 28, 22, 22, 34, 28, 18, 30, 20, 10, 12, 18, 20, 14, 22, 22, 22, 22, 38, 30, 34][index];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="izlanuvchilar-template.xlsx"',
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return bad("Tizimga kirmagansiz.", 401);

  const { data: caller } = await supabase
    .from("users")
    .select("university_id, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!caller) return bad("Foydalanuvchi profili topilmadi.", 403);

  const callerRole = (caller as any).roles.name as RoleName;
  const callerUniversityId = (caller as any).university_id as string | null;
  const allowedRoles: RoleName[] = [
    "science_department",
    "university_admin",
    "super_admin",
  ];
  if (!allowedRoles.includes(callerRole)) {
    return bad("Izlanuvchilarni import qilish uchun ruxsat yo'q.", 403);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return bad("multipart/form-data kutilgan.");

  const requestedUniversityId =
    callerRole === "super_admin"
      ? String(formData.get("university_id") ?? callerUniversityId ?? "").trim()
      : callerUniversityId;
  if (!requestedUniversityId) {
    return bad("Import uchun universitet aniqlanmadi.", 400);
  }

  const file = formData.get("file") as File | null;
  if (!file) return bad("Excel fayli tanlanmagan.");

  const validationError = validateFile(file, EXCEL_IMPORT_FILE_RULE);
  if (validationError) return bad(validationError);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return bad("Excel faylida varaq topilmadi.");

  let headerRowNumber = 0;
  let fieldColumns: Partial<Record<FieldKey, number>> = {};
  let excelHeaders = new Map<number, string>();

  for (let rowNumber = 1; rowNumber <= Math.min(20, worksheet.rowCount); rowNumber++) {
    const candidate: Partial<Record<FieldKey, number>> = {};
    const candidateHeaders = new Map<number, string>();
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, column) => {
      const header = cellText(cell.value).trim();
      candidateHeaders.set(column, header);
      if (column >= 2 && column <= 4) return;
      const key = HEADER_ALIASES[headerKey(header)];
      if (key) candidate[key] = column;
    });

    if (candidate.full_name && Object.keys(candidate).length >= 3) {
      headerRowNumber = rowNumber;
      fieldColumns = candidate;
      excelHeaders = candidateHeaders;
      break;
    }
  }

  if (!headerRowNumber || !fieldColumns.full_name) {
    return bad('Majburiy "Talabgor F.I.O" ustuni topilmadi.');
  }

  let nonEmptyRows = 0;
  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cellText(cell.value).trim()) hasValue = true;
    });
    if (hasValue) nonEmptyRows++;
  }
  if (nonEmptyRows > MAX_IZLANUVCHI_IMPORT_ROWS) {
    return bad(
      `Excel faylida ko'pi bilan ${MAX_IZLANUVCHI_IMPORT_ROWS} ta ma'lumot qatori bo'lishi mumkin.`
    );
  }

  const admin = createAdminClient();
  let existingRows: ExistingRow[];
  try {
    existingRows = await loadExistingRows(admin, requestedUniversityId);
  } catch (error: any) {
    return bad(error.message ?? "Mavjud izlanuvchilarni o'qib bo'lmadi.", 500);
  }

  const byPinfl = new Map<string, string>();
  const byFallback = new Map<string, string>();
  const byId = new Map<string, ExistingRow>();
  for (const row of existingRows) {
    byId.set(row.id, row);
    if (row.pinfl) {
      byPinfl.set(normalizePinfl(row.pinfl), row.id);
    } else {
      byFallback.set(
        fallbackKey(row.turi, row.full_name, row.specialty_code ?? ""),
        row.id
      );
    }
  }

  const columnText = (row: ExcelJS.Row, key: FieldKey) => {
    const column = fieldColumns[key];
    return column ? cellText(row.getCell(column).value).trim() : "";
  };

  const rawExcelColumns = (row: ExcelJS.Row) => {
    const columns: Record<string, { header: string; value: string }> = {};
    for (let column = 1; column <= worksheet.columnCount; column++) {
      if (column >= 2 && column <= 4) continue;
      const letter = worksheet.getColumn(column).letter;
      columns[letter] = {
        header: excelHeaders.get(column) || letter,
        value: cellText(row.getCell(column).value).trim(),
      };
    }
    return columns;
  };

  const results: RowResult[] = [];

  for (
    let rowNumber = headerRowNumber + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber++
  ) {
    const row = worksheet.getRow(rowNumber);
    const fullName = columnText(row, "full_name");
    const specialtyCode = columnText(row, "specialty_code");
    const pinfl = normalizePinfl(columnText(row, "pinfl"));

    if (!fullName && !specialtyCode && !pinfl) continue;

    const fail = (message: string) =>
      results.push({
        row: rowNumber,
        name: fullName,
        pinfl,
        status: "error",
        error: message,
      });

    if (!fullName) {
      fail("Talabgor F.I.O bo'sh.");
      continue;
    }

    const ageRaw = columnText(row, "age");
    const age = parseAge(ageRaw);
    if (ageRaw && age === null) {
      fail("Yosh 0 dan 120 gacha bo'lgan son bo'lishi kerak.");
      continue;
    }

    const genderRaw = columnText(row, "gender");
    const gender = normalizeGender(genderRaw);
    if (genderRaw && !gender) {
      fail(`Jins qiymati noto'g'ri: "${genderRaw}".`);
      continue;
    }

    const submissionCell = fieldColumns.submission_date
      ? row.getCell(fieldColumns.submission_date).value
      : null;
    const submissionDate = parseDateValue(submissionCell);
    if (columnText(row, "submission_date") && !submissionDate) {
      fail("Topshirgan vaqti sana sifatida o'qilmadi.");
      continue;
    }

    const educationStage = columnText(row, "education_stage");
    const turi: IzlanuvchiTuri = classifyTuri(educationStage);
    const key = fallbackKey(turi, fullName, specialtyCode);
    const existingId = pinfl
      ? byPinfl.get(pinfl) ?? byFallback.get(key)
      : byFallback.get(key);
    const existing = existingId ? byId.get(existingId) : undefined;

    const payload = {
      university_id: requestedUniversityId,
      turi,
      source_no: columnText(row, "source_no") || null,
      full_name: fullName,
      specialty_name: columnText(row, "specialty_name") || null,
      specialty_code: specialtyCode || null,
      education_stage: educationStage || null,
      admission_year: columnText(row, "admission_year") || null,
      age,
      gender,
      pinfl: pinfl || null,
      submission_date: submissionDate,
      course: columnText(row, "course") || null,
      monitoring_1: columnText(row, "monitoring_1") || null,
      monitoring_2: columnText(row, "monitoring_2") || null,
      monitoring_3: columnText(row, "monitoring_3") || null,
      district: columnText(row, "district") || null,
      research_topic: columnText(row, "research_topic") || null,
      supervisor_name: columnText(row, "supervisor_name") || null,
      status: columnText(row, "status") || null,
      metadata: {
        ...(existing?.metadata ?? {}),
        excel_columns: rawExcelColumns(row),
      },
    };

    if (existingId) {
      let { error } = await admin
        .from("izlanuvchilar")
        .update(payload)
        .eq("id", existingId);
      if (isMissingSourceNoColumn(error)) {
        ({ error } = await admin
          .from("izlanuvchilar")
          .update(withoutSourceNo(payload))
          .eq("id", existingId));
      }
      if (error) {
        fail(error.message);
        continue;
      }

      if (existing) {
        existing.turi = turi;
        existing.full_name = fullName;
        existing.specialty_code = specialtyCode || null;
        existing.pinfl = pinfl || null;
        existing.metadata = payload.metadata;
      }
      if (pinfl) {
        byPinfl.set(pinfl, existingId);
        byFallback.delete(key);
      } else {
        byFallback.set(key, existingId);
      }
      results.push({ row: rowNumber, name: fullName, pinfl, status: "updated" });
      continue;
    }

    let { data: inserted, error } = await admin
      .from("izlanuvchilar")
      .insert(payload)
      .select("id")
      .single();
    if (isMissingSourceNoColumn(error)) {
      ({ data: inserted, error } = await admin
        .from("izlanuvchilar")
        .insert(withoutSourceNo(payload))
        .select("id")
        .single());
    }
    if (error || !inserted) {
      fail(error?.message ?? "Yozuvni yaratib bo'lmadi.");
      continue;
    }

    const insertedId = (inserted as { id: string }).id;
    const insertedRow: ExistingRow = {
      id: insertedId,
      turi,
      full_name: fullName,
      specialty_code: specialtyCode || null,
      pinfl: pinfl || null,
      metadata: payload.metadata,
    };
    existingRows.push(insertedRow);
    byId.set(insertedId, insertedRow);
    if (pinfl) byPinfl.set(pinfl, insertedId);
    else byFallback.set(key, insertedId);

    results.push({ row: rowNumber, name: fullName, pinfl, status: "success" });
  }

  return NextResponse.json({
    succeeded: results.filter((result) => result.status === "success").length,
    updated: results.filter((result) => result.status === "updated").length,
    failed: results.filter((result) => result.status === "error").length,
    results,
  });
}
