import React from "react";
import type { SubmissionStatus } from "@/types";
import { STATUS_LABELS } from "@/lib/constants";

interface BadgeProps {
  status: SubmissionStatus | "neutral" | "info";
  className?: string;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = "", children }) => {
  const styles = {
    draft: "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-300",
    pending: "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-500",
    pending_dean: "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-500",
    pending_science: "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400",
    needs_revision: "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-500",
    approved: "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-500",
    rejected: "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-500",
    neutral: "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-300",
    info: "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]} ${className}`}>
      {children || STATUS_LABELS[status as string] || status}
    </span>
  );
};
