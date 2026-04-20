import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, hint, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block mb-1.5 font-medium"
            style={{ fontSize: "0.8125rem", color: "var(--on-surface-variant)", fontFamily: "'Public Sans', sans-serif" }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg transition-all outline-none placeholder:opacity-50 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          style={{
            background: error ? "rgba(255,218,214,0.3)" : "var(--surface-container-highest)",
            border: "none",
            padding: "0.625rem 0.875rem",
            fontSize: "0.875rem",
            color: "var(--on-surface)",
            fontFamily: "'Public Sans', sans-serif",
            boxShadow: error
              ? "0 0 0 2px #ba1a1a"
              : "none",
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.boxShadow = error
              ? "0 0 0 2px #ba1a1a, 0 0 0 4px rgba(186,26,26,0.15)"
              : "0 0 0 2px rgba(0,32,70,0.2), 0 0 0 4px rgba(0,32,70,0.06)";
            (e.target as HTMLInputElement).style.background = "var(--surface-container-high)";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.boxShadow = error ? "0 0 0 2px #ba1a1a" : "none";
            (e.target as HTMLInputElement).style.background = error ? "rgba(255,218,214,0.3)" : "var(--surface-container-highest)";
          }}
          {...props}
        />
        {error && (
          <p className="mt-1.5 flex items-center gap-1 text-xs" style={{ color: "#ba1a1a" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--on-surface-variant)", opacity: 0.7 }}>{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
