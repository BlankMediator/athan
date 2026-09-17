import type { DevotionLibrary } from '../../../src/devotion-content.js';
import edition from '../../../assets/devotion/hisn/edition.json?raw';
import hadiths from '../../../assets/devotion/hadiths.json?raw';
export const library: DevotionLibrary = { duas: JSON.parse(edition).duas, hadiths: JSON.parse(hadiths) };
