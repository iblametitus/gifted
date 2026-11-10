"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { post } from "@/lib/client";
import type { PublicGroup } from "@/lib/groups";
import { formatDate } from "./GiftCard";

type Notice = "joined" | "refused" | "error" | null;

const usd = (n: number) => `$${n.toFixed(2)}`;

export function GroupView({ group, notice, demo }: { group: PublicGroup; notice: Notice; demo: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [filling, setFilling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Live page: while shares are open, pull the latest state every 3 s, so a friend's
  // reservation shows up in every open window without reloading.
  useEffect(() => {
    if (group.status !== "collecting") return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [group.status, router]);

  // The moment the group closes in front of you (live, or as the last one to join):
  // play the agent's closing steps one by one instead of showing them all at once.
  const [lastStatus, setLastStatus] = useState(group.status);
  const [celebrate, setCelebrate] = useState(notice === "joined" && group.status !== "collecting");
  if (group.status !== lastStatus) {
    setLastStatus(group.status);
    if (lastStatus === "collecting") setCelebrate(true);
  }

  const total = group.quote.total;
  const paid = group.contributors.reduce((sum, c) => sum + (c.charged ?? c.amount), 0);
  const people = group.shares.length;
  const joined = group.contributors.length;
  const forWhom = group.recipient ? ` for ${group.recipient}` : "";

  async function chipIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { approveUrl } = await post(`/api/groups/${group.id}/contribute`, { name });
      window.location.assign(approveUrl);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  // Sandbox demo: simulated friends take the open spots, the real shares are captured
  async function letOthersJoin() {
    setFilling(true);
    setError(null);
    try {
      await post(`/api/groups/${group.id}/demo`, {});
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFilling(false);
    }
  }

  async function copyInvite() {
    const link = `${window.location.origin}/group/${group.id}`;
    try {
      await navigator.clipboard.writeText(`${group.invite}\n\n${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Copy the address from the browser bar instead.");
    }
  }

  return (
    <div className="animate-fade-up pt-6">
      <Banner key={group.status} group={group} notice={notice} />

      <p className="mt-8 text-sm font-medium uppercase tracking-wider text-paypal">Group gift{forWhom}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {group.organizer} is gifting {group.product.title}
      </h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-[220px_1fr]">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-50">
          {group.product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.product.imageUrl}
              alt={group.product.title}
              className="absolute inset-0 size-full object-contain p-5 mix-blend-multiply"
            />
          )}
        </div>
        <div className="flex flex-col">
          {group.product.reason && <p className="leading-relaxed text-zinc-600">{group.product.reason}</p>}
          <p className="mt-3 text-sm text-zinc-500">
            {usd(total)} incl. shipping · from {group.product.merchant} · arrives by{" "}
            {formatDate(group.quote.deliveryBy)}
          </p>

          {/* Progress */}
          <div className="mt-auto pt-6">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">
                {joined} of {people} chipped in
              </span>
              <span className="text-zinc-500">
                {usd(paid)} of {usd(total)}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-700 ${
                  group.status === "complete" ? "bg-emerald-600" : group.status === "cancelled" ? "bg-zinc-300" : "bg-paypal"
                }`}
                style={{ width: `${group.status === "complete" ? 100 : Math.min(100, (paid / total) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {group.closing && <ClosingSteps key={group.status} group={group} animate={celebrate} />}

      {/* Who's in */}
      <ul className="mt-8 grid gap-2 sm:grid-cols-2">
        {group.shares.map((share, i) => {
          const c = group.contributors[i];
          return (
            <li
              key={i}
              className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                c ? "bg-paypal-soft text-paypal-dark" : "border border-dashed border-zinc-300 text-zinc-400"
              }`}
            >
              <span className="font-medium">
                {c ? `✓ ${c.name}` : "Open spot"}
                {c?.demo && (
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                    demo
                  </span>
                )}
              </span>
              <span>{usd(c?.amount ?? share)}</span>
            </li>
          );
        })}
      </ul>

      {group.status === "collecting" && group.nextShare !== null && (
        <>
          <form onSubmit={chipIn} className="mt-8 rounded-3xl bg-paypal p-5 text-white sm:p-6">
            <p className="text-lg font-semibold">Chip in {usd(group.nextShare)}</p>
            <p className="mt-1 text-sm text-white/80">
              PayPal only reserves your share. You&apos;re charged when all {people} are in. If the group isn&apos;t
              complete by {formatDate(group.expiresAt.slice(0, 10))}, nobody pays anything.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={40}
                className="flex-1 rounded-full bg-white px-4 py-3 text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-white/40"
              />
              <button
                disabled={busy || !name.trim()}
                className="rounded-full bg-paypal-dark px-6 py-3 font-medium transition hover:bg-[#00225f] disabled:opacity-50"
              >
                {busy ? "Opening PayPal…" : `Reserve ${usd(group.nextShare)} with PayPal`}
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-2xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">Invite the others</p>
              <button
                onClick={copyInvite}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:border-zinc-900"
              >
                {copied ? "Copied ✓" : "Copy invite + link"}
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-zinc-600">{group.invite}</p>
          </div>

          {demo && joined > 0 && (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-900">
                <strong>Sandbox demo:</strong> skip waiting for friends. Simulated friends fill the open spots, your
                real PayPal share is collected.
              </p>
              <button
                onClick={letOthersJoin}
                disabled={filling}
                className="shrink-0 rounded-full bg-amber-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-950 disabled:opacity-50"
              >
                {filling ? "Collecting…" : "Let the others join"}
              </button>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}

// The agent's last job, step by step: re-check the gift, collect every share, done.
// When something fails, the step shows where it stopped and that nobody paid.
function ClosingSteps({ group, animate }: { group: PublicGroup; animate: boolean }) {
  const closing = group.closing!;
  const reason = group.cancelReason;
  const real = group.contributors.filter((c) => !c.demo).length;
  const simulated = group.contributors.length - real;

  const priceDetail =
    closing.priceNow == null
      ? reason === "sold-out"
        ? "No longer in stock"
        : "Couldn't reach the shop"
      : closing.priceNow > closing.priceThen + 0.005
        ? `Price went up: ${usd(closing.priceThen)} → ${usd(closing.priceNow)}`
        : closing.priceNow < closing.priceThen - 0.005
          ? `Cheaper now: ${usd(closing.priceThen)} → ${usd(closing.priceNow)}. Everyone pays less`
          : `Still ${usd(closing.priceNow)}, in stock`;
  const checkFailed = reason === "sold-out" || reason === "price-changed" || reason === "check-failed";

  const steps: { doing: string; done: string; detail: string; failed?: boolean }[] = [
    { doing: "Checking price and stock…", done: "Checked price and stock", detail: priceDetail, failed: checkFailed },
  ];
  if (!checkFailed) {
    steps.push({
      doing: `Collecting ${group.contributors.length} reservations…`,
      done:
        reason === "payment-failed"
          ? "A payment didn't go through"
          : `Collected ${group.contributors.length} reservations with PayPal`,
      detail:
        reason === "payment-failed"
          ? "Collected shares were refunded in full, the rest released"
          : simulated
            ? `${real} real PayPal ${real === 1 ? "share" : "shares"}, ${simulated} simulated (sandbox demo)`
            : "Every share at once, nobody paid early",
      failed: reason === "payment-failed",
    });
  }
  steps.push(
    group.status === "complete"
      ? {
          doing: "Buying the gift…",
          done: "Gift bought",
          detail: `Arrives by ${formatDate(group.quote.deliveryBy)}${group.recipient ? ` for ${group.recipient}` : ""}`,
        }
      : { doing: "Releasing reservations…", done: "Nobody was charged", detail: "Every reservation released" },
  );

  // Reveal one step at a time when it happens live; reduced motion shows everything at once
  const [shown, setShown] = useState(animate ? 0 : steps.length);
  useEffect(() => {
    if (shown >= steps.length) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setShown((n) => n + 1), reduced ? 0 : 900);
    return () => clearTimeout(timer);
  }, [shown, steps.length]);

  const receipts = group.contributors.filter((c) => c.receipt || c.demo);

  return (
    <section className="animate-fade-up mt-8 rounded-3xl border border-zinc-200 p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">What the agent did</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => {
          if (i > shown) return null;
          const done = i < shown;
          return (
            <li key={step.done} className="animate-fade-up flex gap-3">
              <span
                aria-hidden
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                  !done
                    ? "animate-pulse bg-zinc-300"
                    : step.failed
                      ? "bg-zinc-500"
                      : i === steps.length - 1 && group.status === "complete"
                        ? "bg-emerald-600"
                        : "bg-zinc-900"
                }`}
              >
                {done ? (step.failed ? "!" : "✓") : ""}
              </span>
              <div>
                <p className={`font-medium ${done ? "" : "text-zinc-500"}`}>{done ? step.done : step.doing}</p>
                {done && <p className="text-sm text-zinc-500">{step.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {group.status === "complete" && shown >= steps.length && receipts.length > 0 && (
        <div className="animate-fade-up mt-5 border-t border-zinc-100 pt-4">
          <p className="text-sm font-medium">PayPal receipts</p>
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {receipts.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span>{c.name}</span>
                <span className="flex items-center gap-3 text-zinc-500">
                  <span className="font-mono text-xs">{c.receipt ?? "simulated"}</span>
                  <span className="text-zinc-900">
                    {c.charged != null && c.charged < c.amount - 0.005 && (
                      <s className="mr-1.5 text-zinc-400">{usd(c.amount)}</s>
                    )}
                    {usd(c.charged ?? c.amount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const CANCELLED: Record<NonNullable<PublicGroup["cancelReason"]>, string> = {
  expired: "Time ran out before everyone joined. Every reservation was released.",
  "sold-out": "Everyone was in, but the gift sold out in the meantime. The agent stopped and released every reservation.",
  "price-changed": "Everyone was in, but the price went up. The agent stopped instead of charging more and released every reservation.",
  "check-failed": "Everyone was in, but we couldn't confirm price and stock. To be safe, every reservation was released.",
  "payment-failed": "One payment didn't go through. Shares already collected were refunded in full, the rest released.",
};

function Banner({ group, notice }: { group: PublicGroup; notice: Notice }) {
  if (group.status === "complete") {
    return (
      <Box tone="done">
        <strong>Gift bought.</strong> All {group.shares.length} were in, the agent re-checked price and stock and PayPal
        collected every share{group.recipient ? `. ${group.recipient} is getting their gift` : ""}.
      </Box>
    );
  }
  if (group.status === "cancelled") {
    return (
      <Box tone="muted">
        {CANCELLED[group.cancelReason ?? "expired"]} <strong>Nobody was charged.</strong>
      </Box>
    );
  }
  if (notice === "joined") {
    return (
      <Box tone="success">
        <strong>You&apos;re in!</strong> Your share is reserved. You&apos;ll only be charged once everyone has joined.
      </Box>
    );
  }
  if (notice === "refused") {
    return <Box tone="muted">Someone was faster and this share was already taken. You were not charged.</Box>;
  }
  if (notice === "error") {
    return <Box tone="error">The payment didn&apos;t go through. Nothing was reserved, please try again.</Box>;
  }
  return null;
}

function Box({ tone, children }: { tone: "success" | "done" | "muted" | "error"; children: React.ReactNode }) {
  const styles = {
    success: "border-paypal/30 bg-paypal-soft text-paypal-dark",
    done: "animate-fade-up border-emerald-200 bg-emerald-50 text-emerald-900",
    muted: "border-zinc-200 bg-zinc-50 text-zinc-700",
    error: "border-red-200 bg-red-50 text-red-700",
  }[tone];
  return <p className={`rounded-2xl border px-5 py-4 text-sm leading-relaxed ${styles}`}>{children}</p>;
}
