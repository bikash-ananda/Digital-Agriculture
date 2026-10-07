import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  ne: { translation: {
    office: 'कृषि विकास कार्यालय, कास्की',
    government: 'नेपाल सरकार',
    province: 'गण्डकी प्रदेश',
    home: 'गृहपृष्ठ', about: 'हाम्रो कार्यालय', notices: 'सूचना तथा समाचार',
    programs: 'कृषि कार्यक्रम', knowledge: 'कृषि ज्ञान केन्द्र',
    smart: 'स्मार्ट फार्मिङ', learning: 'सिकाइ केन्द्र',
    downloads: 'प्रकाशन / डाउनलोड', gallery: 'ग्यालरी', contact: 'सम्पर्क', login: 'लगइन',
    tagline: 'डिजिटल कृषि तथा स्मार्ट फार्मिङ प्लेटफर्म',
    address: 'बिरौटा, पोखरा, कास्की',
    username: 'प्रयोगकर्ता नाम', password: 'पासवर्ड', loginTitle: 'प्रणालीमा लगइन गर्नुहोस्',
    underDev: 'यो पृष्ठ निर्माणाधीन छ।'
  }},
  en: { translation: {
    office: 'Agriculture Development Office, Kaski',
    government: 'Government of Nepal',
    province: 'Gandaki Province',
    home: 'Home', about: 'Our Office', notices: 'Notices & News',
    programs: 'Agriculture Programs', knowledge: 'Knowledge Center',
    smart: 'Smart Farming', learning: 'Learning Center',
    downloads: 'Publications / Downloads', gallery: 'Gallery', contact: 'Contact', login: 'Login',
    tagline: 'Digital Agriculture & Smart Farming Platform',
    address: 'Birauta, Pokhara, Kaski',
    username: 'Username', password: 'Password', loginTitle: 'Login to the system',
    underDev: 'This page is under development.'
  }}
};

i18n.use(initReactI18next).init({ resources, lng: 'ne', fallbackLng: 'en', interpolation: { escapeValue: false } });
export default i18n;
