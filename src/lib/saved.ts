"use client";

// Cart and favorites, kept in the browser (localStorage) and shared by all components.
// Items are stored as full suggestions, so they can be shown without a new search.

import { useSyncExternalStore } from "react";
import type { Suggestion } from "./types";

export type ListName = "cart" | "favorites";

const EMPTY: Suggestion[] = [];
const keyOf = (list: ListName) => `gifted:${list}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; items: Suggestion[] }>();

function read(list: ListName): Suggestion[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(keyOf(list));
  } catch {
    return EMPTY;
  }
  // Same string -> same array, so React doesn't re-render for nothing
  const hit = cache.get(list);
  if (hit && hit.raw === raw) return hit.items;
  let items = EMPTY;
  try {
    items = raw ? JSON.parse(raw) : EMPTY;
  } catch {
    // Broken entry: start empty
  }
  cache.set(list, { raw, items });
  return items;
}

function write(list: ListName, items: Suggestion[]) {
  try {
    localStorage.setItem(keyOf(list), JSON.stringify(items));
  } catch {
    // Storage blocked (private mode): nothing is remembered
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify); // other tabs
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

export function useList(list: ListName) {
  const items = useSyncExternalStore(subscribe, () => read(list), () => EMPTY);
  const has = (id: string) => items.some((s) => s.id === id);
  return {
    items,
    has,
    add: (s: Suggestion) => {
      if (!has(s.id)) write(list, [...read(list), s]);
    },
    remove: (id: string) => write(list, read(list).filter((s) => s.id !== id)),
    toggle: (s: Suggestion) =>
      write(list, has(s.id) ? read(list).filter((x) => x.id !== s.id) : [...read(list), s]),
  };
}

// After a successful payment: drop what was bought from the cart
export function removeFromCart(ids: string[]) {
  write("cart", read("cart").filter((s) => !ids.includes(s.id)));
}
