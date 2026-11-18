import PageSkeleton from "@/components/PageSkeleton";

// Shown instantly while a page loads, so clicks always feel immediate.
export default function Loading() {
  return <PageSkeleton withHeader />;
}
