"use client";

import { useEffect } from "react";
import { rememberFilters } from "./actions";

// Saves the register's current filters, so they're there next time.
export default function RememberFilters({ query }: { query: string }) {
  useEffect(() => {
    void rememberFilters(query);
  }, [query]);
  return null;
}
