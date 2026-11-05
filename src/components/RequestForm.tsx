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
  onPrompt: (prompt: string) => void;
  onFields: (fields: GiftFields) => void;
  onSubmit: () => void;
};

export function RequestForm({ prompt, fields, busy, onPrompt, onFields, onSubmit }: Props) {
  const set = (patch: Partial<GiftFields>) => onFields({ ...fields, ...patch });
  const hasInput =
    prompt.trim() !== "" ||
    Object.entries(fields).some(([k, v]) => k !== "budgetApprox" && v !== undefined && v !== "");

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

      <div className="p-4 pt-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/75">
          Details <span className="font-normal normal-case tracking-normal">· optional, these win over the text</span>
        </p>
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
          <Field label="Budget (USD)">
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
              <button
                type="button"
                onClick={() => set({ budgetApprox: !fields.budgetApprox })}
                aria-pressed={!!fields.budgetApprox}
                title="Around: up to ~6% more is fine. Exact: never above."
                className={`shrink-0 rounded-xl border px-3 text-sm transition ${
                  fields.budgetApprox
                    ? "border-white bg-white text-paypal-dark"
                    : "border-white/40 text-white hover:border-white"
                }`}
              >
                {fields.budgetApprox ? "Around" : "Max"}
              </button>
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
          <div className="flex items-end">
            <button
              disabled={!hasInput || busy}
              className="h-[46px] w-full rounded-xl bg-paypal-dark font-medium text-white transition hover:bg-[#00225f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Working on it…" : "Find gifts"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-3">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-white/90">{label}</span>
      {children}
    </label>
  );
}
