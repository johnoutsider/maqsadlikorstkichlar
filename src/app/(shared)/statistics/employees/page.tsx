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
import type { HemisStatEmployeeData } from "@/app/api/hemis/stat-employee/route";

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
const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444"];

function toGenderRows(obj: Record<string, { Erkak: number; Ayol: number }>) {
  return Object.entries(obj).map(([name, v]) => ({
    name,
    Erkak: v.Erkak,
    Ayol: v.Ayol,
  }));
}

function toSingleRows(obj: Record<string, number>) {
  return Object.entries(obj).map(([name, value]) => ({ name, value }));
}

export default function EmployeeStatsPage() {
  const [data, setData] = useState<HemisStatEmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hemis/stat-employee", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data as HemisStatEmployeeData);
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

  const positionRows = useMemo(
    () => (data ? toSingleRows(data.position) : []),
    [data]
  );
  const ageRows = useMemo(() => (data ? toGenderRows(data.age) : []), [data]);
  const degreeRows = useMemo(
    () => (data ? toGenderRows(data.academic_degree) : []),
    [data]
  );
  const rankRows = useMemo(
    () => (data ? toGenderRows(data.academic_rank) : []),
    [data]
  );
  const citizenshipRows = useMemo(
    () => (data ? toSingleRows(data.citizenship) : []),
    [data]
  );
  const employmentRows = useMemo(
    () => (data ? toSingleRows(data.employment_form) : []),
    [data]
  );
  const directionRows = useMemo(
    () => (data ? toSingleRows(data.direction).filter((r) => r.value > 0) : []),
    [data]
  );

  const kpis: Stat[] = data
    ? [
        { label: "Jami hodimlar", value: data.gender.Jami ?? 0, tone: "primary" },
        { label: "Erkaklar", value: data.gender.Erkak ?? 0 },
        { label: "Ayollar", value: data.gender.Ayol ?? 0 },
        { label: "Darajali", value: data.academic.Darajali ?? 0, tone: "success" },
        { label: "Darajasiz", value: data.academic.Darajasiz ?? 0, tone: "warning" },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Hodimlar statistikasi (HEMIS)
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manba: student.uzswlu.uz
            {cachedAt && (
              <span className="ml-2">
                · Bazaga saqlangan: {cachedAt.toLocaleString("uz-UZ")}
                {isStale && (
                  <span className="ml-1 text-amber-500">(eskirgan ma'lumot)</span>
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
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : (
        data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Lavozim bo'yicha" subtitle="Hodimlar soni">
              <BarChart data={positionRows} layout="vertical" margin={{ left: 24, right: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={130} />
                <Tooltip />
                <Bar dataKey="value" fill={COLOR_PRIMARY} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ChartCard>

            <ChartCard title="Yosh bo'yicha" subtitle="Jins kesimida">
              <BarChart data={ageRows} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Erkak" fill={COLOR_MALE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ayol" fill={COLOR_FEMALE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Ilmiy daraja" subtitle="Jins kesimida">
              <BarChart data={degreeRows} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Erkak" fill={COLOR_MALE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ayol" fill={COLOR_FEMALE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Ilmiy unvon" subtitle="Jins kesimida">
              <BarChart data={rankRows} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Erkak" fill={COLOR_MALE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ayol" fill={COLOR_FEMALE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Fuqarolik" subtitle="Hodimlar tarkibi">
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

            <ChartCard title="Ish shakli" subtitle="Bandlik turi bo'yicha">
              <BarChart data={employmentRows} layout="vertical" margin={{ left: 24, right: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ChartCard>

            {directionRows.length > 0 && (
              <ChartCard title="Rahbar lavozimlar" subtitle="Boshqaruv tarkibi">
                <BarChart data={directionRows} layout="vertical" margin={{ left: 24, right: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={130} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ChartCard>
            )}
          </div>
        )
      )}
    </div>
  );
}
