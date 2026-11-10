"use client";

import { useCallback, useRef, useState } from "react";
import { AgentProgress, type StepState } from "@/components/AgentProgress";
import { formatDate, GiftCard } from "@/components/GiftCard";
import { HeroCard, ThreeSteps } from "@/components/HeroCard";
import { Wordmark } from "@/components/Wordmark";
import { RequestForm } from "@/components/RequestForm";
import { GroupDialog } from "@/components/GroupDialog";
import { post, streamSearch } from "@/lib/client";
import { withFreshDelivery } from "@/lib/shipping";
import { recipientLabel } from "@/lib/words";
import type { GiftFields, SearchRequest, SearchResult, Suggestion } from "@/lib/types";

type Meta = Omit<SearchResult, "suggestions">;

// Same request -> same suggestions, also on another day. New ideas only on request.
// Saved per browser; every round of ideas stays visible.
type Saved = { rounds: Suggestion[][]; meta: Meta; effectivePrompt: string; savedAt: string };

const storageKey = (prompt: string, fields: GiftFields) =>
  `gifted:${JSON.stringify([prompt.trim().toLowerCase().replace(/\s+/g, " "), fields])}`;

function load(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const saved: Saved = JSON.parse(raw);
    return { ...saved, rounds: saved.rounds.map((round) => withFreshDelivery(round)) };
  } catch {
    return null;
  }
}

function save(key: string, saved: Omit<Saved, "savedAt">) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...saved, savedAt: new Date().toISOString() }));
  } catch {
    // Storage blocked (private mode): results just aren't remembered
  }
}

