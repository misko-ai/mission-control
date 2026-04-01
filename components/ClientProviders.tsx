"use client";

import { ReactNode, useEffect, useState } from "react";
import { ToastProvider } from "./ui/Toast";
import SearchModal from "./SearchModal";

export default function ClientProviders({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Load theme from API
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.theme === "dark") setTheme("dark");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ToastProvider>
      <SearchModal />
      {children}
    </ToastProvider>
  );
}
