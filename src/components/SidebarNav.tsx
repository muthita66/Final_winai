"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLink {
    name: string;
    href: string;
}

export default function SidebarNav({ links }: { links: NavLink[] }) {
    const pathname = usePathname();

    return (
        <nav className="space-y-2 flex-1">
            {links.map((link) => {
                const isActive = pathname.startsWith(link.href);

                return (
                    <Link
                        key={link.name}
                        href={link.href}
                        className={`group relative block px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
                            ? "bg-white text-emerald-600 shadow-md ring-1 ring-slate-200/50 scale-[1.02]"
                            : "text-slate-600 hover:bg-white hover:text-emerald-600 hover:shadow-sm"
                            }`}
                    >
                        {isActive && (
                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-emerald-600 rounded-r-full" />
                        )}
                        {link.name}
                    </Link>
                );
            })}
        </nav>
    );
}
