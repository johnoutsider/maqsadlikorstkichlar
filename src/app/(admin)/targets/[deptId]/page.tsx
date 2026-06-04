"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import type { Department, Faculty, Indicator, Target, Quarter } from "@/types/db";

const CAN_EDIT_ROLES = new Set(["university_admin", "science_department"]);

export default function TargetEditPage() {
  const { deptId } = useParams<{ deptId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const canEdit = !!user && CAN_EDIT_ROLES.has(user.role);

  // Read year/quarter from URL query params (set by the list page)
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  const quarter = (searchParams.get("quarter") ?? "Q1") as Quarter;

  const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

  const [department, setDepartment] = useState<Department | null>(null);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const backUrl = `/targets?year=${year}&quarter=${quarter}`;

  const load = useCallback(async () => {
    if (!deptId || !user?.university_id) return;
    setLoading(true);
    setError("");
    setMessage("");

    const [deptRes, indRes, tgtRes] = await Promise.all([
      supabase.from("departments").select("*").eq("id", deptId).maybeSingle(),
      supabase.from("indicators").select("*").eq("university_id", user.university_id).order("order_idx"),
      supabase.from("targets").select("*").eq("department_id", deptId).eq("year", year).eq("quarter", quarter).maybeSingle(),
    ]);

    if (deptRes.error) { setError(deptRes.error.message); setLoading(false); return; }
    const dept = deptRes.data as Department | null;
    setDepartment(dept);

    // Load faculty info
    if (dept?.faculty_id) {
      const { data: fac } = await supabase.from("faculties").select("*").eq("id", dept.faculty_id).maybeSingle();
      setFaculty((fac as Faculty) ?? null);
    }

    const inds = (indRes.data as Indicator[]) ?? [];
    setIndicators(inds);

    const tgt = tgtRes.data as Target | null;
    const v: Record<string, string> = {};
    inds.forEach((ind) => {
      const x = tgt?.values?.[ind.id];
      v[ind.id] = x === null || x === undefined ? "" : String(x);
    });
    setValues(v);
    setInitialValues(v);
    setLoading(false);
  }, [supabase, deptId, user?.university_id, year, quarter]);

  useEffect(() => { load(); }, [load]);

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  const save = async (): Promise<boolean> => {
    if (!user?.university_id || !department) return false;
    setSaving(true);
    setError("");
    setMessage("");

    const numeric: Record<string, number | null> = {};
    for (const ind of indicators) {
      const raw = values[ind.id]?.trim();
      if (!raw) { numeric[ind.id] = null; continue; }
      const n = Number(raw);
      if (Number.isNaN(n)) {
        setSaving(false);
        setError(`"${ind.no}. ${ind.name}" — son kiriting yoki bo'sh qoldiring.`);
        return false;
      }
      numeric[ind.id] = n;
    }

    const payload = {
      university_id: user.university_id,
      faculty_id: department.faculty_id,
      department_id: deptId,
      year,
      quarter,
      values: numeric,
      created_by: user.id,
    };

    const { error: e } = await supabase
      .from("targets")
      .upsert(payload, { onConflict: "department_id,year,quarter" });

    setSaving(false);
    if (e) { setError(e.message); return false; }
    setInitialValues(values);
    setMessage("Maqsadlar saqlandi.");
    return true;
  };

  const switchQuarter = async (q: Quarter) => {
    if (q === quarter) return;
    if (canEdit && isDirty) {
      const ok = await save();
      if (!ok) return;
    }
    router.push(`/targets/${deptId}?year=${year}&quarter=${q}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-surface-500 text-sm">Yuklanmoqda...</div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="p-8 text-center">
        <p className="text-danger-600 text-sm">{error || "Kafedra topilmadi."}</p>
        <Link href="/targets" className="text-primary-600 hover:underline text-sm mt-4 inline-block">
          ← Maqsadlar
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={backUrl}
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 mb-3"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Maqsadlar ro&apos;yxatiga qaytish
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
              {department.short_code} — {department.name}
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              {faculty?.name ?? "Fakultet"}
              <span className="mx-2 text-surface-300 dark:text-surface-600">·</span>
              {year} yil
            </p>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
            canEdit
              ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
              : "bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300"
          }`}>
            {canEdit ? "Tahrirlash rejimi" : "Ko'rish rejimi"}
          </span>
        </div>

        {/* Quarter switcher */}
        <div className="flex items-center gap-1 mt-4 p-1 bg-surface-100 dark:bg-surface-800 rounded-lg w-fit">
          {QUARTERS.map((q) => (
            <button
              key={q}
              onClick={() => switchQuarter(q)}
              disabled={saving}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                q === quarter
                  ? "bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm"
                  : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
              }`}
            >
              {q} chorak
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {message}
        </div>
      )}

      {/* Indicator Table */}
      {indicators.length === 0 ? (
        <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-8 text-center text-surface-500">
          Ko&apos;rsatkichlar hali sozlanmagan.
        </div>
      ) : (() => {
        // compute which indicator ids have children
        const childrenByParent: Record<string, Indicator[]> = {};
        indicators.forEach((ind) => {
          if (ind.parent_id) {
            (childrenByParent[ind.parent_id] ??= []).push(ind);
          }
        });

        const getSum = (parentId: string): string => {
          const children = childrenByParent[parentId] ?? [];
          if (children.length === 0) return "";
          const nums = children.map((c) => Number(values[c.id] ?? 0));
          const total = nums.reduce((a, b) => a + b, 0);
          return String(total);
        };

        return (
          <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase w-14">№</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Ko&apos;rsatkich</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase w-24">Birlik</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase w-40">Maqsad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                  {indicators.map((ind) => {
                    const isParent = !!childrenByParent[ind.id]?.length;
                    const sum = isParent ? getSum(ind.id) : null;

                    return (
                      <tr
                        key={ind.id}
                        className={`transition-colors ${
                          isParent
                            ? "bg-primary-50/40 dark:bg-primary-900/10"
                            : ind.is_sub_indicator
                            ? "bg-surface-50/50 dark:bg-surface-900/20 hover:bg-surface-50 dark:hover:bg-surface-900/30"
                            : "hover:bg-surface-50 dark:hover:bg-surface-900/20"
                        }`}
                      >
                        <td className="px-5 py-3.5 text-sm font-mono text-surface-500 dark:text-surface-400 align-middle">
                          {ind.no}
                        </td>
                        <td className={`px-5 py-3.5 text-sm align-middle ${
                          ind.is_sub_indicator
                            ? "pl-10 text-surface-600 dark:text-surface-400"
                            : "text-surface-900 dark:text-surface-100 font-medium"
                        }`}>
                          {ind.is_sub_indicator && <span className="mr-1 text-surface-400">↳</span>}
                          {ind.name}
                          {isParent && (
                            <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                              YIG&apos;INDI
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-surface-500 dark:text-surface-400 align-middle">
                          {ind.unit}
                        </td>
                        <td className="px-5 py-3 align-middle">
                          {isParent ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                                {sum !== "" ? sum : "—"}
                              </span>
                              <span className="text-[10px] text-surface-400">avtomatik</span>
                            </div>
                          ) : canEdit ? (
                            <input
                              type="number"
                              step="any"
                              value={values[ind.id] ?? ""}
                              onChange={(e) => setValues((p) => ({ ...p, [ind.id]: e.target.value }))}
                              placeholder="—"
                              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                            />
                          ) : (
                            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                              {values[ind.id] !== "" && values[ind.id] !== undefined
                                ? values[ind.id]
                                : <span className="text-surface-400">—</span>
                              }
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Footer actions */}
      {indicators.length > 0 && (
        <div className="mt-6 flex items-center justify-end gap-3 pb-4">
          <Button variant="outline" onClick={() => router.push(backUrl)}>
            Bekor qilish
          </Button>
          {canEdit && (
            <Button onClick={save} isLoading={saving}>
              Saqlash
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
