import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

// Import your translation files
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';

const resources = {
  en: en,
  es: es,
  fr: fr,
  it: it,
};

// Try to detect device language, fallback to 'en'
const detectedLanguageCode = Localization.getLocales()[0]?.languageCode ?? 'en';

// Ensure we only use supported languages or fallback
const initialLanguage = Object.keys(resources).includes(detectedLanguageCode) ? detectedLanguageCode : 'en';

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: initialLanguage, // Use detected language or a default
    fallbackLng: 'en', // Use 'en' if detected language/translation is not available
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    // compatibilityJSON: 'v3', // Removed based on potential i18next updates
  });

export default i18n;