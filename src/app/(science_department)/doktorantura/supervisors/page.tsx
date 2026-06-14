"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { createClient } from "@/lib/supabase/client";
import type { Izlanuvchi, IzlanuvchiTuri } from "@/types/db";
import { statusBadgeClass } from "@/app/(shared)/izlanuvchilar/_lib/options";

const DATABASE_PAGE_SIZE = 1000;

type ResearcherRow = Pick<
  Izlanuvchi,
  | "id"
  | "turi"
  | "full_name"
  | "specialty_name"
  | "specialty_code"
  | "education_stage"
  | "supervisor_name"
  | "status"
>;

type SupervisorGroup = {
  key: string;
  name: string;
  students: ResearcherRow[];
};

type Filters = {
  turi: "" | IzlanuvchiTuri;
  specialtyCode: string;
  status: string;
};

type PageSize = 10 | 20 | 50 | 100;

const EMPTY_FILTERS: Filters = {
  turi: "",
  specialtyCode: "",
  status: "",
};

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("uz")
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/\s+/g, " ");
}

function turiLabel(turi: IzlanuvchiTuri) {
  return turi === "doktorant" ? "Doktorant / stajyor" : "Mustaqil izlanuvchi";
}

function StudentCard({ student }: { student: ResearcherRow }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 dark:border-surface-700 dark:bg-surface-900/50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-surface-900 dark:text-surface-100">
            {student.full_name}
          </p>
          <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
            {[student.education_stage, student.specialty_code]
              .filter(Boolean)
              .join(" · ") || "Ma'lumot ko'rsatilmagan"}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            student.turi === "doktorant"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
          }`}
        >
          {turiLabel(student.turi)}
        </span>
      </div>
      {student.status && (
        <span
          className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${statusBadgeClass(
            student.status
          )}`}
        >
          {student.status}
        </span>
      )}
    </div>
  );
}

