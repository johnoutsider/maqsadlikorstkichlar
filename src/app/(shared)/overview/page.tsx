"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

function currentQuarter(): Quarter {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

interface Stat {
  label: string;
  value: number | string;
  href?: string;
  tone?: "default" | "warning" | "success" | "danger";
}

interface ChartRow {
  name: string;
  foiz: number;
}

interface DeptChartRow {
  name: string;
  target: number;   // target %  (yellow bar)
  actual: number;   // actual %  (green/red bar)
}

function StatCard({ stat }: { stat: Stat }) {
  const toneCls: Record<string, string> = {
    default: "text-surface-900 dark:text-surface-100",
    warning: "text-amber-600 dark:text-amber-400",
    success: "text-green-600 dark:text-green-400",
    danger: "text-danger-600 dark:text-danger-400",
  };
  const content = (
    <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-5 hover:border-primary-400 transition">
      <p className="text-xs uppercase font-medium text-surface-500 dark:text-surface-400">
        {stat.label}
      </p>
      <p className={`text-3xl font-bold mt-2 ${toneCls[stat.tone ?? "default"]}`}>
        {stat.value}
      </p>
    </div>
  );
  return stat.href ? <Link href={stat.href}>{content}</Link> : content;
}

// ── Color helper for department actual bar ────────────────────────
function deptBarColor(actual: number, target: number): string {
  if (actual >= target) return "#22c55e";        // green  — met or exceeded
  if (actual >= target * 0.7) return "#facc15";  // yellow — within 70% of target
  return "#ef4444";                              // red    — below 70% of target
}

export default function OverviewPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [stats, setStats] = useState<Stat[] | null>(null);

  // Faculty chart
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Department chart
  const [deptChartData, setDeptChartData] = useState<DeptChartRow[]>([]);
  const [deptChartLoading, setDeptChartLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setError("");
      const year = new Date().getFullYear();
      const q = currentQuarter();

      try {
        // ── super_admin ───────────────────────────────────────────
        if (user.role === "super_admin") {
          const [u, usrs] = await Promise.all([
            supabase.from("universities").select("*", { count: "exact", head: true }),
            supabase.from("users").select("*", { count: "exact", head: true }),
          ]);
          setStats([
            { label: "Universitetlar", value: u.count ?? 0, href: "/universities" },
            { label: "Foydalanuvchilar (jami)", value: usrs.count ?? 0 },
          ]);
          return;
        }

        if (!user.university_id) { setStats([]); return; }

        // ── university_admin ──────────────────────────────────────
        if (user.role === "university_admin") {
          const base = { count: "exact" as const, head: true };
          const [f, d, i, u, pending] = await Promise.all([
            supabase.from("faculties").select("*", base).eq("university_id", user.university_id),
            supabase.from("departments").select("*", base).eq("university_id", user.university_id),
            supabase.from("indicators").select("*", base).eq("university_id", user.university_id),
            supabase.from("users").select("*", base).eq("university_id", user.university_id),
            supabase.from("submissions").select("*", base).eq("university_id", user.university_id).eq("status", "pending"),
          ]);
          setStats([
            { label: "Fakultetlar", value: f.count ?? 0, href: "/faculties" },
            { label: "Kafedralar", value: d.count ?? 0, href: "/departments" },
            { label: "Ko'rsatkichlar", value: i.count ?? 0, href: "/indicators" },
            { label: "Foydalanuvchilar", value: u.count ?? 0, href: "/users" },
            { label: "Tasdiqlash kutilmoqda", value: pending.count ?? 0, href: "/submissions", tone: "warning" },
          ]);
          return;
        }

        // ── science_department / vice_rector ──────────────────────
        if (user.role === "science_department" || user.role === "vice_rector") {
          const base = { count: "exact" as const, head: true };

          const [pending, approved, rejected, totalDepts] = await Promise.all([
            supabase.from("submissions").select("*", base).eq("university_id", user.university_id).eq("status", "pending"),
            supabase.from("submissions").select("*", base).eq("university_id", user.university_id).eq("status", "approved").eq("year", year).eq("quarter", q),
            supabase.from("submissions").select("*", base).eq("university_id", user.university_id).eq("status", "rejected").eq("year", year).eq("quarter", q),
            supabase.from("departments").select("*", base).eq("university_id", user.university_id),
          ]);

          setStats([
            { label: "Tasdiqlash kutilmoqda", value: pending.count ?? 0, href: "/submissions", tone: "warning" },
            { label: `Tasdiqlangan (${year} ${q})`, value: approved.count ?? 0, tone: "success" },
            { label: `Rad etilgan (${year} ${q})`, value: rejected.count ?? 0, tone: "danger" },
            { label: "Kafedralar (jami)", value: totalDepts.count ?? 0 },
          ]);

          // ── CHART 1: Faculty approved % ────────────────────────
          setChartLoading(true);
          try {
            const { data: faculties } = await supabase
              .from("faculties")
              .select("id, name")
              .eq("university_id", user.university_id)
              .order("name", { ascending: true });

            if (faculties && faculties.length > 0) {
              const rows = await Promise.all(
                faculties.map(async (faculty) => {
                  const [totalRes, approvedRes] = await Promise.all([
                    supabase.from("departments").select("*", { count: "exact", head: true }).eq("faculty_id", faculty.id),
                    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("faculty_id", faculty.id).eq("status", "approved").eq("year", year).eq("quarter", q),
                  ]);
                  const total = totalRes.count ?? 0;
                  const approvedCount = approvedRes.count ?? 0;
                  const foiz = total > 0 ? Math.round((approvedCount / total) * 100) : 0;
                  return { name: faculty.name, foiz };
                })
              );
              setChartData(rows);
            }
          } finally {
            setChartLoading(false);
          }

          // ── CHART 2: Department target vs actual % ─────────────
          setDeptChartLoading(true);
          try {
            const { data: departments } = await supabase
              .from("departments")
              .select("id, name")
              .eq("university_id", user.university_id)
              .order("name", { ascending: true });

            if (departments && departments.length > 0) {
              const rows = await Promise.all(
                departments.map(async (dept) => {
                  // total indicators = target
                  // approved submissions = actual achieved
                  const [targetRes, actualRes] = await Promise.all([
                    supabase
                      .from("indicators")
                      .select("*", { count: "exact", head: true })
                      .eq("department_id", dept.id),
                    supabase
                      .from("submissions")
                      .select("*", { count: "exact", head: true })
                      .eq("department_id", dept.id)
                      .eq("status", "approved")
                      .eq("year", year)
                      .eq("quarter", q),
                  ]);
                  const target = targetRes.count ?? 0;
                  const actual = actualRes.count ?? 0;
                  const targetFoiz = 100; // target is always 100% baseline
                  const actualFoiz = target > 0 ? Math.round((actual / target) * 100) : 0;
                  return { name: dept.name, target: targetFoiz, actual: actualFoiz };
                })
              );
              setDeptChartData(rows);
            }
          } finally {
            setDeptChartLoading(false);
          }

          return;
        }

        // ── dean ──────────────────────────────────────────────────
        if (user.role === "dean" && user.faculty_id) {
          const base = { count: "exact" as const, head: true };
          const [depts, pending, approved] = await Promise.all([
            supabase.from("departments").select("*", base).eq("faculty_id", user.faculty_id),
            supabase.from("submissions").select("*", base).eq("faculty_id", user.faculty_id).eq("status", "pending").eq("year", year).eq("quarter", q),
            supabase.from("submissions").select("*", base).eq("faculty_id", user.faculty_id).eq("status", "approved").eq("year", year).eq("quarter", q),
          ]);
          setStats([
            { label: "Kafedralar", value: depts.count ?? 0 },
            { label: `Tasdiqlash kutilmoqda (${q})`, value: pending.count ?? 0, tone: "warning" },
            { label: `Tasdiqlangan (${q})`, value: approved.count ?? 0, tone: "success" },
          ]);
          return;
        }

        // ── staff_manager ─────────────────────────────────────────
        if (user.role === "staff_manager" && user.department_id) {
          const { data } = await supabase
            .from("submissions")
            .select("status, submitted_at, reviewed_at")
            .eq("department_id", user.department_id)
            .eq("year", year)
            .eq("quarter", q)
            .maybeSingle();
          const status = (data as any)?.status ?? "none";
          const labelMap: Record<string, string> = {
            none: "Boshlanmagan",
            draft: "Qoralama",
            pending: "Yuborilgan — kutilmoqda",
            approved: "Tasdiqlangan",
            rejected: "Rad etilgan",
          };
          const toneMap: Record<string, Stat["tone"]> = {
            none: "default",
            draft: "default",
            pending: "warning",
            approved: "success",
            rejected: "danger",
          };
          setStats([
            { label: `Joriy chorak (${year} ${q})`, value: labelMap[status], href: "/form", tone: toneMap[status] },
          ]);
          return;
        }

        setStats([]);
      } catch (e: any) {
        setError(e?.message ?? "Xatolik");
      }
    })();
  }, [supabase, user]);

  if (!user) return null;

  const isChartRole =
    user.role === "science_department" || user.role === "vice_rector";

  // height for dept chart — 40px per row minimum so labels are readable
  const deptChartHeight = Math.max(400, deptChartData.length * 44);

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          Salom, {user.display_name}
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Joriy holat va statistikalar
        </p>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* ── Stat Cards ── */}
      {stats === null ? (
        <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
      ) : stats.length === 0 ? (
        <div className="p-8 text-center text-surface-500">Ma&apos;lumot mavjud emas.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => <StatCard key={i} stat={s} />)}
        </div>
      )}

      {/* ── CHART 1: Faculty bar chart (vertical) ── */}
      {isChartRole && (
        <div className="mt-8 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-5">
          <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-4">
            Foiz vs. Fakultet
          </h2>
          {chartLoading ? (
            <div className="h-[300px] flex items-center justify-center text-surface-400 text-sm">
              Grafik yuklanmoqda...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-surface-400 text-sm">
              Ma&apos;lumot mavjud emas.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value ?? 0)}%`, "Foiz"]}
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                />
                <Bar dataKey="foiz" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.foiz >= 70 ? "#facc15" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── CHART 2: Department horizontal bar chart ── */}
      {isChartRole && (
        <div className="mt-6 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-5">
          <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-4">
            Foiz vs. Kafedra
          </h2>
          {deptChartLoading ? (
            <div className="h-[300px] flex items-center justify-center text-surface-400 text-sm">
              Grafik yuklanmoqda...
            </div>
          ) : deptChartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-surface-400 text-sm">
              Ma&apos;lumot mavjud emas.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={deptChartHeight}>
              <BarChart
                layout="vertical"
                data={deptChartData}
                margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={200}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value ?? 0)}%`,
                    name === "target" ? "Maqsad" : "Bajarilgan",
                  ]}
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                />
                {/* Target bar — always yellow */}
                <Bar dataKey="target" name="target" radius={[0, 4, 4, 0]} barSize={10}>
                  {deptChartData.map((_, i) => (
                    <Cell key={`t-${i}`} fill="#facc15" />
                  ))}
                  <LabelList
                    dataKey="target"
                    position="right"
                    formatter={(v) => `${Number(v ?? 0)}%`}
                    style={{ fontSize: 10, fill: "#6b7280" }}
                  />
                </Bar>
                {/* Actual bar — green/yellow/red based on performance */}
                <Bar dataKey="actual" name="actual" radius={[0, 4, 4, 0]} barSize={10}>
                  {deptChartData.map((entry, i) => (
                    <Cell
                      key={`a-${i}`}
                      fill={deptBarColor(entry.actual, entry.target)}
                    />
                  ))}
                  <LabelList
                    dataKey="actual"
                    position="right"
                    formatter={(v) => `${Number(v ?? 0)}%`}
                    style={{ fontSize: 10, fill: "#6b7280" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs text-surface-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400" /> Maqsad (100%)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Bajarilgan (≥100%)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400 opacity-70" /> Qisman (70–99%)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Past (&lt;70%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
