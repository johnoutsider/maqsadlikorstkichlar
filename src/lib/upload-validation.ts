export interface UploadRule {
  maxBytes: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  label: string;
}

const MB = 1024 * 1024;

export const SUBMISSION_FILE_RULE: UploadRule = {
  maxBytes: 10 * MB,
  allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xlsx"],
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  label: "PDF, JPG, PNG, DOC, DOCX yoki XLSX",
};

export const PROGRESS_REPORT_FILE_RULE: UploadRule = {
  maxBytes: 10 * MB,
  allowedExtensions: [".pdf", ".doc", ".docx"],
  allowedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  label: "PDF, DOC yoki DOCX",
};

export const IMAGE_FILE_RULE: UploadRule = {
  maxBytes: 5 * MB,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  label: "JPG, PNG yoki WEBP",
};

export const EXCEL_IMPORT_FILE_RULE: UploadRule = {
  maxBytes: 2 * MB,
  allowedExtensions: [".xlsx"],
  allowedMimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  label: "XLSX",
};

export const MAX_BULK_IMPORT_ROWS = 500;

export function acceptAttribute(rule: UploadRule) {
  return rule.allowedExtensions.join(",");
}

export function validateFile(file: Pick<File, "name" | "size" | "type">, rule: UploadRule): string | null {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = rule.allowedExtensions.some((extension) => lowerName.endsWith(extension));

  if (!hasAllowedExtension) {
    return `Fayl formati noto'g'ri. Ruxsat etilgan: ${rule.label}.`;
  }

  if (file.size > rule.maxBytes) {
    return `Fayl hajmi ${(rule.maxBytes / MB).toFixed(0)} MB dan oshmasligi kerak.`;
  }

  if (file.type && !rule.allowedMimeTypes.includes(file.type)) {
    return `Fayl turi noto'g'ri. Ruxsat etilgan: ${rule.label}.`;
  }

  return null;
}

export function isPdf(file: Pick<File, "name" | "type">): boolean {
  return file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
}

export async function getPdfPageCount(file: File): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return doc.getPageCount();
}

export function validatePageRange(pages: number, min: number | null, max: number | null): string | null {
  if (min !== null && pages < min) {
    const maxStr = max !== null ? String(max) : "∞";
    return `Fayl ${pages} betdan iborat. Ruxsat etilgan: ${min}–${maxStr} bet.`;
  }
  if (max !== null && pages > max) {
    const minStr = min !== null ? String(min) : "1";
    return `Fayl ${pages} betdan iborat. Ruxsat etilgan: ${minStr}–${max} bet.`;
  }
  return null;
}

export function safeStorageFileName(name: string) {
  const trimmed = name.trim() || "file";
  return trimmed.replace(/[^\w.-]+/g, "_").replace(/^_+/, "").slice(0, 120) || "file";
}
