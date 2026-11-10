import type { AgentStep } from "@/lib/types";

const STEPS: { step: AgentStep; label: string }[] = [
  { step: "understanding", label: "Understanding who it's for" },
  { step: "searching", label: "Searching stores" },
  { step: "picking", label: "Picking the best 3" },
];

export type StepState = { step: AgentStep; detail?: string };

// Live view of the agent's steps; `done` marks the whole run as finished
export function AgentProgress({ reached, done }: { reached: StepState[]; done: boolean }) {
  const current = reached.at(-1)?.step;
  const currentIndex = STEPS.findIndex((s) => s.step === current);

  return (
    <ol className="animate-fade-up space-y-4 rounded-3xl border border-black/10 bg-white p-6">
      {STEPS.map(({ step, label }, i) => {
        const state = done || i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
        const detail = reached.find((r) => r.step === step)?.detail;
        return (
          <li key={step} className="flex gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
              {state === "done" && (
                <svg viewBox="0 0 20 20" className="size-5 text-ink" aria-hidden>
                  <circle cx="10" cy="10" r="10" fill="currentColor" />
                  <path d="M6 10.5l2.5 2.5L14 7.5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                </svg>
              )}
              {state === "active" && (
                <span className="relative flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/40" />
                  <span className="relative inline-flex size-3 rounded-full bg-accent" />
                </span>
              )}
              {state === "pending" && <span className="size-3 rounded-full border border-black/20" />}
            </span>
            <div>
              <p className={state === "pending" ? "text-ink/40" : "text-ink"}>{label}</p>
              {detail && <p className="mt-0.5 text-sm text-ink/60">{detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
