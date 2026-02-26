import type { NavigationItem } from "@/config/navigation";
import Link from "next/link";
import styles from "./admin-shell.module.css";

function menuIconClass(icon: NavigationItem["icon"]): string {
  switch (icon) {
    case "dashboard":
      return styles.menuDashboard;
    case "eventManagement":
      return styles.menuEvent;
    case "report":
      return styles.menuReport;
    case "approvalAdmin":
      return styles.menuApproval;
    case "bestComments":
      return styles.menuBestComments;
    case "masterBu":
      return styles.menuMasterBu;
    case "masterDivisi":
      return styles.menuMasterDivisi;
    case "masterDepartment":
      return styles.menuMasterDepartment;
    case "masterFunction":
      return styles.menuMasterFunction;
    case "masterAplikasi":
      return styles.menuMasterAplikasi;
    case "mappingDeptAplikasi":
      return styles.menuMappingDept;
    case "mappingFunctionAplikasi":
      return styles.menuMappingFunction;
    case "masterUser":
      return styles.menuMasterUser;
    default:
      return styles.menuDashboard;
  }
}

const menuOrder = ["MAIN", "EVENT", "APPROVAL", "MASTER", "MAPPING"] as const;

type GroupedMenu = Partial<Record<(typeof menuOrder)[number], NavigationItem[]>>;

interface AdminSidebarProps {
  menu: NavigationItem[];
  pathname: string;
}

export default function AdminSidebar({ menu, pathname }: AdminSidebarProps) {
  const groupedMenu = menu.reduce<GroupedMenu>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group]?.push(item);
    return acc;
  }, {});

  return (
    <aside className={styles.sidebar}>
      <ul className={styles.menu}>
        {menuOrder.map((groupName) => {
          const items = groupedMenu[groupName] || [];
          if (items.length === 0) return null;

          return (
            <li key={groupName}>
              <div className={styles.menuTitle}>{groupName}</div>
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      styles.menuLink,
                      menuIconClass(item.icon),
                      active ? styles.menuLinkActive : "",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}