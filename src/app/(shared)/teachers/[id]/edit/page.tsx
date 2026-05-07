"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Teacher } from "@/types/db";
import { TeacherForm } from "../../_components/TeacherForm";
import type { TeacherFormState } from "../../_lib/options";

function teacherToForm(t: Teacher): TeacherFormState {
  return {
    last_name:         t.last_name,
    first_name:        t.first_name,
    middle_name:       t.middle_name       ?? "",
    birth_date:        t.birth_date        ?? "",
    gender:            t.gender            ?? "",
    phone:             t.phone             ?? "",
    email:             t.email             ?? "",

    ilmiy_daraja:      t.ilmiy_daraja      ?? "",
    ilmiy_unvon:       t.ilmiy_unvon       ?? "",
    lavozim:           t.lavozim           ?? "",
    stavka:            t.stavka            ?? "",
    ish_turi:          t.ish_turi          ?? "",
    ishga_kirgan_sana: t.ishga_kirgan_sana ?? "",
    faoliyat_holati:   t.faoliyat_holati,
    faculty_id:        t.faculty_id,
    department_id:     t.department_id,
  };
}

export default function EditTeacherPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) { setNotFound(true); }
      else { setTeacher(data as Teacher); }
      setLoading(false);
    })();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-surface-400">
        Yuklanmoqda…
      </div>
    );
  }

  if (notFound || !teacher) {
    return (
      <div className="mx-auto max-w-3xl py-24 text-center">
        <p className="text-surface-500">O&apos;qituvchi topilmadi.</p>
        <Link href="/teachers" className="mt-4 inline-block text-sm text-primary-600 hover:underline">
          ← Ro&apos;yxatga qaytish
        </Link>
      </div>
    );
  }

  const fullName = `${teacher.last_name} ${teacher.first_name}${teacher.middle_name ? ` ${teacher.middle_name}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <nav className="mb-2 flex items-center gap-1.5 text-sm text-surface-400">
          <Link href="/teachers" className="hover:text-surface-600 dark:hover:text-surface-300 transition-colors">
            O&apos;qituvchilar ro&apos;yxati
          </Link>
          <span>/</span>
          <span className="text-surface-600 dark:text-surface-300 truncate max-w-[200px]">{fullName}</span>
          <span>/</span>
          <span className="text-surface-600 dark:text-surface-300">Tahrirlash</span>
        </nav>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          {fullName}
        </h1>
        <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
          Ma&apos;lumotlarni yangilang va saqlang.
        </p>
      </div>

      <TeacherForm
        mode="edit"
        teacherId={teacher.id}
        initialValues={teacherToForm(teacher)}
      />
    </div>
  );
}
