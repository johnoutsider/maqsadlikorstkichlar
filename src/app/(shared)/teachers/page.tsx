"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type {
  Teacher,
  IlmiyDaraja,
  IlmiyUnvon,
  Stavka,
  IshTuri,
  FaoliyatHolati,
  Faculty,
  Department,
} from "@/types/db";

// ---------------------------------------------------------------------------
// Lookup labels
// ---------------------------------------------------------------------------

const ILMIY_DARAJA_LABEL: Record<IlmiyDaraja, string> = {
  fan_doktori:  "Fan doktori",
  fan_nomzodi:  "Fan nomzodi",
  phd:          "PhD",
  yoq:          "Yo'q",
};

const ILMIY_UNVON_LABEL: Record<IlmiyUnvon, string> = {
  professor:        "Professor",
  dotsent:          "Dotsent",
  katta_oqituvchi:  "Katta o'qituvchi",
  oqituvchi:        "O'qituvchi",
  assistent:        "Assistent",
};

const STAVKA_OPTIONS: Stavka[] = ["0.25", "0.5", "0.75", "1.0", "1.25", "1.5"];

const ISH_TURI_LABEL: Record<IshTuri, string> = {
  asosiy:   "Asosiy",
  orindosh: "O'rindosh",
};

const FAOLIYAT_LABEL: Record<FaoliyatHolati, string> = {
  faol:           "Faol",
  ishdan_ketgan:  "Ishdan ketgan",
  tatilda:        "Ta'tilda",
};

const FAOLIYAT_COLOR: Record<FaoliyatHolati, string> = {
  faol:           "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  ishdan_ketgan:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  tatilda:        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeacherRow extends Teacher {
  faculty_name: string;
  department_name: string;
}

interface FormState {
  last_name: string;
  first_name: string;
  middle_name: string;
  birth_date: string;
  gender: string;
  phone: string;
  email: string;
  passport_pinfl: string;
  ilmiy_daraja: string;
  ilmiy_unvon: string;
  lavozim: string;
  stavka: string;
  ish_turi: string;
  ishga_kirgan_sana: string;
  faoliyat_holati: string;
  faculty_id: string;
  department_id: string;
}

const EMPTY_FORM: FormState = {
  last_name: "", first_name: "", middle_name: "",
  birth_date: "", gender: "",
  phone: "", email: "", passport_pinfl: "",
  ilmiy_daraja: "", ilmiy_unvon: "", lavozim: "",
  stavka: "", ish_turi: "",
  ishga_kirgan_sana: "", faoliyat_holati: "faol",
  faculty_id: "", department_id: "",
};

// ---------------------------------------------------------------------------
// Select helper
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-surface-700 dark:text-surface-300">
        {label}
      </label>
      {children}
    </div>
  );
}

