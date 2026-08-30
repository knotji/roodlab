import type { ReactNode } from "react";

export function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="settings-section"><header><h3>{title}</h3>{description && <p>{description}</p>}</header>{children}</section>;
}
