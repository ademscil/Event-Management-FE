import type { UserRole } from "@/types/auth";

export interface NavigationItem {
  label: string;
  href: string;
  roles: UserRole[];
}

export const adminNavigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    roles: ["SuperAdmin", "AdminEvent", "ITLead", "DepartmentHead"],
  },
  {
    label: "Event Management",
    href: "/admin/event-management",
    roles: ["SuperAdmin", "AdminEvent"],
  },
  {
    label: "Master User",
    href: "/admin/master-user",
    roles: ["SuperAdmin"],
  },
];
