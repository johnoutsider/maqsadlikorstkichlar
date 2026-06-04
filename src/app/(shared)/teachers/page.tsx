"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { cacheInvalidate } from "@/lib/curriculum-cache";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
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

// ---------------------------------------------------------------------------
// Module-level cache — survives route navigations within the same session
// ---------------------------------------------------------------------------
let _cachedRows: TeacherRow[] | null = null;
let _cachedFaculties: Faculty[] | null = null;
let _cachedDepartments: Department[] | null = null;

export default function TeachersPage() {
  // Stable Supabase client — never recreated on re-renders
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const { user } = useSupabaseAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isStaffManager = user?.role === "staff_manager";
  const canEdit = isStaffManager;
  const canImport = user?.role === "university_admin" || user?.role === "super_admin";

  const [rows, setRows] = useState<TeacherRow[]>(_cachedRows ?? []);
  const [faculties, setFaculties] = useState<Faculty[]>(_cachedFaculties ?? []);
  const [departments, setDepartments] = useState<Department[]>(_cachedDepartments ?? []);
  const [loading, setLoading] = useState(_cachedRows === null);
  const [error, setError] = useState("");

  // Bulk import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResultOpen, setBulkResultOpen] = useState(false);
  type BulkRow = { row: number; name: string; status: "success" | "updated" | "error"; error?: string };
  const [bulkResults, setBulkResults] = useState<BulkRow[]>([]);
  const [bulkSummary, setBulkSummary] = useState({ succeeded: 0, updated: 0, failed: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [filterFaculty, setFilterFaculty] = useState(() => searchParams.get("faculty") ?? "");
  const [filterDept, setFilterDept] = useState(() => searchParams.get("department") ?? "");
  const [filterDaraja, setFilterDaraja] = useState("");
  const [filterUnvon, setFilterUnvon] = useState("");
  const [filterIshTuri, setFilterIshTuri] = useState("");
  const [filterHolati, setFilterHolati] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<50 | 100>(50);

  // -------------------------------------------------------------------------
  const load = useCallback(async (force = false) => {
    if (!user) return;
    // Use cache if available and not forced
    if (!force && _cachedRows !== null) {
      setRows(_cachedRows);
      setFaculties(_cachedFaculties ?? []);
      setDepartments(_cachedDepartments ?? []);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [tf, td] = await Promise.all([
      supabase.from("faculties").select("*").order("name"),
      supabase.from("departments").select("*").order("name"),
    ]);

    const facs = (tf.data as Faculty[]) ?? [];
    const deps = (td.data as Department[]) ?? [];

    const facMap = new Map(facs.map((f) => [f.id, f.name]));
    const deptMap = new Map(deps.map((d) => [d.id, d.name]));

    const { data, error: dbErr } = await supabase
      .from("teachers")
      .select("*")
      .order("last_name");

    if (dbErr) { setError(dbErr.message); setLoading(false); return; }

    const mapped: TeacherRow[] = ((data as Teacher[]) ?? []).map((t) => ({
      ...t,
      faculty_name:    facMap.get(t.faculty_id)    ?? "",
      department_name: deptMap.get(t.department_id) ?? "",
    }));

    // Save to module-level cache
    _cachedRows        = mapped;
    _cachedFaculties   = facs;
    _cachedDepartments = deps;

    setRows(mapped);
    setFaculties(facs);
    setDepartments(deps);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setFilterFaculty(searchParams.get("faculty") ?? "");
    setFilterDept(searchParams.get("department") ?? "");
  }, [searchParams]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setPage(1); }, [search, filterFaculty, filterDept, filterDaraja, filterUnvon, filterIshTuri, filterHolati, pageSize]);

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
      if (isStaffManager && user?.department_id && r.department_id !== user.department_id) return false;
      if (!isStaffManager && filterFaculty && r.faculty_id    !== filterFaculty) return false;
      if (!isStaffManager && filterDept    && r.department_id !== filterDept)    return false;
      if (filterDaraja  && r.ilmiy_daraja  !== filterDaraja)  return false;
      if (filterUnvon   && r.ilmiy_unvon   !== filterUnvon)   return false;
      if (filterIshTuri && r.ish_turi      !== filterIshTuri) return false;
      if (filterHolati  && r.faoliyat_holati !== filterHolati) return false;
      return true;
    });
  }, [rows, search, isStaffManager, user?.department_id, filterFaculty, filterDept, filterDaraja, filterUnvon, filterIshTuri, filterHolati]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  // -------------------------------------------------------------------------
  async function remove(row: TeacherRow) {
    if (!confirm(`"${row.last_name} ${row.first_name}" o'qituvchisini o'chirishni tasdiqlaysizmi?`)) return;
    const { error: dbErr } = await supabase.from("teachers").delete().eq("id", row.id);
    if (dbErr) { alert(dbErr.message); return; }
    if (user?.university_id) cacheInvalidate(user.university_id);
    // Invalidate module cache then reload
    _cachedRows = null;
    load(true);
  }

  function openWorkPlan(teacherId: string) {
    router.push(`/curriculum/personal-plans/${teacherId}`);
  }

  // -------------------------------------------------------------------------
  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setBulkUploading(true);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/teachers/bulk", { method: "POST", body: fd });
    setBulkUploading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? `HTTP ${res.status}`);
      return;
    }

    setBulkResults(data.results ?? []);
    setBulkSummary({ succeeded: data.succeeded ?? 0, updated: data.updated ?? 0, failed: data.failed ?? 0 });
    setBulkResultOpen(true);
    // Invalidate module cache then reload
    _cachedRows = null;
    load(true);
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
            {loading
              ? "Yuklanmoqda…"
              : `Jami: ${filtered.length} ta o'qituvchi${filtered.length !== rows.length ? ` (filtr: ${rows.length} tadan)` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            Excel / CSV
          </Button>
          {canImport && (
            <>
              <a href="/api/teachers/bulk" download>
                <Button variant="outline" size="sm">Shablon</Button>
              </a>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleBulkUpload}
              />
              <Button
                variant="outline"
                size="sm"
                isLoading={bulkUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                Excel import
              </Button>
            </>
          )}
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
              onChange={(e) => { setFilterFaculty(e.target.value); setFilterDept(""); }}
              className={selCls}
            >
              <option value="">Barcha fakultetlar</option>
              {faculties.map((f) => (
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
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-surface-500">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {paginated.map((r, idx) => (
                <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-surface-400">{(page - 1) * pageSize + idx + 1}</td>
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
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openWorkPlan(r.id)}
                      >
                        Ish reja
                      </Button>
                      {canEdit && (
                        <>
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
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Left: page size + info */}
          <div className="flex items-center gap-3 text-sm text-surface-500 dark:text-surface-400">
            <span>Sahifada:</span>
            <div className="flex rounded-lg border border-surface-300 dark:border-surface-600 overflow-hidden">
              {([50, 100] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setPageSize(size)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    pageSize === size
                      ? "bg-primary-600 text-white"
                      : "bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length} ta
            </span>
          </div>

          {/* Right: page navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="rounded-lg px-2 py-1.5 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Birinchi sahifa"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg px-2 py-1.5 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Oldingi sahifa"
            >
              ‹
            </button>

            {/* Page number pills */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-surface-400">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                      page === item
                        ? "bg-primary-600 text-white"
                        : "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg px-2 py-1.5 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Keyingi sahifa"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="rounded-lg px-2 py-1.5 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Oxirgi sahifa"
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* Bulk import results modal */}
      <Modal isOpen={bulkResultOpen} onClose={() => setBulkResultOpen(false)} title="Excel import natijalari">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              ✓ {bulkSummary.succeeded} ta qo&apos;shildi
            </span>
            {bulkSummary.updated > 0 && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                ↻ {bulkSummary.updated} ta yangilandi
              </span>
            )}
            {bulkSummary.failed > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                ✗ {bulkSummary.failed} ta xato
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-surface-600">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-surface-600">F.I.Sh</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-surface-600">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                {bulkResults.map((r) => (
                  <tr
                    key={r.row}
                    className={r.status === "error" ? "bg-red-50 dark:bg-red-900/10" : ""}
                  >
                    <td className="px-3 py-2 text-surface-500">{r.row}</td>
                    <td className="px-3 py-2">{r.name || "—"}</td>
                    <td className="px-3 py-2">
                      {r.status === "success" && (
                        <span className="text-green-600 dark:text-green-400">✓ Qo&apos;shildi</span>
                      )}
                      {r.status === "updated" && (
                        <span className="text-blue-600 dark:text-blue-400">↻ Yangilandi</span>
                      )}
                      {r.status === "error" && (
                        <span className="text-red-600 dark:text-red-400">✗ {r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setBulkResultOpen(false)}>Yopish</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
