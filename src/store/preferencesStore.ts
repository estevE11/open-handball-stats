import { create } from "zustand";
import type { Language } from "../types/match";
function initialLanguage(): Language {
  try {
    return localStorage.getItem("ohm.language") === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}
export const usePreferencesStore = create<{
  language: Language;
  setLanguage: (language: Language) => void;
}>((set) => ({
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
