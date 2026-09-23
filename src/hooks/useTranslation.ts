import en from '../locales/en.json';
import es from '../locales/es.json';
import { usePreferencesStore } from '../store/preferencesStore';
export type TranslationKey = keyof typeof en;
const dictionaries: Record<'en' | 'es', Record<TranslationKey, string>> = { en, es };
export function useTranslation() {
  const { language, setLanguage } = usePreferencesStore();
  return { language, setLanguage, t: (key: TranslationKey) => dictionaries[language][key] };
}
