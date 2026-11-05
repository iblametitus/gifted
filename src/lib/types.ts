// Shapes shared by the API and the browser (types only, safe to import in client code)

import type { Product } from "./channel3";
import type { Quote } from "./shipping";

// Optional form fields. A filled field wins over the free text.
export type GiftFields = {
  recipient?: string;
  interests?: string;
  occasion?: string;
  budgetUsd?: number;
  budgetApprox?: boolean;
  deliverBy?: string; // ISO date
};

export type SearchRequest = {
  prompt: string;
  fields: GiftFields;
  exclude?: string[]; // product ids already shown ("Show other ideas")
  followUpAsked?: boolean; // the agent asks at most one question
};

export type Suggestion = Product & { reason: string; quote: Quote };

export type BudgetSource = "field" | "text" | "assumed";

export type SearchResult = {
  understood: { recipient: string; occasion: string | null; interests: string[] };
  budget: { min: number | null; max: number | null; source: BudgetSource };
  deliverBy: string | null;
  // Set when our earliest delivery is after the requested date
  deliveryWarning: string | null;
  suggestions: Suggestion[];
};

export type AgentStep = "understanding" | "searching" | "picking";

// Streamed line by line (NDJSON) from POST /api/search
export type SearchEvent =
  | { type: "step"; step: AgentStep; detail?: string }
  | { type: "question"; question: string }
  | { type: "result"; result: SearchResult }
  | { type: "error"; message: string };
