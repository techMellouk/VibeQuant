"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, MessageSquare } from "lucide-react";

const links = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: Activity },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="relative z-30 flex items-center justify-between px-5 sm:px-8 h-14 border-b border-white/6 bg-[#0a0a0b]/80 backdrop-blur-xl">
      <Link href="/" className="group flex items-baseline gap-0.5">
        <span className="text-[15px] font-medium tracking-[-0.02em] text-white/95 transition-colors group-hover:text-white">
          Vibe
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.03em] text-[#6eb6ff] transition-colors group-hover:text-[#8ec8ff]">
          Quant
        </span>
        <span className="ml-2 hidden text-[10px] font-medium uppercase tracking-[0.14em] text-white/25 sm:inline">
          Alpha Arcade
        </span>
      </Link>

      <nav className="flex items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                active
                  ? "bg-white/10 text-white"
                  : "text-[#8a8a8f] hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
