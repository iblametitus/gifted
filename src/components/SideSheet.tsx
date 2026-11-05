"use client";

import { useEffect } from "react";
import { useList, type ListName } from "@/lib/saved";
import { cartQuote } from "@/lib/shipping";
import { formatDate } from "./GiftCard";
import { CloseIcon } from "./icons";

type Props = {
  list: ListName | null; // null = closed
  buying: boolean;
  onClose: () => void;
  onCheckout: (ids: string[]) => void;
};

// Slide-over panel for the cart and the favorites
export function SideSheet({ list, buying, onClose, onCheckout }: Props) {
  const cart = useList("cart");
  const favorites = useList("favorites");

  useEffect(() => {
    if (!list) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, onClose]);

  if (!list) return null;
  const isCart = list === "cart";
  const items = isCart ? cart.items : favorites.items;
  const q = cartQuote(cart.items);

  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-zinc-900/20 backdrop-blur-[2px]" />
      <aside className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
          <h2 className="text-lg font-semibold">{isCart ? "Your cart" : "Favorites"}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-zinc-100">
            <CloseIcon className="size-5" />
          </button>
        </div>

        <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto px-6">
          {items.length === 0 && (
            <li className="py-12 text-center text-sm text-zinc-500">
              {isCart ? "Your cart is empty." : "Tap the heart on a gift to save it here."}
            </li>
          )}
          {items.map((s) => (
            <li key={s.id} className="flex gap-4 py-4">
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-zinc-50">
                {s.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt="" className="size-full object-contain p-2 mix-blend-multiply" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{s.title}</p>
                <p className="mt-1 text-sm text-zinc-500">${s.quote.itemPrice.toFixed(2)}</p>
                <div className="mt-auto flex gap-3 pt-2 text-xs">
                  {!isCart &&
                    (cart.has(s.id) ? (
                      <span className="text-paypal-dark">In cart ✓</span>
                    ) : (
                      <button onClick={() => cart.add(s)} className="font-medium text-paypal hover:text-paypal-dark">
                        Add to cart
                      </button>
                    ))}
                  <button
                    onClick={() => (isCart ? cart.remove(s.id) : favorites.remove(s.id))}
                    className="text-zinc-500 hover:text-zinc-900"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {isCart && cart.items.length > 0 && (
          <div className="border-t border-zinc-100 px-6 py-5">
            <dl className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={`$${q.subtotal.toFixed(2)}`} />
              <Row label="Shipping" value={q.shipping === 0 ? "Free" : `$${q.shipping.toFixed(2)}`} />
              <Row label="Arrives by" value={formatDate(q.deliveryBy)} />
              <div className="flex justify-between pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>${q.total.toFixed(2)}</dd>
              </div>
            </dl>
            <button
              onClick={() => onCheckout(cart.items.map((s) => s.id))}
              disabled={buying}
              className="mt-4 w-full rounded-full bg-paypal py-3.5 font-medium text-white transition hover:bg-paypal-dark disabled:opacity-40"
            >
              {buying ? "Opening PayPal…" : "Checkout with PayPal"}
            </button>
            <p className="mt-2 text-center text-xs text-zinc-500">
              Prices and stock are checked again before you pay. Free shipping from $75.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-zinc-600">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
