// Group gifts: several people chip in, PayPal reserves each share,
// and the gift is only bought once every share is in. Otherwise all reservations are released.

import { Redis } from "@upstash/redis";
import { randomInt } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getProduct } from "./channel3";
import { closeGroup, releaseAll, shortReceipt, type CancelReason, type ClosingDeps } from "./closing";
import { captureAuthorization, refundCapture, voidAuthorization, type Address } from "./paypal";
import { splitShares } from "./shares";
import { quote, type Quote } from "./shipping";
import type { Suggestion } from "./types";

const COLLECT_DAYS = 3; // PayPal honors an authorization for 3 days
const KEEP_DAYS = 30;

export type Contribution = {
  name: string;
  amount: number;
  authorizationId: string;
  orderId: string;
  at: string;
  demo?: boolean; // simulated friend (DEMO_MODE only), never sent to PayPal
  captureId?: string; // set once PayPal collected this share
  charged?: number; // what was collected: less than amount if the price dropped before closing
  refunded?: boolean; // collected, then given back because the group couldn't close
};

export type Group = {
  id: string;
  createdAt: string;
  expiresAt: string;
  product: Pick<Suggestion, "id" | "title" | "brand" | "merchant" | "imageUrl" | "reason">;
  quote: Quote;
  organizer: string;
  recipient: string | null;
  invite: string;
  shares: number[]; // exact amounts, add up to quote.total
  contributions: Contribution[];
  shipTo: { name: string; address: Address } | null;
  status: "collecting" | "complete" | "cancelled";
  completedAt?: string;
  cancelReason?: CancelReason;
  // The agent's final check before collecting. priceNow is null if the product was gone (or the check failed)
  closing?: { checkedAt: string; priceThen: number; priceNow: number | null };
};

export type PublicGroup = Omit<Group, "contributions" | "shipTo"> & {
  contributors: { name: string; amount: number; charged: number | null; demo: boolean; receipt: string | null }[];
  nextShare: number | null;
};

// --- storage ---
// Upstash Redis when configured. Otherwise one JSON file per key in .dev-groups/ (local dev only:
// the dev server renders pages and API routes in separate processes, so memory isn't shared).

type Store = {
  get(key: string): Promise<Group | null>;
  set(key: string, value: Group): Promise<void>;
  lock(key: string): Promise<boolean>; // true if we got it
  unlock(key: string): Promise<void>;
};

function redisStore(redis: Redis): Store {
  return {
    get: async (k) => (await redis.get<Group>(k)) ?? null,
    set: async (k, v) => void (await redis.set(k, v, { ex: KEEP_DAYS * 86400 })),
    lock: async (k) => (await redis.set(k, "1", { nx: true, ex: 60 } /* closing = price check + one capture per person */)) === "OK",
    unlock: async (k) => void (await redis.del(k)),
  };
}

function fileStore(): Store {
  const dir = path.join(process.cwd(), ".dev-groups");
  const file = (k: string) => path.join(dir, `${k.replace(/[^a-z0-9-]/gi, "_")}.json`);
  return {
    get: async (k) => JSON.parse(await fs.readFile(file(k), "utf8").catch(() => "null")),
    set: async (k, v) => {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file(k), JSON.stringify(v, null, 2));
    },
    lock: async (k) => {
      await fs.mkdir(dir, { recursive: true });
      return fs.writeFile(file(k), "1", { flag: "wx" }).then(
        () => true,
        () => false,
      );
    },
    unlock: (k) => fs.rm(file(k), { force: true }),
  };
}

const store =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? redisStore(Redis.fromEnv()) : fileStore();

const key = (id: string) => `gifted:group:${id}`;
const ID_CHARS = "abcdefghijkmnpqrstuvwxyz23456789"; // no look-alikes (l/1, o/0)

async function load(id: string): Promise<Group | null> {
  if (!/^[a-z0-9]{10}$/.test(id)) return null;
  return store.get(key(id));
}

async function save(group: Group) {
  await store.set(key(group.id), group);
}

