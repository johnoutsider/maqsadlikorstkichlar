"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchSups() {
      setLoading(true);
      const { data, error } = await supabase
        .from("supervisors")
        .select(`
          id,
          full_name,
          staff_id,
          academic_title,
          is_external,
          workplace,
          departments(name)
        `);
      
      if (data) setSupervisors(data);
      setLoading(false);
    }
    fetchSups();
  }, [supabase]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-display text-(--on-surface)">Ilmiy Rahbarlar</h1>
          <p className="text-(--on-surface-variant) text-sm mt-1">Universitet va tashqi ilmiy rahbarlar ro'yxati</p>
        </div>
        <div className="flex gap-3">
          <Link href="/doktorantura/create/supervisor">
            <Button variant="primary">Qo'shish</Button>
          </Link>
        </div>
      </div>

      <div className="bg-(--surface-container-lowest) p-6 rounded-2xl border border-(--outline-variant) shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-(--on-surface-variant)">Yuklanmoqda...</div>
        ) : supervisors.length === 0 ? (
          <div className="py-8 text-center text-(--on-surface-variant)">Hozircha rahbarlar mavjud emas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-(--outline-variant) text-(--on-surface-variant) text-sm font-medium">
                  <th className="pb-3 px-4">F.I.Sh / Staff ID</th>
                  <th className="pb-3 px-4">Ilmiy darajasi</th>
                  <th className="pb-3 px-4 text-center">Turi</th>
                  <th className="pb-3 px-4">Ish joyi / Kafedra</th>
                </tr>
              </thead>
              <tbody>
                {supervisors.map(s => (
                  <tr key={s.id} className="border-b border-(--outline-variant)/50 hover:bg-(--surface-container-low) transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-(--on-surface)">{s.full_name}</div>
                      <div className="text-xs text-(--on-surface-variant)">ID: {s.staff_id}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-(--on-surface-variant)">
                      {s.academic_title}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {s.is_external ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Tashqi
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "var(--primary-container)", color: "var(--on-primary-container)" }}>
                          Ichki
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-(--on-surface-variant)">
                      {s.is_external ? s.workplace : (s.departments?.name || "Birlashtirilmagan")}
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
