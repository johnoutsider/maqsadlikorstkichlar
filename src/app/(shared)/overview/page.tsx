"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

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

function StatCard({ stat }: { stat: Stat }) {
  const toneCls: Record<string, string> = {
    default: "text-surface-900 dark:text-surface-100",
    warning: "text-amber-600 dark:text-amber-400",
    success: "text-green-600 dark:text-green-400",
    danger: "text-danger-600 dark:text-danger-400",
  };
  const content = (
    <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-5 hover:border-primary-400 transition">
      <p className="text-xs uppercase font-medium text-surface-500 dark:text-surface-400">{stat.label}</p>
      <p className={`text-3xl font-bold mt-2 ${toneCls[stat.tone ?? "default"]}`}>{stat.value}</p>
    </div>
  );
  return stat.href ? <Link href={stat.href}>{content}</Link> : content;
}

export default function OverviewPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setError("");
      const year = new Date().getFullYear();
      const q = currentQuarter();

      try {
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

        if (!user.university_id) {
          setStats([]);
          return;
        }

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

        if (user.role === "science_department" || user.role === "vice_rector") {
          const base = { count: "exact" as const, head: true };
          const common = { status_col: "status" };
          const [pending, approved, rejected, totalDepts] = await Promise.all([
            supabase.from("submissions").select("*", base).eq("university_id", user.university_id).eq("status", "pending"),
            supabase.from("submissions").select("*", base).eq("university_id", user.university_id).eq("status", "approved").eq("year", year).eq("quarter", q),
            supabase.from("submissions").select("*", base).eq("university_id", user.university_id).eq("status", "rejected").eq("year", year).eq("quarter", q),
            supabase.from("departments").select("*", base).eq("university_id", user.university_id),
          ]);
          void common;
          setStats([
            { label: "Tasdiqlash kutilmoqda", value: pending.count ?? 0, href: "/submissions", tone: "warning" },
            { label: `Tasdiqlangan (${year} ${q})`, value: approved.count ?? 0, tone: "success" },
            { label: `Rad etilgan (${year} ${q})`, value: rejected.count ?? 0, tone: "danger" },
            { label: "Kafedralar (jami)", value: totalDepts.count ?? 0 },
          ]);
          return;
        }

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          Salom, {user.display_name}
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Joriy holat va statistikalar
        </p>
      </div>

      {error && <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>}

      {stats === null ? (
        <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
      ) : stats.length === 0 ? (
        <div className="p-8 text-center text-surface-500">Ma&apos;lumot mavjud emas.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => <StatCard key={i} stat={s} />)}
        </div>
      )}
    </div>
  );
}
