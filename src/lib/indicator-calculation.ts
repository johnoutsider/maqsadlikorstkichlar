import type {
  Indicator,
  IndicatorCalculationConfig,
  IndicatorSubmission,
  PercentageCalculationConfig,
} from "@/types/db";

export function isPercentageCalculationConfig(
  config: IndicatorCalculationConfig | null | undefined
): config is PercentageCalculationConfig {
  return (
    !!config &&
    config.type === "percentage" &&
    !!config.denominator?.key &&
    !!config.denominator?.label &&
    Array.isArray(config.numerators) &&
    config.numerators.length > 0 &&
    config.numerators.every((field) => !!field.key && !!field.label)
  );
}

export function hasCalculatedValue(indicator: Indicator) {
  return isPercentageCalculationConfig(indicator.calculation_config);
}

export function formatCalculatedValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function calculatePercentageValue(
  config: PercentageCalculationConfig,
  inputs: Record<string, string | number | null | undefined>
) {
  const denominatorRaw = inputs[config.denominator.key];
  if (denominatorRaw === null || denominatorRaw === undefined || String(denominatorRaw).trim() === "") {
    return null;
  }

  const denominator = Number(denominatorRaw);
  if (!Number.isFinite(denominator) || denominator <= 0) return null;

  let numeratorTotal = 0;
  for (const field of config.numerators) {
    const raw = inputs[field.key];
    if (raw === null || raw === undefined || String(raw).trim() === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    numeratorTotal += value;
  }

  return (numeratorTotal / denominator) * 100;
}

export function getSubmissionScorePercent(
  targetValue: number | null | undefined,
  submission: IndicatorSubmission | undefined
) {
  const value = submission?.value;
  if (typeof value !== "number") return null;

  if (typeof targetValue !== "number") return null;
  if (targetValue > 0) return Math.min((value / targetValue) * 100, 100);
  if (targetValue === 0 && value >= 0) return 100;
  return null;
}