export default function SupervisorsPage() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const { user, loading: authLoading } = useSupabaseAuth();

  const [rows, setRows] = useState<ResearcherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const nextRows: ResearcherRow[] = [];
    for (let start = 0; ; start += DATABASE_PAGE_SIZE) {
      const { data, error: databaseError } = await supabase
        .from("izlanuvchilar")
        .select(
          "id, turi, full_name, specialty_name, specialty_code, education_stage, supervisor_name, status"
        )
        .not("supervisor_name", "is", null)
        .order("supervisor_name")
        .order("full_name")
        .range(start, start + DATABASE_PAGE_SIZE - 1);

      if (databaseError) {
        setError(databaseError.message);
        setLoading(false);
        return;
      }

      const batch = (data as ResearcherRow[] | null) ?? [];
      nextRows.push(
        ...batch.filter((row) => Boolean(row.supervisor_name?.trim()))
      );
      if (batch.length < DATABASE_PAGE_SIZE) break;
    }

    setRows(nextRows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, load, user]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, search]);

  const groups = useMemo(() => {
    const grouped = new Map<string, SupervisorGroup>();

    for (const row of rows) {
      const name = row.supervisor_name?.trim();
      if (!name) continue;

      const key = normalize(name);
      const existing = grouped.get(key);
      if (existing) {
        existing.students.push(row);
      } else {
        grouped.set(key, { key, name, students: [row] });
      }
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        students: group.students.sort((a, b) =>
          a.full_name.localeCompare(b.full_name, "uz")
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "uz"));
  }, [rows]);

  const specialtyOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.specialty_code).filter(Boolean) as string[])
      ).sort((a, b) => a.localeCompare(b, "uz")),
    [rows]
  );

  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.status).filter(Boolean) as string[])
      ).sort((a, b) => a.localeCompare(b, "uz")),
    [rows]
  );

  const filteredGroups = useMemo(() => {
    const query = normalize(search);

    return groups
      .map((group) => {
        const supervisorMatches = query ? normalize(group.name).includes(query) : true;
        const students = group.students.filter((student) => {
          if (filters.turi && student.turi !== filters.turi) return false;
          if (
            filters.specialtyCode &&
            student.specialty_code !== filters.specialtyCode
          ) {
            return false;
          }
          if (filters.status && student.status !== filters.status) return false;
          if (!query || supervisorMatches) return true;

          return normalize(
            [
              student.full_name,
              student.education_stage,
              student.specialty_name,
              student.specialty_code,
              student.status,
            ]
              .filter(Boolean)
              .join(" ")
          ).includes(query);
        });

        return { ...group, students };
      })
      .filter((group) => group.students.length > 0);
  }, [filters, groups, search]);

  const filteredStudentCount = useMemo(
    () =>
      filteredGroups.reduce(
        (total, group) => total + group.students.length,
        0
      ),
    [filteredGroups]
  );

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginated = filteredGroups.slice(startIndex, startIndex + pageSize);
  const firstShown = filteredGroups.length ? startIndex + 1 : 0;
  const lastShown = Math.min(startIndex + pageSize, filteredGroups.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter(
      (pageNumber) =>
        pageNumber === 1 ||
        pageNumber === totalPages ||
        Math.abs(pageNumber - safePage) <= 2
    )
    .reduce<(number | "ellipsis")[]>((items, pageNumber, index, source) => {
      if (index > 0 && pageNumber - source[index - 1] > 1) {
        items.push("ellipsis");
      }
      items.push(pageNumber);
      return items;
    }, []);

  async function exportExcel() {
    if (!filteredGroups.length) return;
    setExporting(true);

    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Ilmiy rahbarlar");
      worksheet.addRow([
        "ILMIY RAHBAR",
        "IZLANUVCHI",
        "TURI",
        "TA'LIM SHAKLI",
        "IXTISOSLIK",
        "HOLAT",
      ]);

      filteredGroups.forEach((group) => {
        group.students.forEach((student) => {
          worksheet.addRow([
            group.name,
            student.full_name,
            turiLabel(student.turi),
            student.education_stage ?? "",
            student.specialty_code ?? "",
            student.status ?? "",
          ]);
        });
      });

      const header = worksheet.getRow(1);
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6D28D9" },
      };
      header.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      worksheet.views = [{ state: "frozen", ySplit: 1 }];
      worksheet.autoFilter = { from: "A1", to: "F1" };
      worksheet.columns.forEach((column, index) => {
        column.width = [34, 34, 24, 30, 18, 34][index];
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ilmiy-rahbarlar-va-izlanuvchilar.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const selectClass =
    "h-10 rounded-lg border border-surface-300 bg-white px-3 text-sm text-surface-800 outline-none focus:ring-2 focus:ring-violet-200 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          Ilmiy rahbarlar
        </h1>
        <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
          {loading
            ? "Yuklanmoqda..."
            : `Jami ${groups.length} ta ilmiy rahbar, ${rows.length} ta biriktirilgan izlanuvchi`}
        </p>
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
                setPageSize(Number(event.target.value) as PageSize)
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
            disabled={!filteredGroups.length || exporting}
            onClick={exportExcel}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
              placeholder="Rahbar yoki izlanuvchini izlash"
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
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M4 5h16l-6 7v5l-4 2v-7L4 5z"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-end gap-3 border-b border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-900/40">
            <label className="min-w-[13rem] flex-1 text-xs font-semibold uppercase tracking-wide text-surface-500">
              Izlanuvchi turi
              <select
                value={pendingFilters.turi}
                onChange={(event) =>
                  setPendingFilters((current) => ({
                    ...current,
                    turi: event.target.value as Filters["turi"],
                  }))
                }
                className={`${selectClass} mt-1 w-full normal-case`}
              >
                <option value="">Barchasi</option>
                <option value="doktorant">Doktorant / stajyor</option>
                <option value="mustaqil">Mustaqil izlanuvchi</option>
              </select>
            </label>

            <label className="min-w-[13rem] flex-1 text-xs font-semibold uppercase tracking-wide text-surface-500">
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
          ) : filteredGroups.length === 0 ? (
            <div className="p-12 text-center text-surface-400">
              {groups.length
                ? "Qidiruv yoki filtr bo'yicha natija topilmadi."
                : "Ilmiy rahbar biriktirilgan izlanuvchilar mavjud emas."}
            </div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead className="bg-surface-50 dark:bg-surface-900/60">
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="w-[30%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-surface-500">
                    Ilmiy rahbar
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-surface-500">
                    Doktorant va mustaqil izlanuvchilar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {paginated.map((group) => {
                  const doktorantCount = group.students.filter(
                    (student) => student.turi === "doktorant"
                  ).length;
                  const mustaqilCount = group.students.length - doktorantCount;

                  return (
                    <tr
                      key={group.key}
                      className="align-top transition-colors hover:bg-surface-50/60 dark:hover:bg-surface-900/30"
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold text-surface-900 dark:text-surface-100">
                          {group.name}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600 dark:bg-surface-700 dark:text-surface-300">
                            Jami {group.students.length} ta
                          </span>
                          {doktorantCount > 0 && (
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {doktorantCount} doktorant
                            </span>
                          )}
                          {mustaqilCount > 0 && (
                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                              {mustaqilCount} mustaqil
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                          {group.students.map((student) => (
                            <StudentCard key={student.id} student={student} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filteredGroups.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 px-4 py-3 dark:border-surface-700">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {filteredGroups.length} ta rahbardan {firstShown} dan {lastShown} gacha,
              jami {filteredStudentCount} ta izlanuvchi ko&apos;rsatilyapti
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
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-surface-400"
                  >
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
    </div>
  );
}
