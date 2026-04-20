"use client";

import React, { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = "md" }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeMap: Record<string, string> = {
    full: "max-w-[95vw] h-[95vh] max-h-[95vh]",
    xl: "max-w-4xl max-h-[90vh]",
    lg: "max-w-2xl max-h-[90vh]",
    md: "max-w-lg max-h-[90vh]",
    sm: "max-w-sm max-h-[90vh]",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full flex flex-col animate-slide-up ${sizeMap[size]}`}
        style={{
          background: "var(--surface-container-lowest)",
          borderRadius: "1.25rem",
          boxShadow: "0 24px 80px rgba(0,32,70,0.16), 0 0 0 1px var(--outline-variant)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--outline-variant)" }}
        >
          <h3
            className="font-display font-semibold"
            style={{ fontSize: "1.0625rem", color: "var(--on-surface)", letterSpacing: "-0.01em" }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--on-surface-variant)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--surface-container-high)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          className={`px-6 py-5 flex flex-col ${size === "full" ? "flex-1 min-h-0 overflow-y-auto" : "overflow-y-auto"}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
