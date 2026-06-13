"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signOut, authUser, user, loading, profileLoading } = useSupabaseAuth();

  const destinationFor = (role?: string) => {
    if (role === "super_admin") return "/universities";
    if (role === "staff_manager") return "/form";
    if (role === "university_admin") return "/users";
    if (role === "science_department") return "/targets";
    if (role === "vice_rector" || role === "dean") return "/targets";
    if (role === "supervisor") return "/doktorantura/mening-talabalarim";
    if (role === "doktorant") return "/doktorantura/mening-profilim";
    return "/overview";
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || profileLoading) return;
    if (authUser && user) {
      router.push(destinationFor(user.role));
    } else if (authUser && !user) {
      signOut();
      setError("Profilingiz topilmadi. Qaytadan kiring.");
    }
  }, [authUser, user, loading, profileLoading, router, signOut]);

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
  };

  if (loading || profileLoading || (authUser && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--outline-variant)", borderTopColor: "#002046" }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--surface)" }}
    >
      <div className="w-full max-w-md">
        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "var(--surface-container-lowest)",
            boxShadow: "0 12px 40px rgba(0,32,70,0.08)",
          }}
        >
          <h2
            className="font-display font-semibold text-center mb-6"
            style={{ fontSize: "1.0625rem", color: "var(--on-surface)", letterSpacing: "-0.01em" }}
          >
            Tizimga kirish
          </h2>

          {/* Error banner */}
          {error && (
            <div
              className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "#ffdad6" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" strokeWidth={2} className="shrink-0 mt-0.5">
                <path d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium" style={{ color: "#410002" }}>{error}</p>
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
              placeholder="sizning@email.uz"
            />

            {/* Password with show/hide */}
            <div className="w-full">
              <label
                className="block mb-1.5 font-medium"
                style={{ fontSize: "0.8125rem", color: "var(--on-surface-variant)", fontFamily: "'Public Sans', sans-serif" }}
              >
                Parol
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-lg outline-none pr-10 transition-all"
                  style={{
                    background: "var(--surface-container-highest)",
                    border: "none",
                    padding: "0.625rem 0.875rem",
                    fontSize: "0.875rem",
                    color: "var(--on-surface)",
                    fontFamily: "'Public Sans', sans-serif",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.boxShadow = "0 0 0 2px rgba(0,32,70,0.2), 0 0 0 4px rgba(0,32,70,0.06)";
                    (e.target as HTMLInputElement).style.background = "var(--surface-container-high)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.boxShadow = "none";
                    (e.target as HTMLInputElement).style.background = "var(--surface-container-highest)";
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity"
                  style={{ color: "var(--outline)", opacity: 0.7 }}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                className="w-full"
                variant="primary"
                size="md"
                isLoading={submitting}
              >
                {submitting ? "Tekshirilmoqda..." : "Tizimga kirish"}
              </Button>
            </div>
          </form>
        </div>

        <p className="text-center mt-5 text-xs" style={{ color: "var(--on-surface-variant)", opacity: 0.55 }}>
          Kirish muammolari bo&apos;lsa, administratoriga murojaat qiling.
        </p>

        <div className="mt-4 text-center">
          <Link
            href="/himoya-arizasi"
            className="text-sm font-medium"
            style={{ color: "var(--primary)" }}
          >
            Himoya uchun ariza topshirish
          </Link>
        </div>
      </div>
    </div>
  );
}
