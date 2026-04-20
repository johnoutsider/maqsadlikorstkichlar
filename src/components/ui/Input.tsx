import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-md border bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus-ring placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? "border-danger-500 focus:ring-danger-500/50" : "border-surface-300 dark:border-surface-600"
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
