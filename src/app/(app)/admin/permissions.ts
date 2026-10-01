import { features } from "@/lib/features";

// The actions a role can be granted on each feature.
export const ACTIONS = ["view", "edit", "delete"] as const;

export const actionLabels: Record<(typeof ACTIONS)[number], string> = {
  view: "View",
  edit: "Add & edit",
  delete: "Delete",
};

// Admin access is controlled by the separate "admin" switch on each user,
// not by roles, so it's left out of the permission grid.
export const permissionFeatures = features.filter((f) => f.key !== "admin");
