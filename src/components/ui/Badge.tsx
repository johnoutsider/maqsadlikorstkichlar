import React from "react";
import type { SubmissionStatus } from "@/types";
import { STATUS_LABELS } from "@/lib/constants";

interface BadgeProps {
  status: SubmissionStatus | "neutral" | "info";
  className?: string;
  children?: React.ReactNode;
}

const chipStyles: Record<string, React.CSSProperties> = {
  draft: { background: "var(--surface-container-high)", color: "var(--on-surface-variant)" },
  pending: { background: "#dde4ef", color: "#405060" },
  pending_dean: { background: "#dde4ef", color: "#405060" },
  pending_science: { background: "#d4e3ff", color: "#002046" },
  needs_revision: { background: "#ffdad6", color: "#410002" },
  approved: { background: "#b7eece", color: "#00210f" },
  rejected: { background: "#ffdad6", color: "#410002" },
  neutral: { background: "var(--surface-container-high)", color: "var(--on-surface-variant)" },
  info: { background: "#d4e3ff", color: "#002046" },
};

const chipDots: Record<string, string> = {
  approved: "#1a5c3e",
  pending: "#405060",
  pending_dean: "#405060",
  pending_science: "#002046",
  needs_revision: "#ba1a1a",
  rejected: "#ba1a1a",
  draft: "var(--outline)",
  neutral: "var(--outline)",
  info: "#002046",
};

export const Badge: React.FC<BadgeProps> = ({ status, className = "", children }) => {
  const style = chipStyles[status] ?? chipStyles.neutral;
  const dotColor = chipDots[status] ?? "currentColor";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium ${className}`}
      style={{
        ...style,
        fontSize: "0.6875rem",
        letterSpacing: "0.04em",
        fontFamily: "'Public Sans', sans-serif",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: dotColor }}
      />
      {children || STATUS_LABELS[status as string] || status}
    </span>
  );
};
