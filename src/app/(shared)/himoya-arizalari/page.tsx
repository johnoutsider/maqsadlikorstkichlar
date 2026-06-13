"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DEFENSE_STATUS_LABEL } from "@/lib/defense-workflow";
import type { DefenseStatus } from "@/types/db";

interface DefenseApplicationRow {
  id: string;
  reference_code: string;
  applicant_full_name: string | null;
  status: DefenseStatus;
  created_at: string;
}

export default function HimoyaArizalariPage() {
  const supabase = createClient();
  const [applications, setApplications] = useState<DefenseApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      setLoading(true);
      const { data } = await supabase
        .from("defense_applications")
        .select("id, reference_code, applicant_full_name, status, created_at")
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      if (data) setApplications(data as DefenseApplicationRow[]);
      setLoading(false);
    }
    fetchApplications();
  }, [supabase]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-display text-(--on-surface)">Himoya arizalari</h1>
        <p className="text-(--on-surface-variant) text-sm mt-1">
          Dissertatsiya himoyasi uchun topshirilgan arizalar ro&apos;yxati
        </p>
      </div>

      <div className="bg-(--surface-container-lowest) p-6 rounded-2xl border border-(--outline-variant) shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-(--on-surface-variant)">Yuklanmoqda...</div>
        ) : applications.length === 0 ? (
          <div className="py-8 text-center text-(--on-surface-variant)">Hozircha arizalar mavjud emas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-(--outline-variant) text-(--on-surface-variant) text-sm font-medium">
                  <th className="pb-3 px-4">Ariza raqami</th>
                  <th className="pb-3 px-4">Arizachi</th>
                  <th className="pb-3 px-4">Sana</th>
                  <th className="pb-3 px-4 text-center">Holat</th>
                  <th className="pb-3 px-4 text-right">Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-(--outline-variant)/50 hover:bg-(--surface-container-low) transition-colors">
                    <td className="py-3 px-4 font-medium text-(--on-surface)">{app.reference_code}</td>
                    <td className="py-3 px-4 text-sm text-(--on-surface-variant)">{app.applicant_full_name ?? "-"}</td>
                    <td className="py-3 px-4 text-sm text-(--on-surface-variant)">
                      {new Date(app.created_at).toLocaleDateString("uz-UZ")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${DEFENSE_STATUS_LABEL[app.status].cls}`}>
                        {DEFENSE_STATUS_LABEL[app.status].text}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/himoya-arizalari/${app.id}`} className="text-sm font-medium text-(--primary)">
                        Batafsil
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
