"use client";

import { useEffect, useState } from "react";

interface Props {
  deadlineAt: string; // ISO timestamptz
  label?: string;     // e.g. "2025 Q3 hisoboti uchun muddat"
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  passed: boolean;
}

function calcTimeLeft(deadlineAt: string): TimeLeft {
  const diff = new Date(deadlineAt).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
  const totalSec = Math.floor(diff / 1000);
  const days    = Math.floor(totalSec / 86400);
  const hours   = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, passed: false };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function DeadlineCountdown({ deadlineAt, label }: Props) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(deadlineAt));

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(calcTimeLeft(deadlineAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [deadlineAt]);

  if (!mounted) return null;

  if (timeLeft.passed) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger-300 dark:border-danger-700 bg-danger-50 dark:bg-danger-900/30 px-4 py-3 text-sm">
        <svg className="w-5 h-5 text-danger-600 dark:text-danger-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div>
          {label && <span className="font-medium text-danger-800 dark:text-danger-300">{label}: </span>}
          <span className="text-danger-700 dark:text-danger-300 font-semibold">Muddat tugagan</span>
          <span className="text-danger-600 dark:text-danger-400 ml-1">— hisobot yuborish va fayl yuklash yopiq.</span>
        </div>
      </div>
    );
  }

  // Color based on remaining time
  const isUrgent  = timeLeft.days === 0;                        // < 24 hours
  const isWarning = timeLeft.days > 0 && timeLeft.days <= 3;   // 1–3 days
  // else: safe (green)

  const colorCls = isUrgent
    ? "border-danger-300 dark:border-danger-700 bg-danger-50 dark:bg-danger-900/20 text-danger-800 dark:text-danger-300"
    : isWarning
    ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
    : "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300";

  const iconColor = isUrgent
    ? "text-danger-600 dark:text-danger-400"
    : isWarning
    ? "text-amber-600 dark:text-amber-400"
    : "text-green-600 dark:text-green-400";

  // Format countdown string
  let countdownStr: string;
  if (timeLeft.days > 0) {
    countdownStr = `${timeLeft.days} kun ${pad(timeLeft.hours)} soat qoldi`;
  } else {
    countdownStr = `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)} qoldi`;
  }

  return (
    <div className={`flex items-start gap-3 rounded-lg border ${colorCls} px-4 py-3 text-sm`}>
      <svg className={`w-5 h-5 ${iconColor} shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
        {label && <span className="font-medium">{label}:</span>}
        <span className="font-semibold tabular-nums">{countdownStr}</span>
        <span className="opacity-70">
          ({new Date(deadlineAt).toLocaleString("uz-UZ", {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
          })})
        </span>
      </div>
    </div>
  );
}