function Sel({
  value, onChange, required, children,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm
                 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
    >
      {children}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeachersPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const canEdit = user?.role === "staff_manager";

  // Data
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterDaraja, setFilterDaraja] = useState("");
  const [filterUnvon, setFilterUnvon] = useState("");
  const [filterIshTuri, setFilterIshTuri] = useState("");
  const [filterHolati, setFilterHolati] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeacherRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    const [tf, td] = await Promise.all([
      supabase.from("faculties").select("*").order("name"),
      supabase.from("departments").select("*").order("name"),
    ]);

    setFaculties((tf.data as Faculty[]) ?? []);
    setDepartments((td.data as Department[]) ?? []);

    const facMap = new Map<string, string>(
      ((tf.data as Faculty[]) ?? []).map((f) => [f.id, f.name])
    );
    const deptMap = new Map<string, string>(
      ((td.data as Department[]) ?? []).map((d) => [d.id, d.name])
    );

    const { data, error: dbErr } = await supabase
      .from("teachers")
      .select("*")
      .order("last_name");

    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }

    setRows(
      ((data as Teacher[]) ?? []).map((t) => ({
        ...t,
        faculty_name:    facMap.get(t.faculty_id)    ?? "",
        department_name: deptMap.get(t.department_id) ?? "",
      }))
    );
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => { load(); }, [load]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const deptsByFaculty = useMemo(
    () => departments.filter((d) => !filterFaculty || d.faculty_id === filterFaculty),
    [departments, filterFaculty]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      const fullName = `${r.last_name} ${r.first_name} ${r.middle_name ?? ""}`.toLowerCase();
      if (q && !fullName.includes(q)) return false;
      if (filterFaculty && r.faculty_id    !== filterFaculty) return false;
      if (filterDept    && r.department_id !== filterDept)    return false;
      if (filterDaraja  && r.ilmiy_daraja  !== filterDaraja)  return false;
      if (filterUnvon   && r.ilmiy_unvon   !== filterUnvon)   return false;
      if (filterIshTuri && r.ish_turi      !== filterIshTuri) return false;
      if (filterHolati  && r.faoliyat_holati !== filterHolati) return false;
      return true;
    });
  }, [rows, search, filterFaculty, filterDept, filterDaraja, filterUnvon, filterIshTuri, filterHolati]);

  // Departments visible to the form (scoped by selected faculty)
  const formDepts = useMemo(
    () => departments.filter((d) => d.faculty_id === form.faculty_id),
    [departments, form.faculty_id]
  );

  // staff_manager's own dept/faculty (prefill and lock)
  const myDept = useMemo(
    () => departments.find((d) => d.id === user?.department_id) ?? null,
    [departments, user?.department_id]
  );
  const myFaculty = useMemo(
    () => myDept ? faculties.find((f) => f.id === myDept.faculty_id) ?? null : null,
    [faculties, myDept]
  );

  // ---------------------------------------------------------------------------
  // Modal helpers
  // ---------------------------------------------------------------------------
  function openCreate() {
    setEditTarget(null);
    setForm({
      ...EMPTY_FORM,
      faculty_id:    myFaculty?.id ?? "",
      department_id: myDept?.id    ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(row: TeacherRow) {
    setEditTarget(row);
    setForm({
      last_name:         row.last_name,
      first_name:        row.first_name,
      middle_name:       row.middle_name       ?? "",
      birth_date:        row.birth_date        ?? "",
      gender:            row.gender            ?? "",
      phone:             row.phone             ?? "",
      email:             row.email             ?? "",
      passport_pinfl:    row.passport_pinfl    ?? "",
      ilmiy_daraja:      row.ilmiy_daraja      ?? "",
      ilmiy_unvon:       row.ilmiy_unvon       ?? "",
      lavozim:           row.lavozim           ?? "",
      stavka:            row.stavka            ?? "",
      ish_turi:          row.ish_turi          ?? "",
      ishga_kirgan_sana: row.ishga_kirgan_sana ?? "",
      faoliyat_holati:   row.faoliyat_holati,
      faculty_id:        row.faculty_id,
      department_id:     row.department_id,
    });
    setFormError("");
    setModalOpen(true);
  }

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!form.last_name.trim() || !form.first_name.trim()) {
      setFormError("Familiya va ism majburiy.");
      return;
    }
    if (!form.department_id) {
      setFormError("Kafedra tanlanishi shart.");
      return;
    }

    const payload = {
      university_id:     user?.university_id,
      faculty_id:        form.faculty_id        || null,
      department_id:     form.department_id     || null,
      last_name:         form.last_name.trim(),
      first_name:        form.first_name.trim(),
      middle_name:       form.middle_name.trim()       || null,
      birth_date:        form.birth_date                || null,
      gender:            form.gender                    || null,
      phone:             form.phone.trim()              || null,
      email:             form.email.trim()              || null,
      passport_pinfl:    form.passport_pinfl.trim()     || null,
      ilmiy_daraja:      form.ilmiy_daraja              || null,
      ilmiy_unvon:       form.ilmiy_unvon               || null,
      lavozim:           form.lavozim.trim()             || null,
      stavka:            form.stavka                    || null,
      ish_turi:          form.ish_turi                  || null,
      ishga_kirgan_sana: form.ishga_kirgan_sana          || null,
      faoliyat_holati:   form.faoliyat_holati || "faol",
    };

    setSaving(true);
    let dbErr;
    if (editTarget) {
      ({ error: dbErr } = await supabase
        .from("teachers")
        .update(payload)
        .eq("id", editTarget.id));
    } else {
      ({ error: dbErr } = await supabase
        .from("teachers")
        .insert({ ...payload, created_by: user?.id }));
    }
    setSaving(false);

    if (dbErr) { setFormError(dbErr.message); return; }
    setModalOpen(false);
    load();
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async function remove(row: TeacherRow) {
    if (!confirm(`"${row.last_name} ${row.first_name}" o'qituvchisini o'chirishni tasdiqlaysizmi?`)) return;
    const { error: dbErr } = await supabase.from("teachers").delete().eq("id", row.id);
    if (dbErr) { alert(dbErr.message); return; }
    load();
  }

  // ---------------------------------------------------------------------------
  // Export CSV
  // ---------------------------------------------------------------------------
  function exportCsv() {
    const headers = [
      "Familiya", "Ism", "Otasining ismi",
      "Fakultet", "Kafedra",
      "Lavozim", "Ilmiy daraja", "Ilmiy unvon",
      "Stavka", "Ish turi",
      "Ishga kirgan sana", "Tug'ilgan sana", "Jinsi",
      "Telefon", "Email", "Passport/PINFL",
      "Faoliyat holati",
    ];

    const escape = (v: string | null | undefined) => {
      const s = v ?? "";
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const body = filtered.map((r) => [
      escape(r.last_name),
      escape(r.first_name),
      escape(r.middle_name),
      escape(r.faculty_name),
      escape(r.department_name),
      escape(r.lavozim),
      r.ilmiy_daraja  ? escape(ILMIY_DARAJA_LABEL[r.ilmiy_daraja])  : "",
      r.ilmiy_unvon   ? escape(ILMIY_UNVON_LABEL[r.ilmiy_unvon])    : "",
      escape(r.stavka),
      r.ish_turi ? escape(ISH_TURI_LABEL[r.ish_turi]) : "",
      escape(r.ishga_kirgan_sana),
      escape(r.birth_date),
      r.gender === "erkak" ? "Erkak" : r.gender === "ayol" ? "Ayol" : "",
      escape(r.phone),
      escape(r.email),
      escape(r.passport_pinfl),
      escape(FAOLIYAT_LABEL[r.faoliyat_holati]),
    ].join(","));

    const csv = "﻿" + [headers.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "oqituvchilar.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const filterSelClass =
    "rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            O&apos;qituvchilar ro&apos;yxati
          </h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            {loading ? "Yuklanmoqda..." : `Jami: ${filtered.length} ta o'qituvchi`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            Excel / CSV
          </Button>
          {canEdit && (
            <Button onClick={openCreate}>+ O&apos;qituvchi qo&apos;shish</Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-600 dark:bg-danger-900/30 dark:text-danger-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Ism bo'yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />

        {/* Faculty filter — hidden for staff_manager since they see only their dept */}
        {!canEdit && (
          <select
            value={filterFaculty}
            onChange={(e) => { setFilterFaculty(e.target.value); setFilterDept(""); }}
            className={filterSelClass}
          >
            <option value="">Barcha fakultetlar</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}

        {/* Department filter */}
        {!canEdit && (
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className={filterSelClass}
          >
            <option value="">Barcha kafedralar</option>
            {deptsByFaculty.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        <select value={filterDaraja} onChange={(e) => setFilterDaraja(e.target.value)} className={filterSelClass}>
          <option value="">Barcha darajalar</option>
          {(Object.entries(ILMIY_DARAJA_LABEL) as [IlmiyDaraja, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={filterUnvon} onChange={(e) => setFilterUnvon(e.target.value)} className={filterSelClass}>
          <option value="">Barcha unvonlar</option>
          {(Object.entries(ILMIY_UNVON_LABEL) as [IlmiyUnvon, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={filterIshTuri} onChange={(e) => setFilterIshTuri(e.target.value)} className={filterSelClass}>
          <option value="">Asosiy / O'rindosh</option>
          {(Object.entries(ISH_TURI_LABEL) as [IshTuri, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={filterHolati} onChange={(e) => setFilterHolati(e.target.value)} className={filterSelClass}>
          <option value="">Barcha holatlar</option>
          {(Object.entries(FAOLIYAT_LABEL) as [FaoliyatHolati, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800">
        {loading ? (
          <div className="p-10 text-center text-surface-400">Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-surface-400">
            {rows.length === 0
              ? "Hali o'qituvchi qo'shilmagan."
              : "Qidiruv natijasi topilmadi."}
          </div>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-500">F.I.O</th>
                {!canEdit && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-500">Kafedra</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-500">Lavozim</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-500">Ilmiy daraja</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-500">Ilmiy unvon</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-500">Stavka</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-500">Ish turi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-500">Holat</th>
                {canEdit && (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-500">Amallar</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {filtered.map((r, idx) => (
                <tr
                  key={r.id}
                  className="hover:bg-surface-50 dark:hover:bg-surface-900/30 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-surface-400">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {r.last_name} {r.first_name} {r.middle_name ?? ""}
                    </p>
                    {r.phone && (
                      <p className="text-xs text-surface-400 mt-0.5">{r.phone}</p>
                    )}
                  </td>
                  {!canEdit && (
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">
                      <span className="block">{r.department_name}</span>
                      <span className="text-xs text-surface-400">{r.faculty_name}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">
                    {r.lavozim ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">
                    {r.ilmiy_daraja ? ILMIY_DARAJA_LABEL[r.ilmiy_daraja] : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">
                    {r.ilmiy_unvon ? ILMIY_UNVON_LABEL[r.ilmiy_unvon] : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">
                    {r.stavka ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">
                    {r.ish_turi ? ISH_TURI_LABEL[r.ish_turi] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${FAOLIYAT_COLOR[r.faoliyat_holati]}`}>
                      {FAOLIYAT_LABEL[r.faoliyat_holati]}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
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

      {/* Add / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi qo'shish"}
      >
        <form onSubmit={save} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {formError && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600 dark:bg-danger-900/30 dark:text-danger-400">
              {formError}
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Familiya *"
              value={form.last_name}
              onChange={(e) => setField("last_name", e.target.value)}
              required
              placeholder="Karimov"
            />
            <Input
              label="Ism *"
              value={form.first_name}
              onChange={(e) => setField("first_name", e.target.value)}
              required
              placeholder="Alisher"
            />
            <Input
              label="Otasining ismi"
              value={form.middle_name}
              onChange={(e) => setField("middle_name", e.target.value)}
              placeholder="Bahodirovich"
            />
          </div>

          {/* Personal */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tug'ilgan sana"
              type="date"
              value={form.birth_date}
              onChange={(e) => setField("birth_date", e.target.value)}
            />
            <Field label="Jinsi">
              <Sel value={form.gender} onChange={(v) => setField("gender", v)}>
                <option value="">— tanlang —</option>
                <option value="erkak">Erkak</option>
                <option value="ayol">Ayol</option>
              </Sel>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Telefon raqami"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+998 90 123 45 67"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="email@university.uz"
            />
          </div>

          <Input
            label="Passport seriyasi / PINFL"
            value={form.passport_pinfl}
            onChange={(e) => setField("passport_pinfl", e.target.value)}
            placeholder="AA1234567 yoki 12345678901234"
          />

          {/* Department — locked for staff_manager */}
          {canEdit ? (
            <div className="rounded-md bg-surface-50 dark:bg-surface-900/40 border border-surface-200 dark:border-surface-700 px-3 py-2 text-sm text-surface-600 dark:text-surface-300">
              <span className="font-medium">Kafedra:</span>{" "}
              {myDept?.name ?? "—"}&nbsp;/&nbsp;{myFaculty?.name ?? "—"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fakultet *">
                <Sel
                  value={form.faculty_id}
                  onChange={(v) => { setField("faculty_id", v); setField("department_id", ""); }}
                  required
                >
                  <option value="">— tanlang —</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Sel>
              </Field>
              <Field label="Kafedra *">
                <Sel value={form.department_id} onChange={(v) => setField("department_id", v)} required>
                  <option value="">— tanlang —</option>
                  {formDepts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Sel>
              </Field>
            </div>
          )}

          {/* Academic */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ilmiy darajasi">
              <Sel value={form.ilmiy_daraja} onChange={(v) => setField("ilmiy_daraja", v)}>
                <option value="">— tanlang —</option>
                {(Object.entries(ILMIY_DARAJA_LABEL) as [IlmiyDaraja, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Sel>
            </Field>
            <Field label="Ilmiy unvoni">
              <Sel value={form.ilmiy_unvon} onChange={(v) => setField("ilmiy_unvon", v)}>
                <option value="">— tanlang —</option>
                {(Object.entries(ILMIY_UNVON_LABEL) as [IlmiyUnvon, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Sel>
            </Field>
          </div>

          <Field label="Lavozimi">
            <Sel value={form.lavozim} onChange={(v) => setField("lavozim", v)}>
              <option value="">— tanlang —</option>
              <option value="Professor">Professor</option>
              <option value="Dotsent">Dotsent</option>
              <option value="Katta o'qituvchi">Katta o&apos;qituvchi</option>
              <option value="O'qituvchi">O&apos;qituvchi</option>
              <option value="Assistent">Assistent</option>
              <option value="Laborant">Laborant</option>
              <option value="Katta laborant">Katta laborant</option>
              <option value="Kafedra mudiri">Kafedra mudiri</option>
              <option value="Boshqa">Boshqa</option>
            </Sel>
          </Field>

          {/* Employment */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ish stavkasi">
              <Sel value={form.stavka} onChange={(v) => setField("stavka", v)}>
                <option value="">— tanlang —</option>
                {STAVKA_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s} stavka</option>
                ))}
              </Sel>
            </Field>
            <Field label="Asosiy / O'rindosh">
              <Sel value={form.ish_turi} onChange={(v) => setField("ish_turi", v)}>
                <option value="">— tanlang —</option>
                <option value="asosiy">Asosiy</option>
                <option value="orindosh">O&apos;rindosh</option>
              </Sel>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ishga kirgan sanasi"
              type="date"
              value={form.ishga_kirgan_sana}
              onChange={(e) => setField("ishga_kirgan_sana", e.target.value)}
            />
            <Field label="Faoliyat holati">
              <Sel value={form.faoliyat_holati} onChange={(v) => setField("faoliyat_holati", v)}>
                <option value="faol">Faol</option>
                <option value="tatilda">Ta&apos;tilda</option>
                <option value="ishdan_ketgan">Ishdan ketgan</option>
              </Sel>
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" isLoading={saving}>
              {editTarget ? "Saqlash" : "Qo'shish"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
