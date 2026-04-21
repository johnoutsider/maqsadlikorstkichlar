"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function DoktorantlarPage() {
  const [doktorantlar, setDoktorantlar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchDocs() {
      setLoading(true);
      const { data, error } = await supabase
        .from("doktorantlar")
        .select(`
          id,
          full_name,
          student_id,
          enrollment_year,
          thesis_status,
          departments(name),
          supervisors(full_name)
        `);
      
      if (data) setDoktorantlar(data);
      setLoading(false);
    }
    fetchDocs();
  }, [supabase]);

  const thesisStatusMap: Record<string, string> = {
    taklif: "Taklif",
    jarayonda: "Jarayonda",
    korib_chiqilmoqda: "Ko'rib chiqilmoqda",
    himoyalangan: "Himoyalangan",
    yakunlangan: "Yakunlangan"
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-display text-(--on-surface)">Doktorantlar</h1>
          <p className="text-(--on-surface-variant) text-sm mt-1">Universitet bo'yicha barcha doktorantlar ro'yxati</p>
        </div>
        <div className="flex gap-3">
          <Link href="/doktorantura/create/doktorant">
            <Button variant="primary">Qo'shish</Button>
          </Link>
        </div>
      </div>

      <div className="bg-(--surface-container-lowest) p-6 rounded-2xl border border-(--outline-variant) shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-(--on-surface-variant)">Yuklanmoqda...</div>
        ) : doktorantlar.length === 0 ? (
          <div className="py-8 text-center text-(--on-surface-variant)">Hozircha doktorantlar mavjud emas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-(--outline-variant) text-(--on-surface-variant) text-sm font-medium">
                  <th className="pb-3 px-4">F.I.Sh</th>
                  <th className="pb-3 px-4">Kafedra</th>
                  <th className="pb-3 px-4">Ilmiy Rahbar</th>
                  <th className="pb-3 px-4 text-center">Qabul qilingan yil</th>
                  <th className="pb-3 px-4 text-center">Holat</th>
                  <th className="pb-3 px-4 text-right">Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {doktorantlar.map(d => (
                  <tr key={d.id} className="border-b border-(--outline-variant)/50 hover:bg-(--surface-container-low) transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-(--on-surface)">{d.full_name}</div>
                      
                    </td>
                    <td className="py-3 px-4 text-sm text-(--on-surface-variant)">
                      {d.departments?.name || "Birlashtirilmagan"}
                    </td>
                    <td className="py-3 px-4 text-sm text-(--on-surface-variant)">
                      {d.supervisors?.full_name || "Birlashtirilmagan"}
                    </td>
                    <td className="py-3 px-4 text-center text-sm">{d.enrollment_year}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-full bg-(--primary-container) text-(--on-primary-container) text-xs font-medium">
                        {thesisStatusMap[d.thesis_status] || d.thesis_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/doktorantura/${d.id}`}>
                        <Button variant="outline" size="sm">Batafsil</Button>
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
