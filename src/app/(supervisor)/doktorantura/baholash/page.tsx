"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

export default function BaholashPage() {
  const [doktorantlar, setDoktorantlar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [formData, setFormData] = useState({
    doktorant_id: "",
    period_start: "",
    period_end: "",
    overall_rating: "5",
    research_progress: "",
    strengths: "",
    areas_to_improve: "",
    recommendation: "davom_etsin",
    comments: "",
  });

  useEffect(() => {
    async function fetchDocs() {
      if (!user) return;

      const { data: sup } = await supabase
        .from("supervisors")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!sup) return;

      const { data } = await supabase
        .from("doktorantlar")
        .select("id, full_name, student_id")
        .eq("supervisor_id", sup.id);
      
      if (data) setDoktorantlar(data);
      setLoading(false);
    }
    fetchDocs();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    if (!user) {
      setError("Not authenticated");
      setSubmitting(false);
      return;
    }

    const { data: sup } = await supabase
      .from("supervisors")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!sup) {
      setError("Not a supervisor");
      setSubmitting(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from("evaluations")
      .insert({
        supervisor_id: sup.id,
        doktorant_id: formData.doktorant_id,
        period_start: formData.period_start,
        period_end: formData.period_end,
        overall_rating: parseInt(formData.overall_rating, 10),
        research_progress: formData.research_progress,
        strengths: formData.strengths || null,
        areas_to_improve: formData.areas_to_improve || null,
        recommendation: formData.recommendation,
        comments: formData.comments || null
      });

    if (insertErr) {
      setError(insertErr.message);
    } else {
      router.push("/doktorantura/mening-talabalarim");
    }
    setSubmitting(false);
  };

  if (loading) return <div className="p-10 text-center">Yuklanmoqda...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display text-(--on-surface)">Baholash kiritish</h1>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 bg-(--surface-container-lowest) p-6 rounded-2xl border border-(--outline-variant)">
        <div>
          <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Doktorantni tanlang</label>
          <select 
            className="w-full bg-(--surface) border border-(--outline) rounded-lg p-2 outline-none"
            value={formData.doktorant_id}
            onChange={e => setFormData({...formData, doktorant_id: e.target.value})}
            required
          >
            <option value="">-- Tanlang --</option>
            {doktorantlar.map(d => (
              <option key={d.id} value={d.id}>{d.full_name} ({d.student_id})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Davr boshi" type="date" required 
            value={formData.period_start} onChange={e => setFormData({...formData, period_start: e.target.value})} 
          />
          <Input 
            label="Davr oxiri" type="date" required 
            value={formData.period_end} onChange={e => setFormData({...formData, period_end: e.target.value})} 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Umumiy baho (1-5)</label>
            <select 
              className="w-full bg-(--surface) border border-(--outline) rounded-lg p-2 outline-none"
              value={formData.overall_rating}
              onChange={e => setFormData({...formData, overall_rating: e.target.value})}
            >
              {[1, 2, 3, 4, 5].map(v => (
                <option key={v} value={v}>{v} yulduz</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Xulosa tavsiyasi</label>
            <select 
              className="w-full bg-(--surface) border border-(--outline) rounded-lg p-2 outline-none"
              value={formData.recommendation}
              onChange={e => setFormData({...formData, recommendation: e.target.value})}
            >
              <option value="davom_etsin">Davom etsin</option>
              <option value="qayta_korib_chiqsin">Qayta ko'rib chiqsin</option>
              <option value="muddatni_uzaytirsin">Muddatni uzaytirsin</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Tadqiqotdagi siljish (Batafsil)</label>
          <textarea
            required
            className="w-full bg-(--surface) border border-(--outline) rounded-lg p-3 outline-none min-h-[100px]"
            value={formData.research_progress}
            onChange={e => setFormData({...formData, research_progress: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Kuchli jihatlari</label>
            <textarea
              className="w-full bg-(--surface) border border-(--outline) rounded-lg p-3 outline-none min-h-[80px]"
              value={formData.strengths}
              onChange={e => setFormData({...formData, strengths: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Yaxshilash kerak bo'lgan tomonlari</label>
            <textarea
              className="w-full bg-(--surface) border border-(--outline) rounded-lg p-3 outline-none min-h-[80px]"
              value={formData.areas_to_improve}
              onChange={e => setFormData({...formData, areas_to_improve: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Qo'shimcha izohlar</label>
          <textarea
            className="w-full bg-(--surface) border border-(--outline) rounded-lg p-3 outline-none h-16"
            value={formData.comments}
            onChange={e => setFormData({...formData, comments: e.target.value})}
          />
        </div>

        <div className="pt-4 flex justify-end">
          <Button type="submit" variant="primary" isLoading={submitting}>Bahoni Saqlash</Button>
        </div>
      </form>
    </div>
  );
}
