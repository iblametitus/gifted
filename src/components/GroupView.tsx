"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { post } from "@/lib/client";
import type { PublicGroup } from "@/lib/groups";
import { giftFor, initials } from "@/lib/words";
import { formatDate } from "./GiftCard";
import { ShareRing } from "./ShareRing";

type Notice = "joined" | "refused" | "error" | null;

const usd = (n: number) => `$${n.toFixed(2)}`;

type Props = { group: PublicGroup; notice: Notice; demo: boolean; daysLeft: string };

export function GroupView({ group: live, notice, demo, daysLeft }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [filling, setFilling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Live page: while shares are open, pull the latest state every 3 s, so a friend's
  // reservation shows up in every open window without reloading.
  useEffect(() => {
    if (live.status !== "collecting") return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [live.status, router]);

  // Sandbox demo: the server lets all simulated friends in at once. This window plays them in
  // one by one (how many are shown so far, null = show the live state), then the group closes.
  const [reveal, setReveal] = useState<number | null>(null);
  const arrived = live.contributors.length;
  useEffect(() => {
    if (reveal === null) return;
    if (reveal < arrived) {
      const timer = setTimeout(() => setReveal(reveal + 1), 700); // next friend joins
      return () => clearTimeout(timer);
    }
    // Everyone shown: once the server says the group is closed, hand over to the live state
    // (the ring closes and the agent's steps play). Until the refresh lands, wait here.
    if (live.status === "collecting") return;
    const timer = setTimeout(() => setReveal(null), 700);
    return () => clearTimeout(timer);
  }, [reveal, arrived, live.shares.length, live.status]);

  const group: PublicGroup =
    reveal === null
      ? live
      : {
          ...live,
          status: "collecting",
          contributors: live.contributors.slice(0, reveal),
          closing: undefined,
          cancelReason: undefined,
          nextShare: null,
        };

  // The moment the group closes in front of you (live, or as the last one to join):
  // play the agent's closing steps one by one instead of showing them all at once.
  const [lastStatus, setLastStatus] = useState(group.status);
  const [celebrate, setCelebrate] = useState(notice === "joined" && group.status !== "collecting");
  if (group.status !== lastStatus) {
    setLastStatus(group.status);
    if (lastStatus === "collecting") setCelebrate(true);
  }

  const total = group.quote.total;
  // Cancelled: every reservation was released or refunded, so nothing counts as paid
  const paid =
    group.status === "cancelled" ? 0 : group.contributors.reduce((sum, c) => sum + (c.charged ?? c.amount), 0);
  const people = group.shares.length;
  const joined = group.contributors.length;

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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      await post(`/api/groups/${group.id}/demo`, {});
      if (!reduced) setReveal(group.contributors.length); // start from who's in now
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

  const captured = group.status === "complete";
  const reserved = group.status === "cancelled" ? 0 : joined;
  const each = group.shares[0] ?? total;
  const ringLabel = captured
    ? `All ${people} shares collected`
    : group.status === "cancelled"
      ? "Every reservation released"
      : `${joined} of ${people} shares reserved`;
  const ringCaption = captured
    ? `All ${people} in · collected`
    : group.status === "cancelled"
      ? "Released · nobody paid"
      : `${joined} of ${people} in · ${daysLeft}`;
  const paying = group.status === "collecting" && group.nextShare !== null;

  return (
    // Opacity-only entry: a transform animation here would pin the "fixed" pay bar to this box, not the screen
    <div className={`animate-fade-in pt-2 ${paying ? "pb-48 sm:pb-0" : ""}`}>
      <Banner key={group.status} group={group} notice={notice} />

      <div className="mt-6 grid items-start gap-x-12 gap-y-6 sm:grid-cols-[300px_1fr]">
        {/* 1. Who invited whom, or how it ended */}
        <div className="sm:col-start-2 sm:row-start-1">
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            {captured ? (
              "Gift bought."
            ) : group.status === "cancelled" ? (
              "Nobody was charged."
            ) : (
              <>
                <span className="text-accent">{group.organizer}</span> invited you to chip in for{" "}
                {giftFor(group.recipient)}.
              </>
            )}
          </h1>
          {captured && (
            <p className="mt-3 leading-relaxed text-ink/70">
              All {people} were in. The agent re-checked price and stock, then PayPal collected every share
              {group.recipient ? `. ${group.recipient} is getting their gift` : ""}.
            </p>
          )}
          {group.status === "cancelled" && (
            <p className="mt-3 leading-relaxed text-ink/70">{CANCELLED[group.cancelReason ?? "expired"]}</p>
          )}
        </div>

        {/* 2. The ring: one segment per person, the product in the middle */}
        <div className="flex flex-col items-center sm:col-start-1 sm:row-span-2 sm:row-start-1">
          <ShareRing
            key={group.status}
            shares={people}
            reserved={reserved}
            captured={captured}
            size={280}
            stroke={12}
            label={ringLabel}
            className={captured ? "animate-ring-close" : ""}
          >
            {group.product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={group.product.imageUrl}
                alt={group.product.title}
                className="size-full object-contain p-8 mix-blend-multiply"
              />
            )}
          </ShareRing>
          <p className="mt-4 text-sm font-medium">{ringCaption}</p>
          <p className="text-sm text-ink/60">
            {usd(paid)} of {usd(total)}
          </p>
        </div>

        <div className="sm:col-start-2">
          {/* 3. People: initials, open spots dashed */}
          <ul className="flex flex-wrap gap-2" aria-label="Who's in">
            {group.shares.map((share, i) => {
              const c = group.contributors[i];
              return c ? (
                <li
                  key={i}
                  title={`${c.name} · ${usd(c.charged ?? c.amount)}${c.demo ? " · demo" : ""}`}
                  className={`animate-fade-up relative flex size-11 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-500 ${
                    captured
                      ? "border-done bg-done/10 text-done"
                      : group.status === "cancelled"
                        ? "border-black/20 bg-white text-ink/60"
                        : "border-accent bg-accent-soft text-ink"
                  }`}
                >
                  <span aria-hidden>{initials(c.name)}</span>
                  <span className="sr-only">
                    {c.name}, {usd(c.amount)}
                    {c.demo ? " (demo)" : ""}
                  </span>
                  {c.demo && (
                    <span
                      aria-hidden
                      className="absolute -right-1.5 -bottom-1 rounded-full bg-white px-1 text-[9px] font-medium text-ink/60 ring-1 ring-black/10"
                    >
                      demo
                    </span>
                  )}
                </li>
              ) : (
                <li
                  key={i}
                  title={`Open spot · ${usd(share)}`}
                  className="size-11 rounded-full border-2 border-dashed border-black/20"
                >
                  <span className="sr-only">Open spot, {usd(share)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm text-ink/60">
            {joined === 0
              ? "Nobody has chipped in yet."
              : `${listNames(group.contributors.map((c) => c.name))} ${joined === 1 ? "is" : "are"} in.`}
            {group.status === "collecting" && joined < people && ` ${people - joined} open.`}
          </p>

          {/* 4. The gift */}
          <div className="mt-6 border-t border-black/10 pt-5">
            <h2 className="leading-snug font-medium">{group.product.title}</h2>
            {group.product.reason && (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/70">{group.product.reason}</p>
            )}
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-2xl font-semibold">{usd(each)}</span>
              <span className="text-sm text-ink/60">
                each · {usd(total)} total incl. shipping · {group.product.merchant} · arrives by{" "}
                {formatDate(group.quote.deliveryBy)}
              </span>
            </p>
          </div>

          {/* 5. Pay: pinned to the bottom on phones, so it's visible without scrolling */}
          {paying && (
            <form
              onSubmit={chipIn}
              className="fixed inset-x-0 bottom-0 z-20 rounded-t-3xl bg-paypal px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-[0_-12px_32px_-12px_rgba(0,48,135,0.45)] sm:static sm:mt-8 sm:rounded-3xl sm:p-6 sm:shadow-none"
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="chip-name">
                  Your name
                </label>
                <input
                  id="chip-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={40}
                  autoComplete="given-name"
                  className="min-w-0 flex-1 rounded-full bg-white px-4 py-3 text-ink outline-none placeholder:text-ink/40 focus:ring-4 focus:ring-white/40"
                />
                <button
                  disabled={busy || !name.trim()}
                  className="rounded-full bg-paypal-dark px-6 py-3 font-medium transition hover:bg-[#00225f] disabled:opacity-60"
                >
                  {busy ? "Opening PayPal…" : `Reserve ${usd(group.nextShare!)} with PayPal`}
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-white/90 sm:text-left">
                Charged only when all {people} are in. Not complete by {formatDate(group.expiresAt.slice(0, 10))}?
                Nobody pays.
              </p>
            </form>
          )}

          {/* 6. Invite and demo, kept quiet */}
          {group.status === "collecting" && (
            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-black/10 bg-white p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium">Invite the others</p>
                  <button
                    onClick={copyInvite}
                    className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium transition hover:border-ink"
                  >
                    {copied ? "Copied ✓" : "Copy invite + link"}
                  </button>
                </div>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink/70">{group.invite}</p>
              </div>

              {demo && joined > 0 && (
                <div className="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-black/20 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink/70">
                    <strong className="text-ink">Sandbox demo:</strong> skip waiting for friends. Simulated friends
                    fill the open spots, your real PayPal share is collected.
                  </p>
                  <button
                    onClick={letOthersJoin}
                    disabled={filling || reveal !== null}
                    className="shrink-0 rounded-full border border-ink px-5 py-2.5 text-sm font-medium transition hover:bg-ink hover:text-white disabled:opacity-50"
                  >
                    {filling || reveal !== null ? "Friends joining…" : "Let the others join"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 7. How it ended: the agent's closing steps and receipts */}
      {group.closing && <ClosingSteps key={group.status} group={group} animate={celebrate} />}

      {error && (
        <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}

// "Anna", "Anna and Ben", "Anna, Ben and Chloe"
function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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
    <section className="animate-fade-up mt-10 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-ink/60">What the agent did</p>
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
                    ? "animate-pulse bg-black/20"
                    : step.failed
                      ? "bg-ink/50"
                      : i === steps.length - 1 && group.status === "complete"
                        ? "bg-done"
                        : "bg-ink"
                }`}
              >
                {done ? (step.failed ? "!" : "✓") : ""}
              </span>
              <div>
                <p className={`font-medium ${done ? "" : "text-ink/60"}`}>{done ? step.done : step.doing}</p>
                {done && <p className="text-sm text-ink/60">{step.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {group.status === "complete" && shown >= steps.length && receipts.length > 0 && (
        <div className="animate-fade-up mt-5 border-t border-black/10 pt-4">
          <p className="text-sm font-medium">PayPal receipts</p>
          <ul className="mt-2 divide-y divide-black/5 text-sm">
            {receipts.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span>{c.name}</span>
                <span className="flex items-center gap-3 text-ink/60">
                  <span className="font-mono text-xs">{c.receipt ?? "simulated"}</span>
                  <span className="text-ink">
                    {c.charged != null && c.charged < c.amount - 0.005 && (
                      <s className="mr-1.5 text-ink/40">{usd(c.amount)}</s>
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
  // How a closed group ended is told under the headline
  if (group.status !== "collecting") return null;
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

function Box({ tone, children }: { tone: "success" | "muted" | "error"; children: React.ReactNode }) {
  const styles = {
    success: "border-accent/40 bg-accent-soft text-ink",
    muted: "border-black/10 bg-white text-ink/80",
    error: "border-red-200 bg-red-50 text-red-700",
  }[tone];
  return <p className={`rounded-2xl border px-5 py-4 text-sm leading-relaxed ${styles}`}>{children}</p>;
}
