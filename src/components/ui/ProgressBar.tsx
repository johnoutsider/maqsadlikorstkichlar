import React from "react";

interface ProgressBarProps {
  progress: number; // 0 to max 100
  className?: string;
  showText?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className = "", showText = true }) => {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  
  let colorClass = "bg-primary-500";
  if (p >= 100) colorClass = "bg-success-500";
  else if (p >= 60) colorClass = "bg-warning-500";
  else if (p > 0) colorClass = "bg-danger-500";

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {showText && (
        <div className="flex justify-end text-xs font-medium text-surface-600 dark:text-surface-400">
          {p}%
        </div>
      )}
      <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2 overflow-hidden flex">
        <div 
          className={`h-full ${colorClass} transition-all duration-500 ease-out`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
};
