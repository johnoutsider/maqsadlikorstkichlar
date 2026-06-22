"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Izlanuvchi, IzlanuvchiTuri } from "@/types/db";
import {
  GENDER_OPTIONS,
  STATUS_OPTIONS,
  TALIM_SHAKLI_OPTIONS,
  genderLabel,
  statusBadgeClass,
} from "../_lib/options";
import {
  getIzlanuvchilarCache,
  invalidateIzlanuvchilarCache,
  setIzlanuvchilarCache,
} from "../_lib/cache";

type Filters = {
  educationStage: string;
  status: string;
  specialtyCode: string;
  chorak: string;
  gender: string;
};

type BulkRow = {
  row: number;
  name: string;
  pinfl: string;
  status: "success" | "updated" | "error";
  error?: string;
};

const EMPTY_FILTERS: Filters = {
  educationStage: "",
  status: "",
  specialtyCode: "",
  chorak: "",
  gender: "",
};

function Icon({
  children,
  label,
  tone = "neutral",
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  tone?: "neutral" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
        tone === "danger"
          ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
          : "border-surface-200 text-surface-600 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-700"
      }`}
    >
      {children}
    </button>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-surface-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-surface-800 dark:text-surface-100">
        {value || "—"}
      </dd>
    </div>
  );
}

function importedSourceNo(row: Izlanuvchi) {
  if (row.source_no) return row.source_no;
  const excelColumns = row.metadata?.excel_columns;
  if (!excelColumns || typeof excelColumns !== "object") return null;
  const columnA = (excelColumns as Record<string, unknown>).A;
  if (!columnA || typeof columnA !== "object") return null;
  const value = (columnA as Record<string, unknown>).value;
  return typeof value === "string" && value ? value : null;
}

function departmentName(row: Izlanuvchi) {
  const department = (row as Izlanuvchi & {
    departments?: { name?: string | null } | null;
  }).departments;
  return department?.name ?? null;
}

type HalfYearScores = { h1: number | null; h2: number | null };

function scoreClass(score: number) {
  if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300";
  if (score >= 60) return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
}

// ponytail: parses the period string produced by MonitoringEvaluationForm
// ("2026 yil, 1 yarim yillik hisobot") instead of adding a dedicated year/half column.
function parseMonitoringPeriod(period: string) {
  const year = period.match(/(\d{4})\s*yil/)?.[1];
  const half = period.match(/([12])\s*yarim/)?.[1];
  return { year: year ?? "", half: half ?? "" };
}

function latestHalfYearScores(
  evaluations: { monitoring_period: string; total_score: number; created_at: string }[]
): HalfYearScores {
  if (!evaluations.length) return { h1: null, h2: null };
  const latestYear = evaluations.reduce((max, item) => {
    const { year } = parseMonitoringPeriod(item.monitoring_period);
    return year > max ? year : max;
  }, "");

  const pickLatest = (half: string) =>
    evaluations
      .filter((item) => {
        const parsed = parseMonitoringPeriod(item.monitoring_period);
        return parsed.year === latestYear && parsed.half === half;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.total_score ?? null;

  return { h1: pickLatest("1"), h2: pickLatest("2") };
}

export function IzlanuvchilarTable({
  turi,
  title,
  basePath = "/izlanuvchilar",
}: {
  turi: IzlanuvchiTuri;
  title: string;
  basePath?: string;
}) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const { user } = useSupabaseAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Izlanuvchi[]>(getIzlanuvchilarCache(turi) ?? []);
  const [monitoringByIzlanuvchi, setMonitoringByIzlanuvchi] = useState<
    Record<string, HalfYearScores>
  >({});
  const [loading, setLoading] = useState(getIzlanuvchilarCache(turi) === null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50 | 100>(10);
  const [viewing, setViewing] = useState<Izlanuvchi | null>(null);
  const [exporting, setExporting] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResultOpen, setBulkResultOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkRow[]>([]);
  const [bulkSummary, setBulkSummary] = useState({
    succeeded: 0,
    updated: 0,
    failed: 0,
  });

  const canAddEdit = ["science_department", "university_admin", "super_admin", "monitor"].includes(
    user?.role ?? ""
  );
  const canImport = ["science_department", "university_admin", "super_admin"].includes(
    user?.role ?? ""
  );
  const canDelete = canImport;

  const load = useCallback(
    async (force = false) => {
      if (!user) return;
      const cached = getIzlanuvchilarCache(turi);
      if (!force && cached !== null) {
        setRows(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      const { data, error: databaseError } = await supabase
        .from("izlanuvchilar")
        .select("*, departments(name)")
        .eq("turi", turi)
        .order("full_name");

      if (databaseError) {
        setError(databaseError.message);
        setLoading(false);
        return;
      }

      const nextRows = (data as Izlanuvchi[] | null) ?? [];
      setIzlanuvchilarCache(turi, nextRows);
      setRows(nextRows);
      setLoading(false);

      if (nextRows.length) {
        // ponytail: fetch all evaluations and group client-side. Filtering by
        // .in() with 750+ UUIDs blows the PostgREST URL-length limit and fails
        // silently — the mustaqil list never showed scores because of that.
        const { data: evaluations, error: evaluationError } = await supabase
          .from("monitoring_evaluations")
          .select("izlanuvchi_id, monitoring_period, total_score, created_at")
          .not("izlanuvchi_id", "is", null);

        if (evaluationError) {
          setMonitoringByIzlanuvchi({});
          return;
        }

        const grouped = new Map<string, { monitoring_period: string; total_score: number; created_at: string }[]>();
        (evaluations ?? []).forEach((evaluation) => {
          const list = grouped.get(evaluation.izlanuvchi_id as string) ?? [];
          list.push(evaluation);
          grouped.set(evaluation.izlanuvchi_id as string, list);
        });

        const nextMonitoring: Record<string, HalfYearScores> = {};
        grouped.forEach((list, izlanuvchiId) => {
          nextMonitoring[izlanuvchiId] = latestHalfYearScores(list);
        });
        setMonitoringByIzlanuvchi(nextMonitoring);
      } else {
        setMonitoringByIzlanuvchi({});
      }
    },
    [supabase, turi, user]
  );

  useEffect(() => {
    setRows(getIzlanuvchilarCache(turi) ?? []);
    setLoading(getIzlanuvchilarCache(turi) === null);
    load();
  }, [load, turi]);

  useEffect(() => {
    setPage(1);
  }, [search, filters, pageSize]);

  const educationOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...TALIM_SHAKLI_OPTIONS,
          ...(rows.map((row) => row.education_stage).filter(Boolean) as string[]),
        ])
      ).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...STATUS_OPTIONS,
          ...(rows.map((row) => row.status).filter(Boolean) as string[]),
        ])
      ).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const specialtyOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.specialty_code).filter(Boolean) as string[])
      ).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const chorakOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.chorak).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b)
      ),
    [rows]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("uz");

    return rows.filter((row) => {
      if (query) {
        const searchable = [
          row.full_name,
          row.pinfl,
          row.specialty_name,
          row.specialty_code,
          row.supervisor_name,
          row.research_topic,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("uz");
        if (!searchable.includes(query)) return false;
      }
      if (filters.educationStage && row.education_stage !== filters.educationStage) {
        return false;
      }
      if (filters.status && row.status !== filters.status) return false;
      if (filters.specialtyCode && row.specialty_code !== filters.specialtyCode) {
        return false;
      }
      if (filters.chorak && row.chorak !== filters.chorak) return false;
      if (filters.gender && row.gender !== filters.gender) return false;
      return true;
    });
  }, [filters, rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);
  const firstShown = filtered.length ? startIndex + 1 : 0;
  const lastShown = Math.min(startIndex + pageSize, filtered.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function remove(row: Izlanuvchi) {
    if (!confirm(`"${row.full_name}" yozuvini o'chirishni tasdiqlaysizmi?`)) return;

    const { error: deleteError } = await supabase
      .from("izlanuvchilar")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      alert(deleteError.message);
      return;
    }

    invalidateIzlanuvchilarCache(turi);
    load(true);
  }

  async function handleBulkUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setBulkUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/izlanuvchilar/bulk", {
      method: "POST",
      body: formData,
    });
    setBulkUploading(false);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(data?.error ?? `HTTP ${response.status}`);
      return;
    }

    setBulkResults(data.results ?? []);
    setBulkSummary({
      succeeded: data.succeeded ?? 0,
      updated: data.updated ?? 0,
      failed: data.failed ?? 0,
    });
    setBulkResultOpen(true);
    invalidateIzlanuvchilarCache();
    load(true);
  }

  async function exportExcel() {
    if (!filtered.length) return;
    setExporting(true);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(title.slice(0, 31));
      const headers = [
        "#",
        "DOKTORANT",
        "TA'LIM SHAKLI",
        "QABUL YILI",
        "IXTISOSLIK",
        "KAFEDRA",
        "TA'LIM TILI",
        "CHORAK",
        "ILMIY RAHBAR",
        "TELEFON RAQAMI",
        "PINFL",
        "1-YARIM YILLIK",
        "2-YARIM YILLIK",
        "HOLAT",
        "HIMOYA HOLATI",
      ];
      worksheet.addRow(headers);
      filtered.forEach((row, index) => {
        const monitoring = monitoringByIzlanuvchi[row.id];
        worksheet.addRow([
          importedSourceNo(row) ?? index + 1,
          row.full_name,
          row.education_stage ?? "",
          row.admission_year ?? "",
          row.specialty_code ?? "",
          departmentName(row) ?? "",
          row.talim_tili ?? "",
          row.chorak ?? "",
          row.supervisor_name ?? "",
          row.phone ?? "",
          row.pinfl ?? "",
          monitoring?.h1 != null ? `${monitoring.h1} / 100` : "",
          monitoring?.h2 != null ? `${monitoring.h2} / 100` : "",
          row.status ?? "",
          row.himoya_holati ?? "",
        ]);
      });

      const header = worksheet.getRow(1);
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6D28D9" },
      };
      header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      worksheet.views = [{ state: "frozen", ySplit: 1 }];
      worksheet.autoFilter = { from: "A1", to: "O1" };
      worksheet.columns.forEach((column, index) => {
        column.width = [7, 34, 28, 14, 18, 30, 18, 14, 30, 20, 18, 16, 16, 34, 22][index];
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        turi === "doktorant"
          ? "doktorant-va-stajor-tadqiqotchilar.xlsx"
          : "mustaqil-izlanuvchilar.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const selectClass =
    "h-10 rounded-lg border border-surface-300 bg-white px-3 text-sm text-surface-800 outline-none focus:ring-2 focus:ring-violet-200 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100";

  const pageItems = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter(
      (pageNumber) =>
        pageNumber === 1 ||
        pageNumber === totalPages ||
        Math.abs(pageNumber - safePage) <= 2
    )
    .reduce<(number | "ellipsis")[]>((items, pageNumber, index, source) => {
      if (index > 0 && pageNumber - source[index - 1] > 1) items.push("ellipsis");
      items.push(pageNumber);
      return items;
    }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            {title}
          </h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            {loading ? "Yuklanmoqda..." : `Jami ${rows.length} ta izlanuvchi`}
          </p>
        </div>

        {canAddEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {canImport && (
              <>
                <a href="/api/izlanuvchilar/bulk" download>
                  <Button variant="outline" size="md">
                    Shablon
                  </Button>
                </a>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleBulkUpload}
                />
                <Button
                  variant="outline"
                  size="md"
                  isLoading={bulkUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Excel import
                </Button>
              </>
            )}
            <Button
              size="md"
              onClick={() => router.push(`${basePath}/create?turi=${turi}`)}
            >
              + Qo&apos;shish
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-700 dark:bg-surface-800">
        <div className="flex flex-wrap items-center gap-3 border-b border-surface-200 p-4 dark:border-surface-700">
          <label className="flex items-center gap-2 text-sm text-surface-500">
            <span>Sahifada</span>
            <select
              value={pageSize}
              onChange={(event) =>
                setPageSize(Number(event.target.value) as 10 | 20 | 50 | 100)
              }
              className={selectClass}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!filtered.length || exporting}
            onClick={exportExcel}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {exporting ? "Tayyorlanmoqda..." : "Excel"}
          </button>

          <div className="relative ml-auto min-w-[16rem] flex-1 sm:max-w-sm">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Izlash"
              className="h-10 w-full rounded-lg border border-surface-300 bg-white pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-violet-200 dark:border-surface-600 dark:bg-surface-800"
            />
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
              filtersOpen
                ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/30"
                : "border-surface-300 text-surface-600 hover:bg-surface-50 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-700"
            }`}
            title="Filtrlar"
            aria-label="Filtrlarni ko'rsatish"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5h16l-6 7v5l-4 2v-7L4 5z" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-end gap-3 border-b border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-900/40">
            <label className="min-w-[13rem] flex-1 text-xs font-semibold uppercase tracking-wide text-surface-500">
              Ta&apos;lim shakli
              <select
                value={pendingFilters.educationStage}
                onChange={(event) =>
                  setPendingFilters((current) => ({
                    ...current,
                    educationStage: event.target.value,
                  }))
                }
                className={`${selectClass} mt-1 w-full normal-case`}
              >
                <option value="">Barchasi</option>
                {educationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-[13rem] flex-1 text-xs font-semibold uppercase tracking-wide text-surface-500">
              Holat
              <select
                value={pendingFilters.status}
                onChange={(event) =>
                  setPendingFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className={`${selectClass} mt-1 w-full normal-case`}
              >
                <option value="">Barchasi</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-[11rem] flex-1 text-xs font-semibold uppercase tracking-wide text-surface-500">
              Ixtisoslik
              <select
                value={pendingFilters.specialtyCode}
                onChange={(event) =>
                  setPendingFilters((current) => ({
                    ...current,
                    specialtyCode: event.target.value,
                  }))
                }
                className={`${selectClass} mt-1 w-full normal-case`}
              >
                <option value="">Barchasi</option>
                {specialtyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-[9rem] flex-1 text-xs font-semibold uppercase tracking-wide text-surface-500">
              Davr
              <select
                value={pendingFilters.chorak}
                onChange={(event) =>
                  setPendingFilters((current) => ({
                    ...current,
                    chorak: event.target.value,
                  }))
                }
                className={`${selectClass} mt-1 w-full normal-case`}
              >
                <option value="">Barchasi</option>
                {chorakOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-[9rem] flex-1 text-xs font-semibold uppercase tracking-wide text-surface-500">
              Jins
              <select
                value={pendingFilters.gender}
                onChange={(event) =>
                  setPendingFilters((current) => ({
                    ...current,
                    gender: event.target.value,
                  }))
                }
                className={`${selectClass} mt-1 w-full normal-case`}
              >
                <option value="">Barchasi</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option.toLowerCase()}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <Button
              size="md"
              onClick={() => setFilters(pendingFilters)}
              style={{ background: "#16803c", boxShadow: "none" }}
            >
              Filter
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setPendingFilters(EMPTY_FILTERS);
                setFilters(EMPTY_FILTERS);
              }}
            >
              Tozalash
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-surface-400">Yuklanmoqda...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-surface-400">
              {rows.length ? "Qidiruv yoki filtr bo'yicha natija topilmadi." : "Hozircha yozuv mavjud emas."}
            </div>
          ) : (
            <table className="w-full min-w-[1400px]">
              <thead className="bg-surface-50 dark:bg-surface-900/60">
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  {[
                    "#",
                    "DOKTORANT",
                    "TA'LIM SHAKLI",
                    "IXTISOSLIK",
                    "KAFEDRA",
                    "ILMIY RAHBAR",
                    "PINFL",
                    "1-YARIM YILLIK",
                    "2-YARIM YILLIK",
                    "HOLAT",
                    "HARAKATLAR",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-surface-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {paginated.map((row, index) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-surface-50 dark:hover:bg-surface-900/30"
                  >
                    <td className="px-3 py-3 text-sm text-surface-400">
                      {importedSourceNo(row) ?? startIndex + index + 1}
                    </td>
                    <td className="max-w-[18rem] px-3 py-3">
                      <div className="font-medium text-surface-900 dark:text-surface-100">
                        {row.full_name}
                      </div>
                      {row.specialty_name && (
                        <div className="mt-0.5 truncate text-xs text-surface-400">
                          {row.specialty_name}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 text-sm text-surface-600 dark:text-surface-300">
                      {row.education_stage ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-surface-600 dark:text-surface-300">
                      {row.specialty_code ?? "—"}
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 text-sm text-surface-600 dark:text-surface-300">
                      {departmentName(row) ?? "—"}
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 text-sm text-surface-600 dark:text-surface-300">
                      {row.supervisor_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-surface-600 dark:text-surface-300">
                      {row.pinfl ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      {monitoringByIzlanuvchi[row.id]?.h1 != null ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${scoreClass(
                            monitoringByIzlanuvchi[row.id].h1 as number
                          )}`}
                        >
                          {monitoringByIzlanuvchi[row.id].h1} / 100
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {monitoringByIzlanuvchi[row.id]?.h2 != null ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${scoreClass(
                            monitoringByIzlanuvchi[row.id].h2 as number
                          )}`}
                        >
                          {monitoringByIzlanuvchi[row.id].h2} / 100
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[15rem] px-3 py-3">
                      {row.status ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(row.status)}`}
                        >
                          {row.status}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <Icon label="Ko'rish" onClick={() => setViewing(row)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
                            <circle cx="12" cy="12" r="2.5" />
                          </svg>
                        </Icon>
                        {canAddEdit && (
                          <>
                            <Icon
                              label="Tahrirlash"
                              onClick={() =>
                                router.push(`${basePath}/${row.id}/edit`)
                              }
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </Icon>
                            {canDelete && (
                              <Icon
                                label="O'chirish"
                                tone="danger"
                                onClick={() => remove(row)}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 10v7m4-7v7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </Icon>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 px-4 py-3 dark:border-surface-700">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Jami {filtered.length} ta yozuvdan {firstShown} dan {lastShown} gacha
              ko&apos;rsatilyapti
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="h-8 rounded-lg px-2 text-sm text-surface-600 hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-surface-300 dark:hover:bg-surface-700"
              >
                ‹
              </button>
              {pageItems.map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-surface-400">
                    ...
                  </span>
                ) : (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setPage(item)}
                    className={`h-8 min-w-8 rounded-lg px-2 text-sm font-medium ${
                      item === safePage
                        ? "bg-violet-600 text-white"
                        : "text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-700"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                className="h-8 rounded-lg px-2 text-sm text-surface-600 hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-surface-300 dark:hover:bg-surface-700"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </section>

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.full_name ?? "Izlanuvchi"}
        size="lg"
      >
        {viewing && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <Detail label="Ro'yxat raqami" value={importedSourceNo(viewing)} />
            <Detail label="Ta'lim shakli" value={viewing.education_stage} />
            <Detail label="Ixtisoslik" value={viewing.specialty_code} />
            <Detail label="Kafedra" value={departmentName(viewing)} />
            <Detail label="Ixtisoslik nomi" value={viewing.specialty_name} wide />
            <Detail label="PINFL" value={viewing.pinfl} />
            <Detail label="Telefon" value={viewing.phone} />
            <Detail label="Jinsi" value={genderLabel(viewing.gender)} />
            <Detail label="Yoshi" value={viewing.age} />
            <Detail label="Qabul yili" value={viewing.admission_year} />
            <Detail label="Kurs" value={viewing.course} />
            <Detail label="Ta'lim tili" value={viewing.talim_tili} />
            <Detail label="Chorak" value={viewing.chorak} />
            <Detail label="Holat" value={viewing.status} wide />
            <Detail label="Ilmiy rahbar" value={viewing.supervisor_name} wide />
            <Detail label="Ilmiy ish mavzusi" value={viewing.research_topic} wide />
            <Detail label="Himoya holati" value={viewing.himoya_holati} wide />
            <Detail label="Monitoring 1" value={viewing.monitoring_1} />
            <Detail label="Monitoring 2" value={viewing.monitoring_2} />
            <Detail label="Monitoring 3" value={viewing.monitoring_3} />
            <Detail label="Tuman" value={viewing.district} />
          </dl>
        )}
      </Modal>

      <Modal
        isOpen={bulkResultOpen}
        onClose={() => setBulkResultOpen(false)}
        title="Excel import natijalari"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {bulkSummary.succeeded} ta qo&apos;shildi
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {bulkSummary.updated} ta yangilandi
            </span>
            {bulkSummary.failed > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {bulkSummary.failed} ta xato
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-auto rounded-xl border border-surface-200 dark:border-surface-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-50 dark:bg-surface-900">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase text-surface-500">#</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-surface-500">F.I.Sh</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-surface-500">PINFL</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-surface-500">Natija</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                {bulkResults.map((result) => (
                  <tr
                    key={result.row}
                    className={result.status === "error" ? "bg-red-50 dark:bg-red-950/20" : ""}
                  >
                    <td className="px-3 py-2 text-surface-400">{result.row}</td>
                    <td className="px-3 py-2">{result.name || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{result.pinfl || "—"}</td>
                    <td className="px-3 py-2">
                      {result.status === "success" && (
                        <span className="text-green-600">Qo&apos;shildi</span>
                      )}
                      {result.status === "updated" && (
                        <span className="text-blue-600">Yangilandi</span>
                      )}
                      {result.status === "error" && (
                        <span className="text-red-600">{result.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
