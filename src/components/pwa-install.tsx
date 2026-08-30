"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null),
    [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const onPrompt = (event: Event) => {
        event.preventDefault();
        if (localStorage.getItem("roodlab-install-dismissed") === "1") return;
        setPrompt(event as InstallPromptEvent);
      },
      onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt || dismissed) return null;
  const install = async () => {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setPrompt(null);
  };
  const dismiss = () => {
    localStorage.setItem("roodlab-install-dismissed", "1");
    setDismissed(true);
  };

  return (
    <aside className="pwa-install" aria-label="ติดตั้งแอป RoodLab">
      <div className="pwa-install-mark">R</div>
      <div><strong>ติดตั้ง RoodLab</strong><span>เปิดเต็มจอและเข้าถึงจากหน้าหลัก</span></div>
      <button className="pwa-install-action" onClick={() => void install()} type="button"><Download />ติดตั้ง</button>
      <button className="pwa-install-close" aria-label="ปิดคำแนะนำติดตั้ง" onClick={dismiss} type="button"><X /></button>
    </aside>
  );
}
