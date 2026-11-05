// Budget rules (what the buyer pays, shipping included):
// "$80" or "max $80" -> never above 80. "around $80" -> up to 85.
// No budget anywhere -> we assume one and show it as assumed.
// The lower bound keeps suggestions in the spirit of the budget.

import type { BudgetSource } from "./types";

const APPROX_TOLERANCE = 1.0625; // 80 -> 85
const LOWER_SHARE = 0.6; // 80 -> 48
export const DEFAULT_BUDGET_USD = 100;

export type Budget = {
  budgetUsd: number | null;
  approximate: boolean;
  minUsd: number | null; // only if the user named a lower bound ("between 50 and 80")
};

export function budgetRange({ budgetUsd, approximate, minUsd }: Budget) {
  if (budgetUsd == null) return { min: minUsd, max: null };
  const max = approximate ? Math.round(budgetUsd * APPROX_TOLERANCE) : budgetUsd;
  const min = minUsd ?? Math.floor(budgetUsd * LOWER_SHARE);
  return { min, max };
}

// Field beats text, text beats the assumed default
export function resolveBudget(field: { budgetUsd?: number; budgetApprox?: boolean }, fromText: Budget) {
  let budget: Budget;
  let source: BudgetSource;
  if (field.budgetUsd != null && field.budgetUsd > 0) {
    budget = { budgetUsd: field.budgetUsd, approximate: field.budgetApprox ?? false, minUsd: null };
    source = "field";
  } else if (fromText.budgetUsd != null) {
    budget = fromText;
    source = "text";
  } else {
    budget = { budgetUsd: DEFAULT_BUDGET_USD, approximate: false, minUsd: null };
    source = "assumed";
  }
  return { ...budgetRange(budget), source };
}
