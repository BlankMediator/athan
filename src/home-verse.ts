import { resolveLanguage } from './localization.js';
/** Verbatim excerpts from Quran 13:28; shared by the home page and print layouts. */
const excerpts = {
  en: { text: 'Surely in the remembrance of Allah do hearts find comfort.', translator: 'Dr. Mustafa Khattab, The Clear Quran', url: 'https://quran.com/13/28' },
  ar: { text: 'أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ', translator: '', url: 'https://quran.com/13/28' },
  ur: { text: 'آگاہ ہوجاؤ ! اللہ کے ذکر کے ساتھ ہی دل مطمئن ہوتے ہیں', translator: 'بیان القرآن (ڈاکٹر اسرار احمد)', url: 'https://quran.com/ur/ar-rad/28' },
  tr: { text: "Dikkat edin, kalbler ancak Allah'ı anmakla huzura kavuşur.", translator: 'Diyanet', url: 'https://quran.com/tr/rad/28' },
  id: { text: 'Ingatlah, hanya dengan mengingat Allah hati menjadi tenteram.', translator: 'Kementerian Agama RI', url: 'https://quran.com/id/guruh-petir/28' },
  fr: { text: "N'est ce point par l'évocation d'Allah que se tranquillisent les cœurs ?", translator: 'Muhammad Hamidullah', url: 'https://quran.com/fr/le-tonnerre/28' },
};
export const homeVerse = (locale: string) => excerpts[resolveLanguage(locale, [locale])];
