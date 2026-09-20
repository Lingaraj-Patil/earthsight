"use client";

import Link from "next/link";
import { useState } from "react";
import { Radar, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/map", label: "Live Map" },
  { href: "/how-it-works", label: "How It Works" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#07110f]/85 backdrop-blur-md">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group" aria-label="EarthSight home">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 border border-emerald-400/20">
            <Radar className="h-5 w-5 text-emerald-400" strokeWidth={2} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">
            Earth<span className="text-emerald-400">Sight</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-zinc-300 hover:text-white transition-colors es-focus-ring rounded"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:block">
          <Link
            href="/report"
            className="inline-flex items-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors es-focus-ring"
          >
            Report a Hazard
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden text-zinc-200 es-focus-ring rounded p-1"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-[#07110f] px-4 pb-4 pt-2 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/report"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors"
          >
            Report a Hazard
          </Link>
        </div>
      )}
    </header>
  );
}