// Two people paying at the same second must not both take the last share
async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const lock = `${key(id)}-lock`;
  for (let i = 0; i < 50; i++) {
    if (await store.lock(lock)) {
      try {
        return await fn();
      } finally {
        await store.unlock(lock);
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("This group gift is busy, please try again");
}

// --- operations ---

export async function createGroup(input: Omit<Group, "id" | "createdAt" | "expiresAt" | "shares" | "contributions" | "shipTo" | "status"> & { people: number }) {
  const { people, ...rest } = input;
  const now = new Date();
  const group: Group = {
    ...rest,
    id: Array.from({ length: 10 }, () => ID_CHARS[randomInt(ID_CHARS.length)]).join(""),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + COLLECT_DAYS * 86400_000).toISOString(),
    shares: splitShares(rest.quote.total, people),
    contributions: [],
    shipTo: null,
    status: "collecting",
  };
  await save(group);
  return group;
}

// Reads a group and releases all reservations if time ran out
export async function getGroup(id: string): Promise<Group | null> {
  const group = await load(id);
  if (!group || group.status !== "collecting" || new Date(group.expiresAt) > new Date()) return group;
  return withLock(id, async () => {
    const fresh = (await load(id))!;
    if (fresh.status === "collecting") await cancel(fresh, "expired");
    return fresh;
  });
}

export function nextShare(group: Group) {
  return group.status === "collecting" ? (group.shares[group.contributions.length] ?? null) : null;
}

// Called when a contributor comes back from PayPal with an authorized share
export async function addContribution(
  id: string,
  c: Omit<Contribution, "at">,
  shipTo: Group["shipTo"],
): Promise<{ group: Group; accepted: boolean }> {
  return withLock(id, async () => {
    const group = await load(id);
    if (!group) throw new Error("Group gift not found");

    // Reloaded return page: already counted
    if (group.contributions.some((x) => x.authorizationId === c.authorizationId)) return { group, accepted: true };

    // Full, closed or the amount doesn't match the open share: release this reservation
    if (group.status !== "collecting" || Math.abs(c.amount - (nextShare(group) ?? -1)) > 0.001) {
      await voidAuthorization(c.authorizationId);
      return { group, accepted: false };
    }

    group.contributions.push({ ...c, at: new Date().toISOString() });
    if (!group.shipTo && shipTo) group.shipTo = shipTo;
    if (group.contributions.length === group.shares.length) await complete(group);
    else await save(group);
    return { group, accepted: true };
  });
}

const closingDeps: ClosingDeps = {
  getProduct,
  quote,
  capture: captureAuthorization,
  refund: refundCapture,
  release: voidAuthorization,
};

// Everyone is in: the agent re-checks price and stock, then collects all shares.
// That's the moment the gift is bought. If anything fails, nobody pays (see closing.ts).
async function complete(group: Group) {
  await closeGroup(group, closingDeps);
  await save(group);
}

async function cancel(group: Group, reason: CancelReason) {
  await releaseAll(group, closingDeps, reason);
  await save(group);
}

// What every visitor may see (no addresses, no full PayPal ids)
export function toPublic(group: Group): PublicGroup {
  const { id, createdAt, expiresAt, product, quote, organizer, recipient, invite, shares, status, completedAt } = group;
  return {
    ...{ id, createdAt, expiresAt, product, quote, organizer, recipient, invite, shares, status, completedAt },
    cancelReason: group.cancelReason,
    closing: group.closing,
    contributors: group.contributions.map((c) => ({
      name: c.name,
      amount: c.amount,
      charged: c.refunded ? null : (c.charged ?? null),
      demo: !!c.demo,
      receipt: c.captureId && !c.refunded ? shortReceipt(c.captureId) : null,
    })),
    nextShare: nextShare(group),
  };
}

// --- Demo mode (sandbox only) ---
// Judges can't log in with five PayPal accounts. After at least one real reservation,
// the remaining spots are filled with clearly marked simulated friends and the real
// shares are captured with PayPal as usual.

export const demoMode = () => process.env.DEMO_MODE === "true";

const DEMO_NAMES = ["Anna", "Ben", "Chloe", "David", "Emma", "Finn", "Grace", "Hugo", "Ivy"];

export async function fillWithDemoFriends(id: string) {
  if (!demoMode()) throw new Error("Demo mode is off");
  return withLock(id, async () => {
    const group = await load(id);
    if (!group) throw new Error("Group gift not found");
    if (group.status !== "collecting") return group;
    if (!group.contributions.some((c) => !c.demo)) throw new Error("Chip in yourself first, then let the others join");

    const taken = new Set(group.contributions.map((c) => c.name));
    const names = DEMO_NAMES.filter((n) => !taken.has(n));
    for (let i = group.contributions.length; i < group.shares.length; i++) {
      group.contributions.push({
        name: names.shift() ?? `Friend ${i + 1}`,
        amount: group.shares[i],
        authorizationId: `demo-${i}`,
        orderId: `demo-${i}`,
        at: new Date().toISOString(),
        demo: true,
      });
    }
    await complete(group);
    return group;
  });
}
