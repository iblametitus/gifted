// Splits a total into n shares that add up exactly (in cents).
// The first shares carry the leftover cents: $100 / 3 -> 33.34, 33.33, 33.33.

export function splitShares(total: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1) throw new Error("n must be a positive integer");
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}
