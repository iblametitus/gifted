"use client";

import { splitShares } from "@/lib/shares";
import type { Suggestion } from "@/lib/types";
import { ShareRing } from "./ShareRing";

type Props = {
  s: Suggestion;
  index: number;
  buying: boolean;
  onBuyNow: (ids: string[]) => void;
  onGroup: (s: Suggestion) => void;
  groupSize?: number | null; // set when the request was a group gift: price per head comes first
};

export function GiftCard({ s, index, buying, onBuyNow, onGroup, groupSize }: Props) {
  return (
    <article
      className="animate-fade-up group flex flex-col overflow-hidden rounded-3xl border border-black/10 bg-white transition duration-200 hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="relative aspect-square overflow-hidden bg-paper">
        {s.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.imageUrl}
            alt={s.title}
            className="absolute inset-0 size-full object-contain p-8 mix-blend-multiply"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs uppercase tracking-wider text-ink/60">{s.brand ?? s.merchant}</p>
        <h3 className="mt-1 line-clamp-2 leading-snug font-medium">{s.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink/70">{s.reason}</p>

        <div className="mt-auto pt-5">
          <div className="border-t border-black/10 pt-4">
            {groupSize ? (
              <GroupPrice s={s} people={groupSize} />
            ) : (
              <>
                <p className="font-display text-3xl font-semibold tracking-tight">${s.quote.total.toFixed(2)}</p>
                <p className="mt-0.5 text-xs text-ink/60">
                  {s.quote.shipping === 0 ? "Free shipping" : `incl. $${s.quote.shipping.toFixed(2)} shipping`}
                </p>
              </>
            )}
            <p className="mt-1 text-xs text-ink/60">
              Arrives by {formatDate(s.quote.deliveryBy)} · sold via {s.merchant}
            </p>
          </div>

          <div className="mt-4 flex flex-col items-center gap-1">
            <button
              onClick={() => onGroup(s)}
              className="w-full rounded-full bg-ink py-3 text-sm font-medium text-white transition hover:bg-black"
            >
              Start group gift
            </button>
            <button
              onClick={() => onBuyNow([s.id])}
              disabled={buying}
              className="py-1.5 text-sm text-ink/60 underline-offset-2 transition hover:text-ink hover:underline disabled:opacity-40"
            >
              Buy it alone
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// "$24.80 each" next to a ring with one segment per person, the total small underneath.
// Shares add up to the exact total.
function GroupPrice({ s, people }: { s: Suggestion; people: number }) {
  const each = splitShares(s.quote.total, people)[0];
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-semibold tracking-tight">${each.toFixed(2)}</span>
          <span className="text-sm text-ink/70">each</span>
        </p>
        <p className="mt-0.5 text-xs text-ink/60">
          ${s.quote.total.toFixed(2)} total ·{" "}
          {s.quote.shipping === 0 ? "free shipping" : `incl. $${s.quote.shipping.toFixed(2)} shipping`}
        </p>
      </div>
      <ShareRing shares={people} reserved={0} size={44} stroke={5} gap={3} label={`${people} people`}>
        <span className="flex size-full items-center justify-center text-xs font-semibold">{people}</span>
      </ShareRing>
    </div>
  );
}

export const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
