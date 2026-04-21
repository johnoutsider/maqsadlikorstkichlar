"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export default function CreateSupervisorPage() {
  const router = useRouter();
  const supabase = createClient();

  const [faculties, setFaculties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    staff_id: "",
    academic_title: "",
    is_external: false,
    faculty_id: "",
    department_id: "",
    workplace: "",
  });

  useEffect(() => {
    async function loadData() {
      const { data: facs } = await supabase.from("faculties").select("id, name");
      if (facs) setFaculties(facs);

      const { data: deps } = await supabase.from("departments").select("id, name, faculty_id");
      if (deps) setDepartments(deps);
    }
    loadData();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/provision-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create");
      }

      router.push("/doktorantura/supervisors");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDepartments = departments.filter(d => !formData.faculty_id || d.faculty_id === formData.faculty_id);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display text-(--on-surface)">Yangi Ilmiy Rahbar Qo'shish</h1>
        <Button variant="outline" onClick={() => router.back()}>Orqaga</Button>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 bg-(--surface-container-lowest) p-6 rounded-2xl border border-(--outline-variant)">
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="To'liq ism (F.I.Sh)" required 
            value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} 
          />
          <Input 
            label="Email" type="email" required 
            value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} 
          />
          <Input 
            label="Parol (kamida 8 ta belgi)" type="password" required 
            value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} 
          />
          <Input 
            label="Xodim ID (Staff ID)" required 
            value={formData.staff_id} onChange={e => setFormData({...formData, staff_id: e.target.value})} 
          />
          <Input 
            label="Ilmiy daraja (Title)" required placeholder="Professor, Dotsent..."
            value={formData.academic_title} onChange={e => setFormData({...formData, academic_title: e.target.value})} 
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <input 
            type="checkbox" 
            id="is_external"
            className="w-5 h-5 rounded border-(--outline)"
            checked={formData.is_external}
            onChange={e => setFormData({...formData, is_external: e.target.checked})}
          />
          <label htmlFor="is_external" className="font-medium text-(--on-surface)">Tashqi ilmiy rahbar (Boshqa tashkilotdan)</label>
        </div>

        {formData.is_external ? (
          <div className="mt-4">
            <Input 
              label="Ish joyi (Tashkilot nomi)" required={formData.is_external}
              value={formData.workplace} onChange={e => setFormData({...formData, workplace: e.target.value})} 
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Fakultet</label>
              <select 
                className="w-full bg-(--surface) border border-(--outline) rounded-lg p-2 outline-none"
                value={formData.faculty_id}
                onChange={e => setFormData({...formData, faculty_id: e.target.value})}
              >
                <option value="">-- Tanlang --</option>
                {faculties.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Kafedra</label>
              <select 
                className="w-full bg-(--surface) border border-(--outline) rounded-lg p-2 outline-none"
                value={formData.department_id}
                onChange={e => setFormData({...formData, department_id: e.target.value})}
              >
                <option value="">-- Tanlang --</option>
                {filteredDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="pt-4 flex justify-end">
          <Button type="submit" variant="primary" isLoading={submitting}>Saqlash</Button>
        </div>
      </form>
    </div>
  );
}
