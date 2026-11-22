"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** UI state shared by the storefront chrome: the mobile category menu (hamburger and the "Ангилал" tab). */
interface ShellContextValue {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const value = useMemo(() => ({ menuOpen, openMenu, closeMenu }), [menuOpen, openMenu, closeMenu]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell() must be used inside <ShellProvider>.");
  return ctx;
}
