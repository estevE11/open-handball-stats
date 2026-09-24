import { create } from "zustand";
import type { Language } from "../types/match";
function initialLanguage(): Language {
  try {
    return localStorage.getItem("ohm.language") === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}
type Theme = "light" | "dark";
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("ohm.theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Fall back to the device preference. */
  }
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
export const usePreferencesStore = create<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (language: Language) => void;
}>((set) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    set({ theme });
    try {
      localStorage.setItem("ohm.theme", theme);
    } catch {
      /* Theme still switches in memory. */
    }
  },
  language: initialLanguage(),
  setLanguage: (language) => {
    set({ language });
    try {
      localStorage.setItem("ohm.language", language);
    } catch {
      /* Switching still works when preferences cannot persist. */
    }
  },
}));
