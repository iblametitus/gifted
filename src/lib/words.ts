// Small wording helpers shared by the group page, its metadata and the link preview

// "Lena" -> "Lena's gift", "James" -> "James' gift", "Titus' brother" -> "a gift for Titus' brother"
export function giftFor(recipient: string | null | undefined) {
  const r = cleanRecipient(recipient);
  if (!r) return "a group gift";
  if (/^\p{Lu}[\p{L}'-]*$/u.test(r)) return `${possessive(r)} gift`;
  return `a gift for ${r}`;
}

// "Titus" -> "Titus'", "Anna" -> "Anna's"
export const possessive = (name: string) => `${name}${/s$/i.test(name) ? "'" : "'s"}`;

// Drops what only helps the search: "brother, 30" -> "brother", "Lena (30)" -> "Lena"
export function cleanRecipient(recipient: string | null | undefined) {
  return (recipient ?? "")
    .trim()
    .replace(/\s*[,(-]?\s*(age\s*)?\d{1,3}\s*(years?( old)?|yo)?\)?\s*$/i, "")
    .replace(/[\s,]+$/, "")
    .trim();
}

const DETERMINER = /^(my|our|your|his|her|their|the|a|an)\s/i;

// How the organizer names them in the group dialog: the name, or "my brother" / "our colleague"
export function recipientLabel(recipient: string | null | undefined, group: boolean) {
  const r = cleanRecipient(recipient);
  if (!r || /^\p{Lu}/u.test(r) || DETERMINER.test(r)) return r;
  // "our" only where a group shares the relation (colleague, coach); "our brother" would be odd
  const shared = group && /colleague|boss|manager|teacher|coach|trainer|neighbou?r|team/i.test(r);
  return `${shared ? "our" : "my"} ${r}`;
}

// What the friends read: the organizer's "my brother" is "Titus' brother" to them
export function recipientFor(recipient: string | null | undefined, organizer: string) {
  const r = cleanRecipient(recipient);
  const name = organizer.trim();
  return name ? r.replace(/^my\s+/i, `${possessive(name)} `) : r;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = [...parts[0]][0] ?? "";
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function timeLeft(expiresAt: string, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "ending now";
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} left`;
}
