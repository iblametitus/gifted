import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { GroupView } from "@/components/GroupView";
import { Wordmark } from "@/components/Wordmark";
import { demoMode, getGroup, peekGroup, toPublic } from "@/lib/groups";
import { giftFor, timeLeft } from "@/lib/words";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// What the shared link says in a chat (the picture comes from opengraph-image.tsx)
export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { id } = await params;
  const group = await peekGroup(id);
  if (!group) return { title: "Group gift · Gifted" };

  const gift = giftFor(group.recipient);
  const each = `$${(group.shares[0] ?? group.quote.total).toFixed(2)}`;
  const title = `Chip in for ${gift} · Gifted`;
  const description = `${group.organizer} started a group gift: ${group.product.title}. ${each} each, charged only when all ${group.shares.length} are in.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

// The shared link: everyone sees the gift, who's in, and can chip in
export default function GroupPage(props: Props) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6">
      <header className="py-6">
        <Link href="/" className="inline-block">
          <Wordmark />
        </Link>
      </header>
      <Suspense fallback={<p className="pt-12 text-ink/60">Loading group gift…</p>}>
        <Group {...props} />
      </Suspense>
    </div>
  );
}

async function Group({ params, searchParams }: Props) {
  await connection(); // always live: shares and the expiry check change by the minute
  const { id } = await params;
  const query = await searchParams;
  const group = await getGroup(id);
  if (!group) notFound();

  const notice =
    query.joined ? "joined" : query.refused ? "refused" : typeof query.error === "string" ? "error" : null;
  return (
    <GroupView
      group={toPublic(group)}
      notice={notice}
      demo={demoMode()}
      daysLeft={timeLeft(group.expiresAt)}
    />
  );
}