type Phase = "idle" | "running" | "question" | "done";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [fields, setFields] = useState<GiftFields>({});

  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<StepState[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Suggestion[][]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [groupGift, setGroupGift] = useState<Suggestion | null>(null);
  const closeGroup = useCallback(() => setGroupGift(null), []);

  // The request the current results belong to (frozen at submit, the form may change afterwards)
  const active = useRef<{ key: string; fields: GiftFields; effectivePrompt: string }>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  function submit() {
    const key = storageKey(prompt, fields);
    active.current = { key, fields, effectivePrompt: prompt };
    setError(null);
    setQuestion(null);

    const saved = load(key);
    if (saved) {
      active.current.effectivePrompt = saved.effectivePrompt;
      setRounds(saved.rounds);
      setMeta(saved.meta);
      setSavedAt(saved.savedAt);
      setPhase("done");
      return;
    }
    setRounds([]);
    setMeta(null);
    setSavedAt(null);
    run({ prompt, fields, followUpAsked: false }, []);
  }

  function answer(text: string) {
    if (!active.current || !question) return;
    const effectivePrompt = `${active.current.effectivePrompt}\n\n${question} ${text}`.trim();
    active.current.effectivePrompt = effectivePrompt;
    setQuestion(null);
    run({ prompt: effectivePrompt, fields: active.current.fields, followUpAsked: true }, []);
  }

  function moreIdeas() {
    if (!active.current) return;
    const exclude = rounds.flat().map((s) => s.id);
    run({ prompt: active.current.effectivePrompt, fields: active.current.fields, followUpAsked: true, exclude }, rounds);
  }

  async function run(req: SearchRequest, previous: Suggestion[][]) {
    setPhase("running");
    setSteps([]);
    setError(null);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

    let finished = false;
    try {
      await streamSearch(req, (event) => {
        if (event.type === "step") setSteps((s) => [...s, { step: event.step, detail: event.detail }]);
        if (event.type === "question") {
          finished = true;
          setQuestion(event.question);
          setPhase("question");
        }
        if (event.type === "result") {
          finished = true;
          const { suggestions, ...rest } = event.result;
          const next = [...previous, suggestions];
          setRounds(next);
          setMeta(rest);
          setPhase("done");
          if (active.current) save(active.current.key, { rounds: next, meta: rest, effectivePrompt: req.prompt });
        }
        if (event.type === "error") setError(event.message);
      });
    } catch (err) {
      setError((err as Error).message);
    }
    if (!finished) setPhase(previous.length ? "done" : "idle");
  }

  // "Buy it alone" (the cart is hidden for now, the API still takes several ids)
  async function buy(productIds: string[]) {
    setBuying(true);
    setError(null);
    try {
      const { approveUrl } = await post("/api/checkout", { productIds });
      window.location.assign(approveUrl);
    } catch (err) {
      setError((err as Error).message);
      setBuying(false);
    }
  }

  const lastRoundEmpty = rounds.length > 0 && rounds[rounds.length - 1].length === 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Wordmark />
        <span className="rounded-full border border-black/10 px-2.5 py-1 text-xs text-ink/60">PayPal Sandbox demo</span>
      </header>
      <GroupDialog
        key={groupGift?.id ?? "none"}
        gift={groupGift}
        recipient={recipientLabel(
          meta?.understood.recipientLabel || meta?.understood.recipient,
          (meta?.understood.groupSize ?? 0) > 1,
        )}
        groupSize={meta?.understood.groupSize}
        onClose={closeGroup}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 sm:px-6">
        <section className="grid items-center gap-10 pt-6 pb-10 sm:pt-12 md:grid-cols-[1fr_auto] md:gap-12">
          <div>
            <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
              Group gifts without chasing anyone for money.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/70">
              One prompt finds the gift. Everyone reserves their share with PayPal. Nobody is charged unless everyone
              is in.
            </p>
          </div>
          <HeroCard />
        </section>

        <RequestForm
          prompt={prompt}
          fields={fields}
          busy={phase === "running"}
          detailsOpen={detailsOpen}
          onPrompt={setPrompt}
          onFields={setFields}
          onToggleDetails={() => setDetailsOpen((open) => !open)}
          onSubmit={submit}
        />

        {phase === "idle" && rounds.length === 0 && (
          <section aria-label="How it works" className="pt-12">
            <ThreeSteps />
          </section>
        )}

        <div ref={resultsRef} className="scroll-mt-6 pt-12">
          {phase === "running" && rounds.length === 0 && <AgentProgress reached={steps} done={false} />}

          {phase === "question" && question && <FollowUp question={question} onAnswer={answer} />}

          {meta && rounds.length > 0 && (
            <Understood
              meta={meta}
              savedAt={savedAt}
              onSetBudget={() => {
                setDetailsOpen(true);
                // Wait for the panel to unfold (and lose `inert`) before focusing
                setTimeout(() => {
                  const el = document.getElementById("budget");
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  el?.focus({ preventScroll: true });
                }, 320);
              }}
            />
          )}

          {rounds.map((round, i) => (
            <section key={i} className="mt-8">
              {i > 0 && <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-ink/60">More ideas</h2>}
              {round.length === 0 ? (
                <p className="text-ink/70">
                  {i === 0
                    ? "Nothing in stock matches this budget. Try a higher budget or fewer constraints."
                    : "That's all we found for this request."}
                </p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {round.map((s, j) => (
                    <GiftCard
                      key={s.id}
                      s={s}
                      index={j}
                      buying={buying}
                      onBuyNow={buy}
                      onGroup={setGroupGift}
                      groupSize={meta?.understood.groupSize}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}

          {phase === "running" && rounds.length > 0 && (
            <div className="mt-8">
              <AgentProgress reached={steps} done={false} />
            </div>
          )}

          {phase === "done" && rounds.length > 0 && !lastRoundEmpty && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={moreIdeas}
                className="rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-medium transition hover:border-ink"
              >
                Show other ideas
              </button>
            </div>
          )}

          {error && (
            <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl border-t border-black/10 px-4 py-6 text-sm text-ink/60 sm:px-6">
        Built with Claude, Channel3, PayPal Sandbox and Render.
      </footer>
    </div>
  );
}

function FollowUp({ question, onAnswer }: { question: string; onAnswer: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAnswer(text);
      }}
      className="animate-fade-up rounded-3xl border border-black/10 bg-white p-6"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-ink/60">One quick question</p>
      <p className="mt-2 font-display text-xl">{question}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Your answer"
          className="flex-1 rounded-xl border border-black/15 px-3.5 py-2.5 outline-none focus:border-ink focus:ring-4 focus:ring-ink/5"
          placeholder="Your answer"
        />
        <button
          disabled={!text.trim()}
          className="rounded-xl bg-ink px-5 py-2.5 font-medium text-white disabled:opacity-40"
        >
          Continue
        </button>
        <button type="button" onClick={() => onAnswer("No idea, surprise me.")} className="px-3 text-sm text-ink/60 hover:text-ink">
          Skip
        </button>
      </div>
    </form>
  );
}

// What the agent understood, incl. assumptions the buyer can correct
function Understood({ meta, savedAt, onSetBudget }: { meta: Meta; savedAt: string | null; onSetBudget: () => void }) {
  const { understood, budget, deliverBy, deliveryWarning } = meta;
  const budgetText =
    budget.max == null ? "Any budget" : `Up to $${budget.max}${budget.min ? ` (from $${budget.min})` : ""}`;
  // For a group, what each person pays tells more than the total
  // (the user's own per-head amount if they named one, the budget field may still override it)
  const perHead = !understood.groupSize || budget.max == null
    ? ""
    : understood.perPersonUsd && budget.source === "text"
      ? ` · $${understood.perPersonUsd} each`
      : ` · ~$${Math.round(budget.max / understood.groupSize)} each`;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {understood.groupSize && <Chip>{understood.groupSize} people</Chip>}
        {understood.recipient && <Chip>For {understood.recipient}</Chip>}
        {understood.occasion && <Chip>{understood.occasion}</Chip>}
        {understood.interests.length > 0 && <Chip>{understood.interests.join(", ")}</Chip>}
        <Chip muted={budget.source === "assumed"}>
          {budgetText}
          {perHead}
          {budget.source === "assumed" && (
            <>
              <span className="text-ink/50"> · assumed · </span>
              <button
                onClick={onSetBudget}
                className="underline underline-offset-2 hover:text-ink"
              >
                set budget
              </button>
            </>
          )}
        </Chip>
        {deliverBy && <Chip>Needed by {formatDate(deliverBy)}</Chip>}
      </div>
      {deliveryWarning && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {deliveryWarning}
        </p>
      )}
      {savedAt && (
        <p className="mt-3 text-xs text-ink/60">
          Your saved ideas from {new Date(savedAt).toLocaleDateString("en-US")}. Prices are checked again at checkout.
        </p>
      )}
    </div>
  );
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${muted ? "border-dashed border-black/20 text-ink/70" : "border-black/10 bg-white"}`}
    >
      {children}
    </span>
  );
}
