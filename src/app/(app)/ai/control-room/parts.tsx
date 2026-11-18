import { Badge } from "@/components/ui";

// How a run is going, as a coloured label.
export function RunStatus({ status }: { status: string }) {
  if (status === "running") return <Badge tone="amber">Working</Badge>;
  if (status === "done") return <Badge tone="teal">Done</Badge>;
  if (status === "stopped") return <Badge>Stopped</Badge>;
  return <Badge tone="red">Didn&apos;t finish</Badge>;
}
