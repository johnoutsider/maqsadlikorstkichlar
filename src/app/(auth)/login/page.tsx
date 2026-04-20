"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signOut, authUser, user, loading } = useSupabaseAuth();

  const destinationFor = (role?: string) => {
    if (role === "super_admin") return "/universities";
    if (role === "staff_manager") return "/form";
    if (role === "university_admin") return "/users";
    if (role === "science_department") return "/targets";
    if (role === "vice_rector" || role === "dean") return "/targets";
    return "/overview";
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (authUser && user) {
      router.push(destinationFor(user.role));
    } else if (authUser && !user) {
      // Stale session whose profile no longer exists — clear it so login form appears.
      signOut();
      setError("Profilingiz topilmadi. Qaytadan kiring.");
    }
  }, [authUser, user, loading, router, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      setError(
        err.toLowerCase().includes("invalid")
          ? "Email yoki parol noto'g'ri."
          : `Xatolik: ${err}`
      );
      return;
    }
    // Context will update asynchronously; the useEffect above handles the redirect
    // once `user` is loaded with its role.
  };

  if (loading || (authUser && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary-600 rounded-full border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-surface-50 to-primary-50/30 dark:from-surface-900 dark:to-surface-800">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl shadow-lg mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Ilmiy Ko'rsatkichlar Tizimi
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">
            Universitet KPI boshqaruv tizimi
          </p>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl border border-surface-200 dark:border-surface-700 p-8">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200 mb-6 text-center">
            Tizimga kirish
          </h2>

          {error && (
            <div className="mb-5 p-3 bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email manzili"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Parol"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full mt-2" isLoading={submitting}>
              Tizimga kirish
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-surface-400 dark:text-surface-600 mt-6">
          Kirish muammolari bo'lsa, administratoriga murojaat qiling.
        </p>
      </div>
    </div>
  );
}
