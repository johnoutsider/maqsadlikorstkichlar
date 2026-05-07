"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type {
  Teacher,
  IlmiyDaraja,
  IlmiyUnvon,
  IshTuri,
  FaoliyatHolati,
  Faculty,
  Department,
} from "@/types/db";
import {
  ILMIY_DARAJA_LABEL,
  ILMIY_UNVON_LABEL,
  ISH_TURI_LABEL,
  FAOLIYAT_LABEL,
  FAOLIYAT_COLOR,
} from "./_lib/options";

interface TeacherRow extends Teacher {
  faculty_name: string;
  department_name: string;
}

export default function TeachersPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const router = useRouter();

  const canEdit = user?.role === "staff_manager";
  const isDean  = user?.role === "dean";

  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters — deans are locked to their own faculty
  const [search, setSearch] = useState("");
  const [filterFaculty, setFilterFaculty] = useState(
    () => (user?.role === "dean" ? (user.faculty_id ?? "") : "")
  );
  const [filterDept, setFilterDept] = useState("");
  const [filterDaraja, setFilterDaraja] = useState("");
  const [filterUnvon, setFilterUnvon] = useState("");
  const [filterIshTuri, setFilterIshTuri] = useState("");
  const [filterHolati, setFilterHolati] = useState("");

  // -------------------------------------------------------------------------
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    const [tf, td] = await Promise.all([
      supabase.from("faculties").select("*").order("name"),
      supabase.from("departments").select("*").order("name"),
    ]);

    const facs = (tf.data as Faculty[]) ?? [];
    const deps = (td.data as Department[]) ?? [];
    setFaculties(facs);
    setDepartments(deps);

    const facMap = new Map(facs.map((f) => [f.id, f.name]));
    const deptMap = new Map(deps.map((d) => [d.id, d.name]));

    let query = supabase.from("teachers").select("*").order("last_name");
    if (user.role === "dean" && user.faculty_id) {
      query = query.eq("faculty_id", user.faculty_id);
    }
    const { data, error: dbErr } = await query;

    if (dbErr) { setError(dbErr.message); setLoading(false); return; }

    setRows(
      ((data as Teacher[]) ?? []).map((t) => ({
        ...t,
        faculty_name:    facMap.get(t.faculty_id)    ?? "",
        department_name: deptMap.get(t.department_id) ?? "",
      }))
    );
    setLoading(false);
  }, [supabase, user]);

  // Lock faculty filter to dean's own faculty once user is resolved
  useEffect(() => {
    if (isDean && user?.faculty_id) setFilterFaculty(user.faculty_id);
  }, [isDean, user?.faculty_id]);

  useEffect(() => { load(); }, [load]);

  // -------------------------------------------------------------------------
  const deptsByFaculty = useMemo(
    () => departments.filter((d) => !filterFaculty || d.faculty_id === filterFaculty),
    [departments, filterFaculty]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      const name = `${r.last_name} ${r.first_name} ${r.middle_name ?? ""}`.toLowerCase();
      if (q && !name.includes(q)) return false;
      if (filterFaculty && r.faculty_id    !== filterFaculty) return false;
      if (filterDept    && r.department_id !== filterDept)    return false;
      if (filterDaraja  && r.ilmiy_daraja  !== filterDaraja)  return false;
      if (filterUnvon   && r.ilmiy_unvon   !== filterUnvon)   return false;
      if (filterIshTuri && r.ish_turi      !== filterIshTuri) return false;
      if (filterHolati  && r.faoliyat_holati !== filterHolati) return false;
      return true;
    });
  }, [rows, search, filterFaculty, filterDept, filterDaraja, filterUnvon, filterIshTuri, filterHolati]);

  // -------------------------------------------------------------------------
  async function remove(row: TeacherRow) {
    if (!confirm(`"${row.last_name} ${row.first_name}" o'qituvchisini o'chirishni tasdiqlaysizmi?`)) return;
    const { error: dbErr } = await supabase.from("teachers").delete().eq("id", row.id);
    if (dbErr) { alert(dbErr.message); return; }
    load();
  }

  // -------------------------------------------------------------------------
  function exportCsv() {
    const headers = [
      "Familiya", "Ism", "Otasining ismi",
      "Fakultet", "Kafedra",
      "Lavozim", "Ilmiy daraja", "Ilmiy unvon",
      "Stavka", "Ish turi",
      "Ishga kirgan sana", "Tug'ilgan sana", "Jinsi",
      "Telefon", "Email",
      "Faoliyat holati",
    ];
    const esc = (v: string | null | undefined) => {
      const s = v ?? "";
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = filtered.map((r) => [
      esc(r.last_name), esc(r.first_name), esc(r.middle_name),
      esc(r.faculty_name), esc(r.department_name),
      esc(r.lavozim),
      r.ilmiy_daraja ? esc(ILMIY_DARAJA_LABEL[r.ilmiy_daraja]) : "",
      r.ilmiy_unvon  ? esc(ILMIY_UNVON_LABEL[r.ilmiy_unvon])  : "",
      esc(r.stavka),
      r.ish_turi ? esc(ISH_TURI_LABEL[r.ish_turi]) : "",
      esc(r.ishga_kirgan_sana), esc(r.birth_date),
      r.gender === "erkak" ? "Erkak" : r.gender === "ayol" ? "Ayol" : "",
      esc(r.phone), esc(r.email),
      esc(FAOLIYAT_LABEL[r.faoliyat_holati]),
    ].join(","));

    const csv  = "﻿" + [headers.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "oqituvchilar.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // -------------------------------------------------------------------------
  const selCls =
    "rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            O&apos;qituvchilar ro&apos;yxati
          </h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            {loading ? "Yuklanmoqda…" : `Jami: ${filtered.length} ta o'qituvchi`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            Excel / CSV
          </Button>
          {canEdit && (
            <Button onClick={() => router.push("/teachers/new")}>
              + O&apos;qituvchi qo&apos;shish
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700 dark:bg-danger-900/30 dark:text-danger-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Ism bo'yicha qidirish…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-52"
        />

        {!canEdit && (
          <>
            <select
              value={filterFaculty}
              onChange={(e) => { if (!isDean) { setFilterFaculty(e.target.value); setFilterDept(""); } }}
              disabled={isDean}
              className={selCls}
            >
              {!isDean && <option value="">Barcha fakultetlar</option>}
              {(isDean
                ? faculties.filter((f) => f.id === filterFaculty)
                : faculties
              ).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className={selCls}
            >
              <option value="">Barcha kafedralar</option>
              {deptsByFaculty.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </>
        )}

        <select value={filterDaraja} onChange={(e) => setFilterDaraja(e.target.value)} className={selCls}>
          <option value="">Barcha darajalar</option>
          {(Object.entries(ILMIY_DARAJA_LABEL) as [IlmiyDaraja, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={filterUnvon} onChange={(e) => setFilterUnvon(e.target.value)} className={selCls}>
          <option value="">Barcha unvonlar</option>
          {(Object.entries(ILMIY_UNVON_LABEL) as [IlmiyUnvon, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={filterIshTuri} onChange={(e) => setFilterIshTuri(e.target.value)} className={selCls}>
          <option value="">Asosiy / O&apos;rindosh</option>
          {(Object.entries(ISH_TURI_LABEL) as [IshTuri, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={filterHolati} onChange={(e) => setFilterHolati(e.target.value)} className={selCls}>
          <option value="">Barcha holatlar</option>
          {(Object.entries(FAOLIYAT_LABEL) as [FaoliyatHolati, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800">
        {loading ? (
          <div className="p-12 text-center text-surface-400">Yuklanmoqda…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-surface-400">
            {rows.length === 0
              ? canEdit
                ? "Hali o'qituvchi qo'shilmagan. Yuqoridagi tugmani bosing."
                : "Hali o'qituvchi mavjud emas."
              : "Qidiruv natijasi topilmadi."}
          </div>
        ) : (
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">F.I.O</th>
                {!canEdit && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Kafedra</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Lavozim</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Ilmiy daraja</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Ilmiy unvon</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Stavka</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Ish turi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Holat</th>
                {canEdit && (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-surface-500">Amallar</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {filtered.map((r, idx) => (
                <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-surface-400">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {r.last_name} {r.first_name}{r.middle_name ? ` ${r.middle_name}` : ""}
                    </p>
                    {r.phone && (
                      <p className="text-xs text-surface-400 mt-0.5">{r.phone}</p>
                    )}
                  </td>
                  {!canEdit && (
                    <td className="px-4 py-3 text-sm">
                      <span className="block font-medium text-surface-700 dark:text-surface-200">{r.department_name}</span>
                      <span className="text-xs text-surface-400">{r.faculty_name}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">{r.lavozim ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">
                    {r.ilmiy_daraja ? ILMIY_DARAJA_LABEL[r.ilmiy_daraja] : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">
                    {r.ilmiy_unvon ? ILMIY_UNVON_LABEL[r.ilmiy_unvon] : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">{r.stavka ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">
                    {r.ish_turi ? ISH_TURI_LABEL[r.ish_turi] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${FAOLIYAT_COLOR[r.faoliyat_holati]}`}>
                      {FAOLIYAT_LABEL[r.faoliyat_holati]}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/teachers/${r.id}/edit`)}
                        >
                          Tahrirlash
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(r)}>
                          O&apos;chirish
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
