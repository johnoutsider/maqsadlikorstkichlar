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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-surface-900/50 dark:bg-surface-900/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal panel */}
      <div className={`relative bg-white dark:bg-surface-800 rounded-lg shadow-xl w-full flex flex-col animate-in fade-in zoom-in-95 duration-200 ${
        size === "full" ? "max-w-[95vw] h-[95vh] max-h-[95vh]" :
        size === "xl" ? "max-w-4xl max-h-[90vh]" :
        size === "lg" ? "max-w-2xl max-h-[90vh]" :
        size === "sm" ? "max-w-sm max-h-[90vh]" :
        "max-w-md max-h-[90vh]"
      }`}>
        <div className="px-6 py-4 flex items-center justify-between border-b dark:border-surface-700">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">{title}</h3>
          <button 
            onClick={onClose}
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className={`px-6 py-4 flex flex-col ${size === "full" ? "flex-1 min-h-0 overflow-y-hidden" : "overflow-y-auto"}`}>
          {children}
        </div>
      </div>
    </div>
  );
};
