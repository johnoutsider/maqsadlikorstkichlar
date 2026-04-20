"use client";

import React, { useState, useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = "info", duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for transition to finish
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-400 border-success-200 dark:border-success-800",
    error: "bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-400 border-danger-200 dark:border-danger-800",
    info: "bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-400 border-primary-200 dark:border-primary-800",
  };

  const icons = {
    success: (
      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <div 
        className={`flex items-center px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 ${styles[type]} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        {icons[type]}
        <span className="font-medium text-sm">{message}</span>
        <button className="ml-4 opacity-70 hover:opacity-100" onClick={() => setIsVisible(false)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
