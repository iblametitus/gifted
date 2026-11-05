"use client";

import { useState } from "react";
import type { Suggestion } from "@/lib/agent";

const EXAMPLE = "Gift for my brother, turning 30, loves coffee and travels a lot. Budget around $80, needs to arrive by Nov 20.";

// Same request -> same suggestions, also on another day. New ideas only on request.
// Saved per browser; every round of ideas stays visible.
type Saved = { rounds: Suggestion[][]; savedAt: string };

const storageKey = (prompt: string) => `gift-agent:${prompt.trim().toLowerCase().replace(/\s+/g, " ")}`;

function load(prompt: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(prompt));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(prompt: string, rounds: Suggestion[][]) {
  try {
    localStorage.setItem(storageKey(prompt), JSON.stringify({ rounds, savedAt: new Date().toISOString() }));
  } catch {
    // Storage blocked (private mode): results just aren't remembered
  }
}

export default function Home() {
  const [prompt, setPrompt] = useState(EXAMPLE);
  const [searched, setSearched] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Suggestion[][]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSearched(prompt);

    const saved = load(prompt);
    if (saved) {
      setRounds(saved.rounds);
      setSavedAt(saved.savedAt);
      return;
    }
    setRounds([]);
    setSavedAt(null);
    await fetchRound(prompt, []);
  }

  async function moreIdeas() {
    if (searched) await fetchRound(searched, rounds);
  }

  async function fetchRound(forPrompt: string, previous: Suggestion[][]) {
    setLoading(true);
    setError(null);
    try {
      const exclude = previous.flat().map((s) => s.id);
      const data = await post("/api/search", { prompt: forPrompt, exclude });
      const next = [...previous, data.suggestions as Suggestion[]];
      setRounds(next);
      save(forPrompt, next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function buy(productId: string) {
    setBuying(productId);
    setError(null);
    try {
      const { approveUrl } = await post("/api/checkout", { productId });
      window.location.assign(approveUrl);
    } catch (err) {
      setError((err as Error).message);
      setBuying(null);
    }
  }

  const lastRoundEmpty = rounds.length > 0 && rounds[rounds.length - 1].length === 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Gift Agent</h1>
      <p className="mt-1 text-zinc-500">One prompt. One choice. Gift handled.</p>

      <form onSubmit={search} className="mt-8 flex flex-col gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-zinc-300 p-3 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Who is it for, what do they love, budget, deadline?"
        />
        <button
          disabled={loading || !prompt.trim()}
          className="self-start rounded-lg bg-black px-5 py-2.5 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading && rounds.length === 0 ? "Finding gifts…" : "Find gifts"}
        </button>
      </form>

      {savedAt && (
        <p className="mt-6 text-sm text-zinc-500">
          Your saved ideas from {new Date(savedAt).toLocaleDateString("en-US")}. Prices are checked again at checkout.
        </p>
      )}

      {rounds.map((round, i) => (
        <section key={i} className="mt-8">
          {i > 0 && <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">More ideas</h2>}
          {round.length === 0 ? (
            <p>{i === 0 ? "No matching gifts found. Try a wider budget." : "No further ideas for this request."}</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              {round.map((s) => (
                <Card key={s.id} s={s} buying={buying} onBuy={buy} />
              ))}
            </div>
          )}
        </section>
      ))}

      {rounds.length > 0 && !lastRoundEmpty && (
        <button
          onClick={moreIdeas}
          disabled={loading}
          className="mt-8 rounded-lg border border-zinc-300 px-5 py-2.5 disabled:opacity-50 dark:border-zinc-700"
        >
          {loading ? "Finding more…" : "Show other ideas"}
        </button>
      )}

      {error && <p className="mt-6 text-red-600">{error}</p>}
    </main>
  );
}

function Card({ s, buying, onBuy }: { s: Suggestion; buying: string | null; onBuy: (id: string) => void }) {
  return (
    <article className="flex flex-col rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      {s.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.imageUrl} alt={s.title} className="aspect-square w-full rounded-lg bg-white object-contain" />
      )}
      <h3 className="mt-3 font-medium leading-snug">{s.title}</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{s.reason}</p>
      <div className="mt-auto pt-4 text-sm">
        <p className="text-lg font-semibold">${s.quote.total.toFixed(2)}</p>
        <p className="text-zinc-500">
          {s.quote.shipping === 0 ? "Free shipping" : `incl. $${s.quote.shipping.toFixed(2)} shipping`} · arrives by{" "}
          {s.quote.deliveryBy}
        </p>
        <p className="text-zinc-500">from {s.merchant}</p>
        <button
          onClick={() => onBuy(s.id)}
          disabled={buying !== null}
          className="mt-3 w-full rounded-lg bg-[#ffc439] py-2.5 font-medium text-black disabled:opacity-50"
        >
          {buying === s.id ? "Opening PayPal…" : "Buy with PayPal"}
        </button>
      </div>
    </article>
  );
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
