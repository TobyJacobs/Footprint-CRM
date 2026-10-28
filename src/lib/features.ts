import {
  BarChart3,
  Briefcase,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Newspaper,
  Palette,
  Map,
  Settings,
  Sparkles,
  Target,
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
  // Other addresses that also light this item up in the menu.
  alsoActive?: string[];
  // Shown in the menu as separate links that share this feature's permission
  // (e.g. Sales and Operations, which both live under /sales).
  menuLinks?: { label: string; href: string; icon: LucideIcon; section: string }[];
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
    key: "hub",
    label: "Staff hub",
    href: "/hub",
    icon: Target,
    description: "Your month at a glance: your progress against target, your commission and your recent work.",
    wave: 2,
  },
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
    key: "support",
    label: "Customer support",
    href: "/support",
    icon: LifeBuoy,
    description: "Change requests and questions customers send from their portal, and our replies.",
    wave: 6,
  },
  {
    key: "quotes",
    label: "Sales & Operations",
    href: "/sales",
    icon: FileText,
    description:
      "Quotes approved online, sales orders, purchase orders, invoices, subscription billing and payments, sent to Xero.",
    wave: 2,
    replaces: "Zoho Books",
    menuLinks: [
      { label: "Sales", href: "/sales/overview", icon: FileText, section: "sales" },
      { label: "Operations", href: "/sales/orders", icon: ClipboardList, section: "operations" },
    ],
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
    key: "ai",
    label: "FootprintAI",
    href: "/transition",
    alsoActive: ["/ai"],
    icon: Sparkles,
    description:
      "The FootprintAI programme: the transition (this week's actions, the register and timeline) and the agents and systems we're building and scoring. Invite only.",
    wave: 4,
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
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    description: "Reports across the whole business (the old custom HTML reports).",
    wave: 7,
    replaces: "Custom HTML sites",
  },
  {
    key: "marketing",
    label: "Marketing",
    href: "/marketing",
    icon: Megaphone,
    description: "Client marketing work: jobs, retainers, the content calendar and ad campaigns.",
    wave: 8,
    replaces: "GoHighLevel (internal use)",
  },
  {
    key: "roadmap",
    label: "Roadmap",
    href: "/roadmap",
    icon: Map,
    description: "Where the platform is up to, wave by wave, and where to send suggestions and bugs.",
    wave: 0,
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
