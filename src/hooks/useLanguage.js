import { useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

export const useLanguage = () => {
  const [language, setLanguageState] = useState(localStorage.getItem('logivision_lang') || 'en');

  const setLanguage = (lang) => {
    localStorage.setItem('logivision_lang', lang);
    setLanguageState(lang);
    
    // Broadcast change if needed or just let React state handle it
    window.dispatchEvent(new Event('languageChange'));
  };

  useEffect(() => {
    const handleLangChange = () => {
      setLanguageState(localStorage.getItem('logivision_lang') || 'en');
    };
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  return { t, language, setLanguage };
};
