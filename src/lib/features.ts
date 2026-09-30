import {
  BarChart3,
  Briefcase,
  FileText,
  Home,
  LayoutDashboard,
  Megaphone,
  Newspaper,
  Palette,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

// Every feature of the platform gets one entry here, and one place in the
// navigation menu. When roles and permissions arrive (Wave 0, part 2), each
// feature's `key` is what a role is granted access to.
export type Feature = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  wave: number;
  replaces?: string;
};

export const home: Feature = {
  key: "home",
  label: "Home",
  href: "/",
  icon: Home,
  description: "Your overview of the platform.",
  wave: 0,
};

export const features: Feature[] = [
  {
    key: "customers",
    label: "Customers",
    href: "/customers",
    icon: Users,
    description:
      "Every customer and contact in one place, with subscriptions, hosting plans and a full activity timeline.",
    wave: 1,
    replaces: "Zoho CRM",
  },
  {
    key: "quotes",
    label: "Quotes & Invoices",
    href: "/quotes",
    icon: FileText,
    description:
      "Quotes approved online, sales orders, purchase orders, invoices, subscription billing and payments, sent to Xero.",
    wave: 2,
    replaces: "Zoho Books",
  },
  {
    key: "projects",
    label: "Projects & Time",
    href: "/projects",
    icon: Briefcase,
    description: "Projects, tasks, who's assigned, and time tracking.",
    wave: 3,
    replaces: "Zoho Projects",
  },
  {
    key: "dashboards",
    label: "Dashboards",
    href: "/dashboards",
    icon: LayoutDashboard,
    description: "Sales, pipeline, revenue, renewals and time reports.",
    wave: 3,
    replaces: "Zoho CRM analytics",
  },
  {
    key: "design",
    label: "Design Workload",
    href: "/design",
    icon: Palette,
    description:
      "Design work items with status, priority markers, attached drafts and notes.",
    wave: 4,
    replaces: "monday.com",
  },
  {
    key: "magazines",
    label: "Magazines",
    href: "/magazines",
    icon: Newspaper,
    description:
      "Forget Me Not editions, issues, ad bookings, flatplans, artwork and advertiser billing.",
    wave: 5,
    replaces: "Mag Manager",
  },
  {
    key: "reports",
    label: "Reports & Intranet",
    href: "/reports",
    icon: BarChart3,
    description: "Reporting dashboards and intranet pages.",
    wave: 7,
    replaces: "Custom HTML sites",
  },
  {
    key: "marketing",
    label: "Marketing",
    href: "/marketing",
    icon: Megaphone,
    description: "Footprint's own email and SMS campaigns and pipelines.",
    wave: 8,
    replaces: "GoHighLevel (internal use)",
  },
  {
    key: "admin",
    label: "Admin",
    href: "/admin",
    icon: Settings,
    description: "Users, teams, roles and permissions, and the audit log.",
    wave: 0,
  },
];

export function findFeature(slug: string): Feature | undefined {
  return features.find((f) => f.href === `/${slug}`);
}
