"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import type { Department, Faculty, Indicator, Quarter, Submission, Target } from "@/types/db";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function currentQuarter(): Quarter {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

function fileNameFromPath(path: string) {
  return path.split("/").pop() || path;
}

function fileCountLabel(files: string[]) {
  return files.length > 0 ? files.length : "-";
}

export default function MonitoringPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const isDean = user?.role === "dean";

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [error, setError] = useState("");
  const [fileModal, setFileModal] = useState<{ deptId: string; indicatorId: string; files: string[] } | null>(null);

  useEffect(() => {
    if (!user?.university_id) return;

    (async () => {
      setLoadingBase(true);
      setError("");

      let facultyQuery = supabase
        .from("faculties")
        .select("*")
        .eq("university_id", user.university_id)
        .order("short_code");

      if (isDean) {
        facultyQuery = facultyQuery.eq("dean_user_id", user.id);
      }

      const [facultyResult, departmentResult, indicatorResult] = await Promise.all([
        facultyQuery,
        supabase.from("departments").select("*").eq("university_id", user.university_id).order("short_code"),
        supabase.from("indicators").select("*").eq("university_id", user.university_id).order("order_idx"),
      ]);

      if (facultyResult.error || departmentResult.error || indicatorResult.error) {
        setError(facultyResult.error?.message || departmentResult.error?.message || indicatorResult.error?.message || "Ma'lumot yuklashda xatolik yuz berdi.");
      }

      let loadedFaculties = (facultyResult.data as Faculty[]) ?? [];
      if (isDean && loadedFaculties.length === 0 && user.faculty_id) {
        const fallback = await supabase
          .from("faculties")
          .select("*")
          .eq("id", user.faculty_id)
          .eq("university_id", user.university_id)
          .maybeSingle();
        loadedFaculties = fallback.data ? [fallback.data as Faculty] : [];
      }

      setFaculties(loadedFaculties);
      setDepartments((departmentResult.data as Department[]) ?? []);
      setIndicators((indicatorResult.data as Indicator[]) ?? []);

      if (isDean) {
        setFacultyId(loadedFaculties[0]?.id ?? "");
      }

      setLoadingBase(false);
    })();
  }, [supabase, user?.university_id, user?.id, user?.faculty_id, isDean]);

  const loadPeriodData = useCallback(async () => {
    if (!user?.university_id) return;

    setLoadingPeriod(true);
    setError("");

    const [targetResult, submissionResult] = await Promise.all([
      supabase
        .from("targets")
        .select("*")
        .eq("university_id", user.university_id)
        .eq("year", year)
        .eq("quarter", quarter),
      supabase
        .from("submissions")
        .select("*")
        .eq("university_id", user.university_id)
        .eq("year", year)
        .eq("quarter", quarter)
        .eq("status", "approved")
        .order("updated_at", { ascending: false }),
    ]);

    if (targetResult.error || submissionResult.error) {
      setError(targetResult.error?.message || submissionResult.error?.message || "Monitoring ma'lumotlarini yuklashda xatolik yuz berdi.");
    }

    setTargets((targetResult.data as Target[]) ?? []);
    setSubmissions((submissionResult.data as Submission[]) ?? []);
    setLoadingPeriod(false);
  }, [supabase, user?.university_id, year, quarter]);

  useEffect(() => {
    loadPeriodData();
  }, [loadPeriodData]);

  const facultiesById = useMemo(() => new Map(faculties.map((faculty) => [faculty.id, faculty])), [faculties]);
  const departmentsById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments]);
  const indicatorsById = useMemo(() => new Map(indicators.map((indicator) => [indicator.id, indicator])), [indicators]);

  const departmentsForFaculty = useMemo(() => {
    if (!facultyId) return departments;
    return departments.filter((department) => department.faculty_id === facultyId);
  }, [departments, facultyId]);

  const visibleDepartments = useMemo(() => {
    if (!departmentId) return departmentsForFaculty;
    return departmentsForFaculty.filter((department) => department.id === departmentId);
  }, [departmentsForFaculty, departmentId]);

  const targetByDepartment = useMemo(() => {
    const map = new Map<string, Target>();
    targets.forEach((target) => {
      if (!facultyId || target.faculty_id === facultyId) {
        map.set(target.department_id, target);
      }
    });
    return map;
  }, [targets, facultyId]);

  const submissionByDepartment = useMemo(() => {
    const map = new Map<string, Submission>();
    submissions.forEach((submission) => {
      if (!facultyId || submission.faculty_id === facultyId) {
        if (!map.has(submission.department_id)) {
          map.set(submission.department_id, submission);
        }
      }
    });
    return map;
  }, [submissions, facultyId]);

  const handleFacultyChange = (nextFacultyId: string) => {
    setFacultyId(nextFacultyId);
    setDepartmentId("");
  };

  const handleDownload = async (path: string) => {
    const { data, error: signedUrlError } = await supabase.storage.from("submissions").createSignedUrl(path, 600);
    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message || "Fayl havolasini yaratib bo'lmadi.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleExportExcel = async () => {
    if (visibleDepartments.length === 0 || indicators.length === 0) return;

    const ExcelJS = await import("exceljs");
    const headerTop = ["Kafedra"];
    const headerBottom = [""];

    indicators.forEach((indicator) => {
      headerTop.push(indicator.name, "", "");
      headerBottom.push("Reja", "Amalda", "Fayllar");
    });

    const rows = visibleDepartments.map((department) => {
      const target = targetByDepartment.get(department.id);
      const submission = submissionByDepartment.get(department.id);
      const faculty = facultiesById.get(department.faculty_id);
      const row: Array<string | number> = [
        `${department.name}${faculty?.short_code ? `\n${faculty.short_code}` : ""}`,
      ];

      indicators.forEach((indicator) => {
        const planned = target?.values?.[indicator.id] ?? null;
        const entry = submission?.indicators?.[indicator.id];
        const actual = entry?.value ?? null;
        const files = entry?.files ?? [];

        row.push(
          typeof planned === "number" ? planned : "-",
          typeof actual === "number" ? actual : "-",
          fileCountLabel(files),
        );
      });

      return row;
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Monitoring");
    worksheet.addRows([headerTop, headerBottom, ...rows]);
    worksheet.mergeCells(1, 1, 2, 1);
    indicators.forEach((_, index) => {
      const startColumn = 2 + index * 3;
      worksheet.mergeCells(1, startColumn, 1, startColumn + 2);
    });
    worksheet.columns = [
      { width: 36 },
      ...indicators.flatMap(() => [{ width: 12 }, { width: 12 }, { width: 12 }]),
    ];
    worksheet.getRows(1, 2)?.forEach((row) => {
      row.font = { bold: true };
      row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monitoring-${year}-${quarter}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const cellValueClass = (actual: number | null, target: number | null) => {
    if (typeof actual !== "number") return "text-surface-400 dark:text-surface-500";
    if (typeof target !== "number") return "text-surface-600 dark:text-surface-300";
    return actual >= target
      ? "text-green-700 dark:text-green-300"
      : "text-amber-700 dark:text-amber-300";
  };

  const tableLoading = loadingBase || loadingPeriod;
  const modalDepartment = fileModal ? departmentsById.get(fileModal.deptId) : null;
  const modalIndicator = fileModal ? indicatorsById.get(fileModal.indicatorId) : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Monitoring</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Kafedralar kesimida KPI reja, amalda va fayllar holatini kuzatish.
        </p>
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Yil</label>
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              min={2020}
              max={2100}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Chorak</label>
            <select
              value={quarter}
              onChange={(event) => setQuarter(event.target.value as Quarter)}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Fakultet</label>
            <select
              value={facultyId}
              onChange={(event) => handleFacultyChange(event.target.value)}
              disabled={isDean}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm disabled:opacity-60"
            >
              {!isDean && <option value="">Barchasi</option>}
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>{faculty.short_code} - {faculty.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Kafedra</label>
            <select
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              <option value="">Barchasi</option>
              {departmentsForFaculty.map((department) => (
                <option key={department.id} value={department.id}>{department.short_code} - {department.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Monitoring jadvali</h2>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              {visibleDepartments.length} ta kafedra, {indicators.length} ta ko&apos;rsatkich
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={tableLoading || visibleDepartments.length === 0 || indicators.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            Excel
          </button>
        </div>
        {tableLoading ? (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        ) : visibleDepartments.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Tanlangan filtrlar bo&apos;yicha kafedra topilmadi.</div>
        ) : indicators.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Ko&apos;rsatkichlar topilmadi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-surface-50 dark:bg-surface-900/50">
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 min-w-56 bg-surface-50 dark:bg-surface-900 px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-300 uppercase border-b border-r border-surface-200 dark:border-surface-700"
                  >
                    Kafedra
                  </th>
                  {indicators.map((indicator) => (
                    <th
                      key={indicator.id}
                      colSpan={3}
                      className="min-w-72 px-4 py-3 text-center text-xs font-semibold text-surface-700 dark:text-surface-200 border-b border-r border-surface-200 dark:border-surface-700"
                      title={indicator.name}
                    >
                      <span className="line-clamp-2">{indicator.name}</span>
                    </th>
                  ))}
                </tr>
                <tr>
                  {indicators.map((indicator) => (
                    <React.Fragment key={`${indicator.id}-sub`}>
                      <th className="w-24 px-3 py-2 text-center text-xs font-semibold text-surface-600 dark:text-surface-300 uppercase border-b border-r border-surface-200 dark:border-surface-700">Reja</th>
                      <th className="w-24 px-3 py-2 text-center text-xs font-semibold text-surface-600 dark:text-surface-300 uppercase border-b border-r border-surface-200 dark:border-surface-700">Amalda</th>
                      <th className="w-24 px-3 py-2 text-center text-xs font-semibold text-surface-600 dark:text-surface-300 uppercase border-b border-r border-surface-200 dark:border-surface-700">Fayllar</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDepartments.map((department) => {
                  const target = targetByDepartment.get(department.id);
                  const submission = submissionByDepartment.get(department.id);
                  const faculty = facultiesById.get(department.faculty_id);

                  return (
                    <tr key={department.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                      <td className="sticky left-0 z-10 bg-white dark:bg-surface-800 px-4 py-3 border-b border-r border-surface-200 dark:border-surface-700">
                        <div className="font-medium text-sm text-surface-900 dark:text-surface-100">{department.name}</div>
                        <div className="text-xs text-surface-500 dark:text-surface-400">{faculty?.short_code ?? department.short_code}</div>
                      </td>
                      {indicators.map((indicator) => {
                        const planned = target?.values?.[indicator.id] ?? null;
                        const entry = submission?.indicators?.[indicator.id];
                        const actual = entry?.value ?? null;
                        const files = entry?.files ?? [];

                        return (
                          <React.Fragment key={`${department.id}-${indicator.id}`}>
                            <td className="px-3 py-3 text-center text-sm border-b border-r border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200">
                              {typeof planned === "number" ? planned : "-"}
                            </td>
                            <td className={`px-3 py-3 text-center text-sm font-semibold border-b border-r border-surface-200 dark:border-surface-700 ${cellValueClass(actual, planned)}`}>
                              {typeof actual === "number" ? actual : "-"}
                            </td>
                            <td className="px-3 py-3 text-center text-sm border-b border-r border-surface-200 dark:border-surface-700">
                              {files.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setFileModal({ deptId: department.id, indicatorId: indicator.id, files })}
                                  className="inline-flex items-center justify-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/30 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                                >
                                  <span aria-hidden="true">📎</span>
                                  {files.length}
                                </button>
                              ) : (
                                <span className="text-surface-400 dark:text-surface-500">-</span>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!fileModal}
        onClose={() => setFileModal(null)}
        title={`${modalIndicator?.name ?? "Fayllar"} - ${modalDepartment?.name ?? ""}`}
        size="lg"
      >
        <div className="space-y-3">
          {fileModal?.files.map((path) => (
            <div
              key={path}
              className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2"
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="shrink-0 text-surface-500" aria-hidden="true">📄</span>
                <span className="truncate text-sm font-medium text-surface-800 dark:text-surface-100">{fileNameFromPath(path)}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(path)}
                className="shrink-0 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
              >
                Yuklab olish
              </button>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => setFileModal(null)}
            className="rounded-md border border-surface-300 dark:border-surface-600 px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          >
            Yopish
          </button>
        </div>
      </Modal>
    </div>
  );
}
