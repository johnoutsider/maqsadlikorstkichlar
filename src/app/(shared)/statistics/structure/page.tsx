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
  LabelList,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/Skeleton";
import type { HemisStatStructureData } from "@/app/api/hemis/stat-structure/route";

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
  tall,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{title}</h3>
        {subtitle && (
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className={tall ? "h-96" : "h-72"}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"];

const KURS_LABELS = ["1-kurs", "2-kurs", "3-kurs", "4-kurs", "5-kurs", "6-kurs"];

export default function StructureStatsPage() {
  const [data, setData] = useState<HemisStatStructureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hemis/stat-structure", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data as HemisStatStructureData);
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

  // Kurs bo'yicha talabalar — grouped bar (Bakalavr + Magistr per kurs)
  const kursRows = useMemo(() => {
    if (!data) return [];
    return KURS_LABELS.map((kurs) => {
      const row: Record<string, number | string> = { kurs };
      for (const [edu, kurses] of Object.entries(data.groups)) {
        row[edu] = kurses[kurs] ?? 0;
      }
      return row;
    });
  }, [data]);

  const eduTypes = useMemo(
    () => (data ? Object.keys(data.groups) : []),
    [data]
  );

  const totalStudents = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.groups).reduce((sum, kurses) => {
      return sum + Object.values(kurses).reduce((s, v) => s + v, 0);
    }, 0);
  }, [data]);

  const totalByEdu = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    return Object.fromEntries(
      Object.entries(data.groups).map(([edu, kurses]) => [
        edu,
        Object.values(kurses).reduce((s, v) => s + v, 0),
      ])
    );
  }, [data]);

  const totalAuditoriums = useMemo(
    () => data?.auditoriums.reduce((s, r) => s + r.count, 0) ?? 0,
    [data]
  );

  const kpis: Stat[] = data
    ? [
        { label: "Jami talabalar", value: totalStudents, tone: "primary" },
        ...eduTypes.map((edu) => ({ label: edu, value: totalByEdu[edu] ?? 0 })),
        { label: "Jami auditoriyalar", value: totalAuditoriums, tone: "success" },
        { label: "Mutaxassisliklar", value: data.specialities.reduce((s, r) => s + r.count, 0), tone: "warning" },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Tuzilma statistikasi (HEMIS)
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
          <button onClick={load} className="text-sm font-medium text-danger-700 dark:text-danger-300 underline">
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

            {/* Talabalar kurs bo'yicha */}
            <ChartCard title="Talabalar kurs bo'yicha" subtitle="Ta'lim turi kesimida">
              <BarChart data={kursRows} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="kurs" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {eduTypes.map((edu, i) => (
                  <Bar key={edu} dataKey={edu} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ChartCard>

            {/* Ta'lim turi bo'yicha umumiy (pie) */}
            <ChartCard title="Ta'lim turi bo'yicha" subtitle="Jami talabalar tarkibi">
              <PieChart>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Pie
                  data={eduTypes.map((edu) => ({ name: edu, value: totalByEdu[edu] ?? 0 }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  label={(p: { value?: number }) => `${p.value ?? 0}`}
                >
                  {eduTypes.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartCard>

            {/* Auditoriyalar */}
            <ChartCard title="Auditoriyalar" subtitle="Tur bo'yicha soni">
              <BarChart data={data.auditoriums} layout="vertical" margin={{ left: 24, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                <Tooltip />
                <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ChartCard>

            {/* Mutaxassisliklar */}
            <ChartCard title="Mutaxassisliklar" subtitle="Ta'lim bosqichi bo'yicha">
              <BarChart data={data.specialities} layout="vertical" margin={{ left: 24, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={130} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ChartCard>

            {/* Bo'limlar tuzilmasi — full width */}
            <div className="lg:col-span-2">
              <ChartCard title="Tashkiliy tuzilma" subtitle="Bo'lim turi bo'yicha">
                <BarChart data={data.departments} margin={{ left: 8, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.departments.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ChartCard>
            </div>

          </div>
        )
      )}
    </div>
  );
}
