import { writeInvite } from "@/lib/agent";
import { getProduct } from "@/lib/channel3";
import { createGroup } from "@/lib/groups";
import { rateLimit } from "@/lib/guard";
import { splitShares } from "@/lib/shares";
import { quote } from "@/lib/shipping";
import { cleanRecipient, recipientFor } from "@/lib/words";

const MAX_PEOPLE = 10;

// POST /api/groups  { productId, people, organizer, recipient?, reason? }  ->  { id }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const productId = text(body?.productId, 40);
  const organizer = text(body?.organizer, 40);
  const people = Number(body?.people);
  if (!productId || !organizer) return Response.json({ error: "productId and your name are required" }, { status: 400 });
  if (!Number.isInteger(people) || people < 2 || people > MAX_PEOPLE) {
    return Response.json({ error: `A group gift needs 2 to ${MAX_PEOPLE} people` }, { status: 400 });
  }
  // The organizer writes "my brother"; friends read "Titus' brother"
  const ownWords = cleanRecipient(text(body?.recipient, 40)) || null;
  const recipient = ownWords ? recipientFor(ownWords, organizer) : null;
  const limited = await rateLimit(request, "group");
  if (limited) return limited;

  try {
    // Fresh price and stock, never the browser's numbers
    const product = await getProduct(productId);
    if (!product) return Response.json({ error: "This gift is no longer available" }, { status: 409 });
    const q = quote(product);

    const invite = await writeInvite({
      title: product.title,
      recipient: ownWords, // the invite is in the organizer's own voice
      organizer,
      share: splitShares(q.total, people)[0],
      people,
    }).catch((error) => {
      console.error(error);
      return `I'm putting together a group gift${ownWords ? ` for ${ownWords}` : ""}: ${product.title}. Chip in your share. Nobody is charged unless everyone joins.`;
    });

    const group = await createGroup({
      product: {
        id: product.id,
        title: product.title,
        brand: product.brand,
        merchant: product.merchant,
        imageUrl: product.imageUrl,
        reason: text(body?.reason, 600) ?? "",
      },
      quote: q,
      organizer,
      recipient,
      invite,
      people,
    });
    return Response.json({ id: group.id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not create the group" }, { status: 502 });
  }
}
