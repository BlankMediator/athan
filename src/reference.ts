/** Traditional Arabic wording; English glosses supplied for this project. */
export function athanText(fajr = false) {
  const lines = [
    { arabic: 'الله أكبر', transliteration: 'Allahu akbar', meaning: 'Allah is greatest.', repetitions: 4 },
    { arabic: 'أشهد أن لا إله إلا الله', transliteration: 'Ashhadu an la ilaha illa Allah', meaning: 'I testify that none is worthy of worship except Allah.', repetitions: 2 },
    { arabic: 'أشهد أن محمدا رسول الله', transliteration: 'Ashhadu anna Muhammadan rasul Allah', meaning: 'I testify that Muhammad is the Messenger of Allah.', repetitions: 2 },
    { arabic: 'حي على الصلاة', transliteration: 'Hayya ala as-salah', meaning: 'Come to prayer.', repetitions: 2 },
    { arabic: 'حي على الفلاح', transliteration: 'Hayya ala al-falah', meaning: 'Come to success.', repetitions: 2 },
  ];
  if (fajr) lines.push({ arabic: 'الصلاة خير من النوم', transliteration: 'As-salatu khayrun min an-nawm', meaning: 'Prayer is better than sleep.', repetitions: 2 });
  lines.push({ arabic: 'الله أكبر', transliteration: 'Allahu akbar', meaning: 'Allah is greatest.', repetitions: 2 },
    { arabic: 'لا إله إلا الله', transliteration: 'La ilaha illa Allah', meaning: 'None is worthy of worship except Allah.', repetitions: 1 });
  return lines;
}
export const DUA_AFTER_ATHAN = {
  arabic: 'اللهم رب هذه الدعوة التامة والصلاة القائمة آت محمدا الوسيلة والفضيلة وابعثه مقاما محمودا الذي وعدته',
  meaning: 'O Allah, Lord of this complete call and the established prayer, grant Muhammad al-Wasilah and excellence, and raise him to the praised station You promised him.',
};
export const PRAYER_UNITS = [
  { prayer: 'fajr', obligatory: 2, emphasizedSunnahBefore: 2, emphasizedSunnahAfter: 0 },
  { prayer: 'dhuhr', obligatory: 4, emphasizedSunnahBefore: 4, emphasizedSunnahAfter: 2 },
  { prayer: 'asr', obligatory: 4, emphasizedSunnahBefore: 0, emphasizedSunnahAfter: 0 },
  { prayer: 'maghrib', obligatory: 3, emphasizedSunnahBefore: 0, emphasizedSunnahAfter: 2 },
  { prayer: 'isha', obligatory: 4, emphasizedSunnahBefore: 0, emphasizedSunnahAfter: 2 },
] as const;
