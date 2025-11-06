import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';

type Language = 'es' | 'en';
type Translations = { [key: string]: string };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('es');
  const [translations, setTranslations] = useState<{ [key in Language]?: Translations }>({});

  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const [esResponse, enResponse] = await Promise.all([
          fetch('/locales/es.json'),
          fetch('/locales/en.json')
        ]);
        if (!esResponse.ok || !enResponse.ok) {
          throw new Error('Failed to fetch translation files');
        }
        const esData = await esResponse.json();
        const enData = await enResponse.json();
        setTranslations({ es: esData, en: enData });
      } catch (error) {
        console.error("Failed to load translation files:", error);
        // Set empty translations to prevent crash, keys will be shown as fallback
        setTranslations({ es: {}, en: {} });
      }
    };

    fetchTranslations();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key: string, replacements?: { [key: string]: string | number }): string => {
    const translationSet = translations[language];
    if (!translationSet || Object.keys(translationSet).length === 0) {
      return key; // Return key if translations are not loaded yet or are empty
    }
    let translation = translationSet[key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([rKey, value]) => {
        translation = translation.replace(`{${rKey}}`, String(value));
      });
    }
    return translation;
  }, [language, translations]);

  const value = { language, setLanguage, t };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
