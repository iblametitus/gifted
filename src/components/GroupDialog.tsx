"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MAX_GROUP } from "@/lib/budget";
import { post } from "@/lib/client";
import { splitShares } from "@/lib/shares";
import type { Suggestion } from "@/lib/types";
import { CloseIcon } from "./icons";

type Props = { gift: Suggestion | null; recipient: string; groupSize?: number | null; onClose: () => void };

// Start a group gift: who you are, how many chip in, who it's for
export function GroupDialog({ gift, recipient, groupSize, onClose }: Props) {
  const router = useRouter();
  const [organizer, setOrganizer] = useState("");
  // Prefilled when the request already said "we're 5 friends"
  const [people, setPeople] = useState(groupSize ? Math.min(MAX_GROUP, Math.max(2, groupSize)) : 3);
  const [forWhom, setForWhom] = useState(recipient);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gift) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gift, onClose]);

  if (!gift) return null;
  const shares = splitShares(gift.quote.total, people);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!gift) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await post("/api/groups", {
        productId: gift.id,
        people,
        organizer,
        recipient: forWhom,
        reason: gift.reason,
      });
      router.push(`/group/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 outline-none transition focus:border-paypal focus:ring-4 focus:ring-paypal/10";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-zinc-900/30 backdrop-blur-[2px]" />
      <form
        onSubmit={create}
        className="animate-fade-up relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-paypal">Gift together</p>
            <h2 className="mt-1 text-lg leading-snug font-semibold">{gift.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-zinc-100">
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-zinc-600">Your name</span>
            <input className={input} value={organizer} onChange={(e) => setOrganizer(e.target.value)} maxLength={40} placeholder="Titus" autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-zinc-600">Who is it for?</span>
            <input className={input} value={forWhom} onChange={(e) => setForWhom(e.target.value)} maxLength={40} placeholder="Tom" />
          </label>
          <div>
            <span className="mb-1.5 block text-sm text-zinc-600">How many people chip in (incl. you)?</span>
            <div className="flex items-center gap-3">
              <Step label="Fewer people" onClick={() => setPeople((n) => Math.max(2, n - 1))} disabled={people <= 2}>
                −
              </Step>
              <span className="w-8 text-center text-lg font-semibold">{people}</span>
              <Step label="More people" onClick={() => setPeople((n) => Math.min(MAX_GROUP, n + 1))} disabled={people >= MAX_GROUP}>
                +
              </Step>
              <span className="ml-auto text-sm text-zinc-500">
                <strong className="text-lg text-zinc-900">${shares[0].toFixed(2)}</strong> each
              </span>
            </div>
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-paypal-soft px-4 py-3 text-sm text-paypal-dark">
          Everyone pays their share with PayPal. It&apos;s only reserved until all {people} are in, then the gift is
          bought. If the group doesn&apos;t fill up in 3 days, nobody is charged.
        </p>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          disabled={busy || !organizer.trim()}
          className="mt-5 w-full rounded-full bg-paypal py-3.5 font-medium text-white transition hover:bg-paypal-dark disabled:opacity-40"
        >
          {busy ? "Creating your group…" : "Create group gift"}
        </button>
      </form>
    </div>
  );
}

function Step({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 items-center justify-center rounded-full border border-zinc-300 text-lg transition hover:border-zinc-900 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
