// Protection for the public demo: limits per IP and per day for everything that costs money
// (Claude, Channel3), plus the public URL for PayPal's return links.

import { Redis } from "@upstash/redis";

type Rule = { perIpPerHour: number; allPerDay: number };

// Search = several Claude calls + Channel3 queries. Group = one Claude call (the invite).
// Checkout only talks to PayPal Sandbox, so it gets a generous limit against plain abuse.
export const LIMITS = {
  search: { perIpPerHour: 20, allPerDay: 400 },
  group: { perIpPerHour: 10, allPerDay: 200 },
  checkout: { perIpPerHour: 40, allPerDay: 1000 },
} satisfies Record<string, Rule>;

export type LimitName = keyof typeof LIMITS;

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;
const memory = new Map<string, { count: number; resetAt: number }>(); // local dev without Redis

async function hit(key: string, windowSeconds: number) {
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count;
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }
  return ++entry.count;
}

export function clientIp(request: Request) {
  // Render (and most proxies) put the real client first in x-forwarded-for
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

// Returns a 429 response when the limit is reached, otherwise null.
// If the counter store fails, the request goes through: the demo should not break over a counter.
export async function rateLimit(request: Request, name: LimitName): Promise<Response | null> {
  if (process.env.RATE_LIMIT === "off") return null;
  const rule = LIMITS[name];
  const hour = Math.floor(Date.now() / 3_600_000);
  const day = new Date().toISOString().slice(0, 10);
  try {
    const [perIp, all] = await Promise.all([
      hit(`gifted:rl:${name}:ip:${clientIp(request)}:${hour}`, 3600),
      hit(`gifted:rl:${name}:all:${day}`, 86_400),
    ]);
    if (perIp > rule.perIpPerHour) {
      return Response.json({ error: "Too many requests from your network. Please try again in an hour." }, { status: 429 });
    }
    if (all > rule.allPerDay) {
      return Response.json({ error: "The demo has reached today's limit. Please try again tomorrow." }, { status: 429 });
    }
  } catch (error) {
    console.error("rate limit store failed", error);
  }
  return null;
}

// Public base URL for PayPal return links. Behind Render's proxy the request URL is internal
// (http, internal host), so APP_URL wins; otherwise the forwarded headers; locally the request itself.
export function publicOrigin(request: Request) {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (host && proto) return `${proto}://${host}`;
  return new URL(request.url).origin;
}
