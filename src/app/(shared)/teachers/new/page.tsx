"use client";

import React from "react";
import Link from "next/link";
import { TeacherForm } from "../_components/TeacherForm";

export default function NewTeacherPage() {
  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <nav className="mb-2 flex items-center gap-1.5 text-sm text-surface-400">
          <Link href="/teachers" className="hover:text-surface-600 dark:hover:text-surface-300 transition-colors">
            O&apos;qituvchilar ro&apos;yxati
          </Link>
          <span>/</span>
          <span className="text-surface-600 dark:text-surface-300">Yangi o&apos;qituvchi</span>
        </nav>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          Yangi o&apos;qituvchi qo&apos;shish
        </h1>
        <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
          Barcha majburiy maydonlarni to&apos;ldiring va saqlang.
        </p>
      </div>

      <TeacherForm mode="create" />
    </div>
  );
}
