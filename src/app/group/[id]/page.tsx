import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { GroupView } from "@/components/GroupView";
import { Wordmark } from "@/components/Wordmark";
import { demoMode, getGroup, toPublic } from "@/lib/groups";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// The shared link: everyone sees the gift, who's in, and can chip in
export default function GroupPage(props: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6">
      <header className="py-6">
        <Link href="/">
          <Wordmark />
        </Link>
      </header>
      <Suspense fallback={<p className="pt-12 text-zinc-500">Loading group gift…</p>}>
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
  return <GroupView group={toPublic(group)} notice={notice} demo={demoMode()} />;
}
