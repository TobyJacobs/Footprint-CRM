"use client";

import { useEffect, useRef } from "react";

// Keeps a chat scrolled to its newest message as replies arrive.
export default function ScrollToEnd({ count }: { count: number }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count]);
  return <div ref={end} />;
}
