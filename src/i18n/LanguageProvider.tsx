import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { strings, type Language, type StringKey } from './strings';

const DEFAULT_LANGUAGE: Language = 'en';

type LanguageContextValue = {
  language: Language;
  isRTL: boolean;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: StringKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

// The chosen language is saved to a small JSON file so it survives app restarts.
const settingsFile = () => new File(Paths.document, 'settings.json');

function readSavedLanguage(): Language | null {
  try {
    const file = settingsFile();
    if (!file.exists) return null;
    const saved = JSON.parse(file.textSync()) as { language?: string };
    return saved.language === 'ar' || saved.language === 'en' ? saved.language : null;
  } catch {
    return null;
  }
}

function saveLanguage(language: Language) {
  try {
    const file = settingsFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify({ language }));
  } catch (error) {
    console.warn('Could not save language setting', error);
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const saved = readSavedLanguage();
    if (saved) setLanguageState(saved);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    saveLanguage(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isRTL: language === 'ar',
      setLanguage,
      toggleLanguage: () => setLanguage(language === 'en' ? 'ar' : 'en'),
      t: (key) => strings[language][key],
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
