"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface StudentRow {
  id: string;
  full_name: string;
  student_id: string;
  research_topic: string;
}

export default function MyStudentsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;

      setLoading(true);

      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!supervisor) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("doktorantlar")
        .select("id, full_name, student_id, research_topic")
        .eq("supervisor_id", supervisor.id)
        .order("full_name");

      setStudents((data as StudentRow[]) ?? []);
      setLoading(false);
    }

    load();
  }, [supabase, user]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Mening doktorantlarim</h1>
        <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
          Sizga biriktirilgan doktorantlar ro&apos;yxati
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Hozirda sizga biriktirilgan doktorantlar yo&apos;q.</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Ism</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Student ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Mavzu</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Harakatlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                  <td className="px-4 py-3 text-sm">{s.full_name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-surface-700 dark:text-surface-300">{s.student_id}</td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">{s.research_topic}</td>
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/doktorantura/hisobotlar/${s.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                      Hisobotlar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
