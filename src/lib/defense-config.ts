import type { UploadRule } from "@/lib/upload-validation";

const MB = 1024 * 1024;

export interface DefenseField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

// Section: "Dissertatsiya haqida ma'lumot"
export const DISSERTATION_FIELDS: DefenseField[] = [
  { key: "title", label: "Dissertatsiya mavzusi", type: "textarea", required: true },
  { key: "ilmiy_daraja", label: "Ilmiy daraja", type: "select", required: true, options: ["PhD", "DSc"] },
  { key: "ixtisoslik_shifri", label: "Ixtisoslik shifri", type: "text", required: true, placeholder: "Masalan: 05.01.01" },
  { key: "ixtisoslik_nomi", label: "Ixtisoslik nomi", type: "text", required: true },
  { key: "fan_sohasi", label: "Fan sohasi", type: "text", required: true },
  { key: "til", label: "Dissertatsiya tili", type: "select", required: true, options: ["O'zbek", "Rus", "Ingliz"] },
  { key: "sahifa_soni", label: "Sahifalar soni", type: "number", required: true },
  { key: "rahbar_fish", label: "Ilmiy rahbar F.I.Sh.", type: "text", required: true },
];

// Section: "Avtoreferat haqida ma'lumot"
export const AVTOREFERAT_FIELDS: DefenseField[] = [
  { key: "til", label: "Avtoreferat tili(lari)", type: "text", required: true, placeholder: "Masalan: O'zbek, Rus, Ingliz" },
  { key: "nashr_sanasi", label: "Nashr etilgan sana", type: "date", required: true },
  { key: "sahifa_soni", label: "Sahifalar soni", type: "number", required: true },
  { key: "adadi", label: "Adadi (nusxa soni)", type: "number", required: false },
];

export interface DefenseDocument {
  key: string;
  label: string;
  required: boolean;
  allowedExtensions: string[];
  maxBytes: number;
}

export const DEFENSE_DOCUMENTS: DefenseDocument[] = [
  { key: "rahbar_xulosasi", label: "Ilmiy rahbar xulosasi", required: true, allowedExtensions: [".pdf", ".doc", ".docx"], maxBytes: 10 * MB },
  { key: "plagiat_xulosasi", label: "Plagiat xulosasi", required: true, allowedExtensions: [".pdf"], maxBytes: 10 * MB },
  { key: "byuleten", label: "Byuleten", required: true, allowedExtensions: [".pdf"], maxBytes: 10 * MB },
  { key: "malakaviy_imtihon", label: "Malakaviy imtihon natijasi", required: true, allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"], maxBytes: 10 * MB },
  { key: "joriylanish", label: "Joriylanish dalolatnomasi", required: true, allowedExtensions: [".pdf"], maxBytes: 10 * MB },
  { key: "obyektivka", label: "Obyektivka", required: true, allowedExtensions: [".pdf", ".doc", ".docx"], maxBytes: 10 * MB },
  { key: "shakl_3_4", label: "3-4 shakl", required: true, allowedExtensions: [".pdf", ".doc", ".docx", ".xlsx"], maxBytes: 10 * MB },
  { key: "daraja_uz", label: "Daraja.uz da mavjudligi", required: true, allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"], maxBytes: 10 * MB },
  { key: "ariza", label: "Ariza", required: true, allowedExtensions: [".pdf", ".doc", ".docx"], maxBytes: 10 * MB },
  { key: "dalolatnoma_malumotnoma", label: "Dalolatnoma va ma'lumotnoma", required: true, allowedExtensions: [".pdf"], maxBytes: 10 * MB },
  { key: "qabul_buyrugi", label: "O'qishga qabul qilinganlik haqida buyruq", required: true, allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"], maxBytes: 10 * MB },
];

const EXTENSION_MIME: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

export function defenseDocumentRule(doc: DefenseDocument): UploadRule {
  return {
    maxBytes: doc.maxBytes,
    allowedExtensions: doc.allowedExtensions,
    allowedMimeTypes: Array.from(
      new Set(doc.allowedExtensions.flatMap((ext) => EXTENSION_MIME[ext] ?? []))
    ),
    label: doc.allowedExtensions.map((ext) => ext.replace(".", "").toUpperCase()).join(", "),
  };
}

export function findDefenseDocument(key: string): DefenseDocument | undefined {
  return DEFENSE_DOCUMENTS.find((d) => d.key === key);
}

export const DEFENSE_STORAGE_BUCKET = "defense-applications";
