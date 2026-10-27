import { redirect } from "next/navigation";

// The edition picker on a flatplan sends ?issue=…; go to that issue's flatplan.
export default async function FlatplanPicker(props: PageProps<"/magazines/flatplan">) {
  const { issue } = await props.searchParams;
  redirect(typeof issue === "string" && /^[0-9a-f-]{36}$/i.test(issue) ? `/magazines/flatplan/${issue}` : "/magazines");
}
