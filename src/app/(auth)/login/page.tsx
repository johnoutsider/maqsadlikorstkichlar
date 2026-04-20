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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (authUser && user) {
      router.push(destinationFor(user.role));
    } else if (authUser && !user) {
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
  };

  if (loading || (authUser && user)) {
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
      className="min-h-screen flex"
      style={{ background: "var(--surface)" }}
    >
      {/* Left editorial panel */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between p-10 xl:p-14 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #002046 0%, #0d2040 60%, #1a3a60 100%)" }}
      >
        {/* Background texture dots */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Decorative orbs */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #4a8adc 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #89d8a8 0%, transparent 70%)" }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M9 21V7l4-4 4 4v14M9 12h6" />
            </svg>
          </div>
          <div>
            <p className="text-white font-display font-semibold text-sm">Ilmiy Ko&apos;rsatkichlar</p>
            <p className="text-white/40 font-medium uppercase" style={{ fontSize: "0.6rem", letterSpacing: "0.1em" }}>
              KPI Boshqaruv Tizimi
            </p>
          </div>
        </div>

        {/* Editorial headline */}
        <div className="relative z-10">
          <h1
            className="font-display font-bold text-white mb-5"
            style={{ fontSize: "2.5rem", lineHeight: "1.1", letterSpacing: "-0.03em" }}
          >
            Academic<br />
            <span style={{ color: "#89d8a8" }}>Architect</span>
          </h1>
          <p className="text-white/55 text-sm leading-relaxed max-w-xs">
            O&apos;zbekiston Jahon Tillari Universitetining ilmiy-tadqiqot faoliyatini boshqarish va monitoring qilish tizimi.
          </p>

          {/* Feature list */}
          <div className="mt-8 space-y-3">
            {[
              "Ko'rsatkichlar va KPI maqsadlari",
              "Kafedra hisobotlari va tasdiqlash",
              "Ilmiy faoliyat monitoringi",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(137,216,168,0.15)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#89d8a8" strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-white/60 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer text */}
        <p className="relative z-10 text-white/25 text-xs">
          © 2025 O&apos;zbekiston Jahon Tillari Universiteti
        </p>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #002046 0%, #1b365d 100%)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M9 21V7l4-4 4 4v14M9 12h6" />
              </svg>
            </div>
            <div>
              <p className="font-display font-semibold text-sm" style={{ color: "var(--on-surface)" }}>Ilmiy Ko&apos;rsatkichlar</p>
              <p className="font-medium uppercase" style={{ fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--on-surface-variant)" }}>
                KPI Tizimi
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2
              className="font-display font-bold mb-2"
              style={{ fontSize: "1.75rem", letterSpacing: "-0.02em", color: "var(--on-surface)" }}
            >
              Xush kelibsiz
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--on-surface-variant)" }}>
              Tizimga kirish uchun hisobingizni tasdiqlang
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div
              className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "#ffdad6", border: "none" }}
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

            {/* Password with show/hide toggle */}
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
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
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

          <p className="text-center mt-6 text-xs" style={{ color: "var(--on-surface-variant)", opacity: 0.6 }}>
            Kirish muammolari bo&apos;lsa, administratoriga murojaat qiling.
          </p>
        </div>
      </div>
    </div>
  );
}
