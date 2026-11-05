"use client";

import type { GiftFields } from "@/lib/types";

const EXAMPLES = [
  "My brother turns 30. He loves coffee and travels a lot. Around $80.",
  "Something for my mom, she gardens every weekend and just started yoga. Max $50.",
  "Thank-you gift for a colleague who is into board games and good tea.",
];

const input =
  "w-full rounded-xl border border-transparent bg-white px-3.5 py-2.5 text-[15px] text-zinc-900 outline-none transition " +
  "placeholder:text-zinc-400 focus:ring-4 focus:ring-white/40";

type Props = {
  prompt: string;
  fields: GiftFields;
  busy: boolean;
  detailsOpen: boolean;
  onPrompt: (prompt: string) => void;
  onFields: (fields: GiftFields) => void;
  onToggleDetails: () => void;
  onSubmit: () => void;
};

// Free text by default; the detail fields fold out on demand
export function RequestForm({ prompt, fields, busy, detailsOpen, onPrompt, onFields, onToggleDetails, onSubmit }: Props) {
  const set = (patch: Partial<GiftFields>) => onFields({ ...fields, ...patch });
  const filled = Object.entries(fields).filter(([k, v]) => k !== "budgetApprox" && v !== undefined && v !== "").length;
  const hasInput = prompt.trim() !== "" || filled > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (hasInput && !busy) onSubmit();
      }}
      className="rounded-3xl bg-paypal p-2 text-white shadow-[0_2px_4px_rgba(0,48,135,0.12),0_16px_40px_-16px_rgba(0,48,135,0.45)]"
    >
      <textarea
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
        rows={3}
        placeholder="Tell us about them: who they are, what they love, your budget…"
        className="block w-full resize-none rounded-2xl bg-white px-4 pt-4 pb-3 text-lg text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-4 focus:ring-white/40"
      />

      <div className="flex items-center justify-between gap-3 px-2 pt-3">
        <button
          type="button"
          onClick={onToggleDetails}
          aria-expanded={detailsOpen}
          aria-controls="details"
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
        >
          {detailsOpen ? "Hide details" : "Add details"}
          {filled > 0 && (
            <span className="rounded-full bg-white px-1.5 text-xs leading-5 font-semibold text-paypal-dark">{filled}</span>
          )}
          <svg
            viewBox="0 0 20 20"
            aria-hidden
            className={`size-4 transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`}
          >
            <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <button
          disabled={!hasInput || busy}
          className="h-11 rounded-full bg-paypal-dark px-6 font-medium text-white transition hover:bg-[#00225f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Working on it…" : "Find gifts"}
        </button>
      </div>

      {/* grid-rows 0fr -> 1fr animates the height smoothly; inert keeps hidden fields out of the tab order */}
      <div
        id="details"
        inert={!detailsOpen}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${detailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="mb-3 text-xs text-white/75">Optional. Anything you fill in here wins over the text.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="For">
                <input
                  className={input}
                  placeholder="Brother, 30"
                  value={fields.recipient ?? ""}
                  onChange={(e) => set({ recipient: e.target.value || undefined })}
                />
              </Field>
              <Field label="Interests">
                <input
                  className={input}
                  placeholder="Coffee, travel"
                  value={fields.interests ?? ""}
                  onChange={(e) => set({ interests: e.target.value || undefined })}
                />
              </Field>
              <Field label="Occasion">
                <input
                  className={input}
                  placeholder="Birthday"
                  value={fields.occasion ?? ""}
                  onChange={(e) => set({ occasion: e.target.value || undefined })}
                />
              </Field>
              <Field label="Budget (USD)" className="lg:col-span-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400">$</span>
                    <input
                      id="budget"
                      className={`${input} pl-7`}
                      type="number"
                      min={1}
                      inputMode="decimal"
                      placeholder="80"
                      value={fields.budgetUsd ?? ""}
                      onChange={(e) => set({ budgetUsd: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <BudgetMode
                    approx={!!fields.budgetApprox}
                    onChange={(budgetApprox) => set({ budgetApprox })}
                  />
                </div>
              </Field>
              <Field label="Deliver by">
                <input
                  className={input}
                  type="date"
                  value={fields.deliverBy ?? ""}
                  onChange={(e) => set({ deliverBy: e.target.value || undefined })}
                />
              </Field>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-3">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onPrompt(example)}
            className="rounded-full border border-white/35 px-3 py-1.5 text-left text-xs text-white/90 transition hover:border-white hover:bg-white/10 hover:text-white"
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  );
}

// Two-way switch "Max | Around": a white thumb slides under the active option
function BudgetMode({ approx, onChange }: { approx: boolean; onChange: (approx: boolean) => void }) {
  const options = [
    { value: false, label: "Max", hint: "Never above your budget" },
    { value: true, label: "Around", hint: "Up to ~6% more is fine" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Budget mode"
      className="relative grid shrink-0 grid-cols-2 rounded-xl border border-white/40 p-1 text-sm"
    >
      <span
        aria-hidden
        className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm transition-transform duration-200 ease-out ${
          approx ? "translate-x-full" : ""
        }`}
      />
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={approx === o.value}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={`relative z-10 rounded-lg px-3 font-medium transition-colors ${
            approx === o.value ? "text-paypal-dark" : "text-white/85 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm text-white/90">{label}</span>
      {children}
    </label>
  );
}
