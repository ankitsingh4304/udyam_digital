"use client";

import { LogOut, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "./AppShell";

export interface BackOfficeUser {
  id: string;
  role: "partner" | "admin";
  name: string;
  city?: string;
}

/** Header for partner and operations panels: who is signed in, what they can see, sign out. */
export function BackOfficeShell({ user, title, children }: { user: BackOfficeUser; title: string; children: ReactNode }) {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-rule bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark small />
            <span className="rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-right text-sm leading-tight">
              <span className="block font-semibold">{user.name}</span>
              <span className="flex items-center justify-end gap-1 text-ink-soft">
                {user.city ? (
                  <>
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> {user.city} only
                  </>
                ) : (
                  "All cities"
                )}
              </span>
            </span>
            {user.role === "admin" && (
              <nav className="hidden gap-1 sm:flex">
                <Link href="/admin" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-page">Dashboard</Link>
                <Link href="/partner" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-page">Leads</Link>
                <Link href="/judge" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-page">Rule tester</Link>
              </nav>
            )}
            <button onClick={logout} className="flex h-10 items-center gap-1.5 rounded-full border-2 border-rule px-3 text-sm font-semibold" aria-label="Sign out">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
