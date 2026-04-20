import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "sm", isLoading, children, disabled, style, ...props }, ref) => {

    const base =
      "inline-flex items-center justify-center font-medium transition-all rounded-md focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const sizes: Record<string, string> = {
      sm: "text-xs px-3 py-1.5 gap-1.5",
      md: "text-sm px-4 py-2 gap-2",
      lg: "text-base px-6 py-3 gap-2.5",
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundImage: "linear-gradient(135deg, #002046 0%, #1b365d 100%)",
        color: "#ffffff",
        boxShadow: "0 4px 14px rgba(0, 32, 70, 0.25)",
        border: "none",
      },
      secondary: {
        background: "var(--surface-container-high)",
        color: "var(--on-surface)",
        border: "none",
      },
      tertiary: {
        background: "transparent",
        color: "var(--primary)",
        border: "none",
      },
      danger: {
        backgroundImage: "linear-gradient(135deg, #ba1a1a 0%, #93000a 100%)",
        color: "#ffffff",
        boxShadow: "0 4px 14px rgba(186,26,26,0.2)",
        border: "none",
      },
      outline: {
        background: "transparent",
        color: "var(--on-surface)",
        border: "1.5px solid var(--outline-variant)",
      },
      ghost: {
        background: "transparent",
        color: "var(--on-surface-variant)",
        border: "none",
      },
    };

    return (
      <button
        ref={ref}
        className={`${base} ${sizes[size]} ${className}`}
        style={{ ...variantStyles[variant], ...style }}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
