"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
  PieChart,
  Pie,
} from "recharts";
import { Skeleton } from "@/components/ui/Skeleton";
import type { HemisStatStudentData, GenderCount, BMCount } from "@/app/api/hemis/stat-student/route";

interface Stat {
  label: string;
  value: number | string;
  tone?: "default" | "primary" | "success" | "warning";
}

function StatCard({ stat }: { stat: Stat }) {
  const toneCls: Record<string, string> = {
    default: "text-surface-900 dark:text-surface-100",
    primary: "text-primary-600 dark:text-primary-400",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-5">
      <p className="text-xs uppercase font-medium text-surface-500 dark:text-surface-400">
        {stat.label}
      </p>
      <p className={`text-3xl font-bold mt-2 ${toneCls[stat.tone ?? "default"]}`}>
        {stat.value}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{title}</h3>
        {subtitle && (
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const COLOR_MALE = "#3b82f6";
const COLOR_FEMALE = "#ec4899";
const COLOR_PRIMARY = "#6366f1";
const COLOR_BAKALAVR = "#6366f1";
const COLOR_MAGISTR = "#22c55e";
const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444"];

function toGenderRows(obj: Record<string, GenderCount>, excludeKeys: string[] = []) {
  return Object.entries(obj)
    .filter(([k]) => !excludeKeys.includes(k))
    .map(([name, v]) => ({ name, Erkak: v.Erkak, Ayol: v.Ayol }));
}

function toBMRows(obj: Record<string, BMCount>) {
  return Object.entries(obj).map(([name, v]) => ({
    name,
    Bakalavr: v.Bakalavr,
    Magistr: v.Magistr,
  }));
}

function toPieRows(obj: Record<string, BMCount>) {
  return Object.entries(obj).map(([name, v]) => ({
    name,
    value: v.Bakalavr + v.Magistr,
  }));
}

function toEducationFormRows(obj: Record<string, GenderCount>) {
  return Object.entries(obj)
    .filter(([, v]) => v.Erkak > 0 || v.Ayol > 0)
    .map(([name, v]) => ({ name, Erkak: v.Erkak, Ayol: v.Ayol }));
}

function toLevelRows(obj: Record<string, Record<string, number>>) {
  // Find all form keys that have at least one non-zero value across all kurses
  const allForms = new Set<string>();
  Object.values(obj).forEach((forms) =>
    Object.entries(forms).forEach(([form, val]) => {
      if (val > 0) allForms.add(form);
    })
  );
  return Object.entries(obj).map(([kurs, forms]) => {
    const row: Record<string, string | number> = { name: kurs };
    allForms.forEach((form) => {
      row[form] = forms[form] ?? 0;
    });
    return { row, forms: Array.from(allForms) };
  });
}

const LEVEL_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6"];

export default function TalabalarStatsPage() {
  const [data, setData] = useState<HemisStatStudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hemis/stat-student", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data as HemisStatStudentData);
      setCachedAt(json.cached_at ? new Date(json.cached_at) : new Date());
      setIsStale(json.stale === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumotni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const educationTypeRows = useMemo(
    () => (data ? toGenderRows(data.education_type, ["Jami"]) : []),
    [data]
  );

  const ageBakalavr = useMemo(
    () => (data ? toGenderRows(data.age.Bakalavr ?? {}, ["Jami"]) : []),
    [data]
  );

  const ageMagistr = useMemo(
    () => (data ? toGenderRows(data.age.Magistr ?? {}, ["Jami"]) : []),
    [data]
  );

  const paymentRows = useMemo(() => (data ? toBMRows(data.payment) : []), [data]);
  const regionRows = useMemo(() => (data ? toBMRows(data.region) : []), [data]);
  const citizenshipRows = useMemo(() => (data ? toPieRows(data.citizenship) : []), [data]);
  const accommodationRows = useMemo(() => (data ? toBMRows(data.accommodation) : []), [data]);

  const educationFormBakalavr = useMemo(
    () => (data ? toEducationFormRows(data.education_form.Bakalavr ?? {}) : []),
    [data]
  );

  const educationFormMagistr = useMemo(
    () => (data ? toEducationFormRows(data.education_form.Magistr ?? {}) : []),
    [data]
  );

  const levelBakalavr = useMemo(
    () => (data ? toLevelRows(data.level.Bakalavr ?? {}) : []),
    [data]
  );

  const levelMagistr = useMemo(
    () => (data ? toLevelRows(data.level.Magistr ?? {}) : []),
    [data]
  );

  const jami = data?.education_type?.Jami;
  const bakalavr = data?.education_type?.Bakalavr;
  const magistr = data?.education_type?.Magistr;

  const kpis: Stat[] = data && jami
    ? [
        {
          label: "Jami talabalar",
          value: (jami.Erkak ?? 0) + (jami.Ayol ?? 0),
          tone: "primary",
        },
        {
          label: "Bakalavr",
          value: (bakalavr?.Erkak ?? 0) + (bakalavr?.Ayol ?? 0),
        },
        {
          label: "Magistr",
          value: (magistr?.Erkak ?? 0) + (magistr?.Ayol ?? 0),
        },
        { label: "Erkak", value: jami.Erkak ?? 0 },
        { label: "Ayol", value: jami.Ayol ?? 0, tone: "success" },
      ]
    : [];

  const levelBakalavData = levelBakalavr[0]?.forms ?? [];
  const levelMagistrData = levelMagistr[0]?.forms ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Talabalar statistikasi (HEMIS)
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manba: student.uzswlu.uz
            {cachedAt && (
              <span className="ml-2">
                · Bazaga saqlangan: {cachedAt.toLocaleString("uz-UZ")}
                {isStale && (
                  <span className="ml-1 text-amber-500">(eskirgan ma&apos;lumot)</span>
                )}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm font-medium text-surface-700 dark:text-surface-200 hover:border-primary-400 disabled:opacity-50 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Yangilash
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-300 bg-danger-50 dark:bg-danger-900/20 dark:border-danger-800 p-4 flex items-start justify-between gap-3">
          <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
          <button
            onClick={load}
            className="text-sm font-medium text-danger-700 dark:text-danger-300 underline"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* KPI strip */}
      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.map((s) => (
              <StatCard key={s.label} stat={s} />
            ))}
          </div>
        )
      )}

      {/* Charts */}
      {loading && !data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : (
        data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Ta'lim turi bo'yicha */}
            <ChartCard title="Ta'lim turi bo'yicha" subtitle="Jins kesimida">
              <BarChart data={educationTypeRows} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Erkak" fill={COLOR_MALE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ayol" fill={COLOR_FEMALE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            {/* 2. Yosh bo'yicha (Bakalavr) */}
            <ChartCard title="Yosh bo'yicha (Bakalavr)" subtitle="Jins kesimida">
              <BarChart data={ageBakalavr} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Erkak" fill={COLOR_MALE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ayol" fill={COLOR_FEMALE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            {/* 3. Yosh bo'yicha (Magistr) */}
            <ChartCard title="Yosh bo'yicha (Magistr)" subtitle="Jins kesimida">
              <BarChart data={ageMagistr} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Erkak" fill={COLOR_MALE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ayol" fill={COLOR_FEMALE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            {/* 4. To'lov shakli */}
            <ChartCard title="To'lov shakli" subtitle="Bakalavr va Magistr">
              <BarChart data={paymentRows} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Bakalavr" fill={COLOR_BAKALAVR} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Bakalavr" position="top" style={{ fontSize: 10 }} />
                </Bar>
                <Bar dataKey="Magistr" fill={COLOR_MAGISTR} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Magistr" position="top" style={{ fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ChartCard>

            {/* 5. Hudud bo'yicha */}
            <ChartCard title="Hudud bo'yicha" subtitle="Viloyatlar kesimida">
              <BarChart data={regionRows} layout="vertical" margin={{ left: 8, right: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={180} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Bakalavr" fill={COLOR_BAKALAVR} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Magistr" fill={COLOR_MAGISTR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartCard>

            {/* 6. Fuqarolik */}
            <ChartCard title="Fuqarolik" subtitle="Talabalar tarkibi">
              <PieChart>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Pie
                  data={citizenshipRows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  label={(p: { value?: number }) => `${p.value ?? 0}`}
                >
                  {citizenshipRows.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartCard>

            {/* 7. Yashash joyi */}
            <ChartCard title="Yashash joyi" subtitle="Turar joy turi bo'yicha">
              <BarChart data={accommodationRows} layout="vertical" margin={{ left: 8, right: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={180} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Bakalavr" fill={COLOR_BAKALAVR} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Magistr" fill={COLOR_MAGISTR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartCard>

            {/* 8. Ta'lim shakli (Bakalavr) */}
            {educationFormBakalavr.length > 0 && (
              <ChartCard title="Ta'lim shakli (Bakalavr)" subtitle="Jins kesimida">
                <BarChart data={educationFormBakalavr} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Erkak" fill={COLOR_MALE} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Ayol" fill={COLOR_FEMALE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartCard>
            )}

            {/* 9. Ta'lim shakli (Magistr) */}
            {educationFormMagistr.length > 0 && (
              <ChartCard title="Ta'lim shakli (Magistr)" subtitle="Jins kesimida">
                <BarChart data={educationFormMagistr} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Erkak" fill={COLOR_MALE} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Ayol" fill={COLOR_FEMALE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartCard>
            )}

            {/* 10. Kurs bo'yicha (Bakalavr) */}
            {levelBakalavr.length > 0 && levelBakalavData.length > 0 && (
              <ChartCard title="Kurs bo'yicha (Bakalavr)" subtitle="Ta'lim shakli kesimida">
                <BarChart
                  data={levelBakalavr.map((r) => r.row)}
                  margin={{ left: 8, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {levelBakalavData.map((form, i) => (
                    <Bar
                      key={form}
                      dataKey={form}
                      stackId="a"
                      fill={LEVEL_COLORS[i % LEVEL_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ChartCard>
            )}

            {/* 11. Kurs bo'yicha (Magistr) */}
            {levelMagistr.length > 0 && levelMagistrData.length > 0 && (
              <ChartCard title="Kurs bo'yicha (Magistr)" subtitle="Ta'lim shakli kesimida">
                <BarChart
                  data={levelMagistr.map((r) => r.row)}
                  margin={{ left: 8, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {levelMagistrData.map((form, i) => (
                    <Bar
                      key={form}
                      dataKey={form}
                      stackId="a"
                      fill={LEVEL_COLORS[i % LEVEL_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ChartCard>
            )}
          </div>
        )
      )}
    </div>
  );
}
