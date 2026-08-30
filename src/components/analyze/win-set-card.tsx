import type { ReactNode } from "react";

export function WinSetCard({ children }: { children: ReactNode }) {
  return <section className="win-set-card">{children}</section>;
}
