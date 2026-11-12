"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, DumbbellIcon } from "./icons";

const tabs = [
  { href: "/", label: "Hoy", Icon: CalendarIcon },
  { href: "/entreno", label: "Entreno", Icon: DumbbellIcon },
];

export default function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Secciones">
      <div className="tabbar-inner">
        {tabs.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="tab" aria-current={path === href ? "page" : undefined}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
