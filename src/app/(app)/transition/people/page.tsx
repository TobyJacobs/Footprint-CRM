import type { Metadata } from "next";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Card, Notice, inputClass, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loadTransition } from "@/lib/transition";
import { addMember, removeMember } from "../actions";
import { TransitionTabs } from "../parts";

export const metadata: Metadata = { title: "Transition invite list" };

// Who, besides admins and Directors, can see the transition (never the
// board-only actions). Directors and admins manage it.
export default async function TransitionPeople(props: PageProps<"/transition/people">) {
  const user = await getCurrentUser();
  if (user.transitionAccess !== "full") return <NoAccess title="Transition invite list" />;
  const sp = await props.searchParams;
  const data = await loadTransition(user.transitionAccess, user.previewRole);
  const members = data.people.filter((p) => p.is_member);
  const others = data.people.filter((p) => !p.is_member);

  return (
    <>
      <PageHeader title="FootprintAI" intro="The invite list: people who can see and work on the transition, apart from board-only actions." />
      <TransitionTabs />
      <div className="grid max-w-2xl gap-5 px-4 py-6 sm:px-6 lg:px-10">
        <Notice searchParams={sp} />
        <Card title={`Invite list (${members.length})`}>
          {members.length === 0 ? (
            <p className="text-sm text-fp-mid">Nobody yet.</p>
          ) : (
            <ul className="divide-y divide-fp-border text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-semibold">{m.name}</span>
                  <form action={removeMember.bind(null, m.id)}>
                    <button type="submit" className="text-xs font-semibold text-fp-error hover:underline">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addMember} className="mt-4 flex flex-wrap gap-2">
            <select name="directory_id" required defaultValue="" aria-label="Person" className={`${inputClass} w-auto flex-1`}>
              <option value="" disabled>
                Add someone from the staff list…
              </option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" className={secondaryButton}>
              Add
            </button>
          </form>
          <p className="mt-3 text-xs text-fp-mid">
            Admins and Directors always see everything, including board-only actions. Anyone who owns an action can see and update their own actions. People
            on this list need to have signed in to FootprintOS once.
          </p>
        </Card>
      </div>
    </>
  );
}
