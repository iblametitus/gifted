"use client";

import { useList } from "@/lib/saved";
import { splitShares } from "@/lib/shares";
import type { Suggestion } from "@/lib/types";
import { HeartIcon } from "./icons";

type Props = {
  s: Suggestion;
  index: number;
  buying: boolean;
  onBuyNow: (ids: string[]) => void;
  onGroup: (s: Suggestion) => void;
  groupSize?: number | null; // set when the request was a group gift: price per head comes first
};

export function GiftCard({ s, index, buying, onBuyNow, onGroup, groupSize }: Props) {
  const favorites = useList("favorites");
  const cart = useList("cart");
  const isFavorite = favorites.has(s.id);
  const inCart = cart.has(s.id);

  return (
    <article
      className="animate-fade-up group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.18)]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-50">
        {s.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.imageUrl}
            alt={s.title}
            className="absolute inset-0 size-full object-contain p-6 mix-blend-multiply transition duration-500 group-hover:scale-[1.03]"
          />
        )}
        <button
          onClick={() => favorites.toggle(s)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
          className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105"
        >
          <HeartIcon filled={isFavorite} className={`size-5 ${isFavorite ? "text-rose-500" : "text-zinc-700"}`} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs uppercase tracking-wider text-zinc-500">{s.brand ?? s.merchant}</p>
        <h3 className="mt-1 line-clamp-2 font-medium leading-snug">{s.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">{s.reason}</p>

        <div className="mt-auto pt-5">
          {groupSize ? (
            <GroupPrice s={s} people={groupSize} />
          ) : (
            <div className="flex items-baseline justify-between border-t border-zinc-100 pt-4">
              <p className="text-xl font-semibold tracking-tight">${s.quote.total.toFixed(2)}</p>
              <p className="text-xs text-zinc-500">
                {s.quote.shipping === 0 ? "Free shipping" : `incl. $${s.quote.shipping.toFixed(2)} shipping`}
              </p>
            </div>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            Arrives by {formatDate(s.quote.deliveryBy)} · sold via {s.merchant}
          </p>
          {groupSize ? (
            <div className="mt-4 flex flex-col items-center gap-1">
              <button
                onClick={() => onGroup(s)}
                className="w-full rounded-full bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-black"
              >
                Start group gift
              </button>
              <button
                onClick={() => onBuyNow([s.id])}
                disabled={buying}
                className="py-1.5 text-sm text-zinc-500 underline-offset-2 transition hover:text-zinc-900 hover:underline disabled:opacity-40"
              >
                Buy it alone
              </button>
            </div>
          ) : (
          <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => (inCart ? cart.remove(s.id) : cart.add(s))}
              className={`rounded-full border py-3 text-sm font-medium transition ${
                inCart
                  ? "border-paypal bg-paypal-soft text-paypal-dark"
                  : "border-zinc-300 hover:border-zinc-900"
              }`}
            >
              {inCart ? "In cart ✓" : "Add to cart"}
            </button>
            <button
              onClick={() => onBuyNow([s.id])}
              disabled={buying}
              className="rounded-full bg-paypal py-3 text-sm font-medium text-white transition hover:bg-paypal-dark disabled:opacity-40"
            >
              Buy now
            </button>
          </div>
          <button
            onClick={() => onGroup(s)}
            className="mt-2 w-full rounded-full py-2 text-sm font-medium text-paypal transition hover:bg-paypal-soft hover:text-paypal-dark"
          >
            Gift together · split with friends
          </button>
          </>
          )}
        </div>
      </div>
    </article>
  );
}

// "$24.80 each · 5 people", the total small underneath. Shares add up to the exact total.
function GroupPrice({ s, people }: { s: Suggestion; people: number }) {
  const each = splitShares(s.quote.total, people)[0];
  return (
    <div className="border-t border-zinc-100 pt-4">
      <p className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">${each.toFixed(2)}</span>
        <span className="text-sm text-zinc-600">each · {people} people</span>
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">
        ${s.quote.total.toFixed(2)} total ·{" "}
        {s.quote.shipping === 0 ? "free shipping" : `incl. $${s.quote.shipping.toFixed(2)} shipping`}
      </p>
    </div>
  );
}

export const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
