import type { Config, Location } from '../config.js';
import type { DailyTimes } from '../prayers.js';
import type { Country, CityResults } from '../city-catalogue.js';
import type { CalendarEvent, HijriDate } from '../calendar.js';
import type { CalendarPdfOptions } from '../calendar-print.js';
import type { CompassState, DevicePosition } from '../device.js';
import type { DailyReminder, DevotionLibrary, ReadingAlert, ReadingTarget } from '../devotion.js';
import type { CalendarMonthInput, CalendarKind } from '../calendar-period.js';
import type { HadithStatus, DownloadedHadith } from '../hadith-library.js';
export interface DeviceLocation extends DevicePosition { location: Location; distanceKm: number; }
export type ConversionRequest = { calendar: 'gregorian'; date: string } | { calendar: 'hijri'; year: number; month: number; day: number };
export interface ConvertedDate { gregorian: string; hijri: HijriDate; }
export type Serialized<T> = T extends Date ? string : T extends Array<infer U> ? Serialized<U>[] : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;
export type Day = Serialized<DailyTimes>;
export interface Preferences {
  theme: 'light' | 'dark' | 'system'; closeToTray: boolean; notifications: boolean; resumeAlerts: boolean;
  dailyHadith: DailyReminder; dailyDua: DailyReminder; favoriteDuas: string[];
  calendar: CalendarKind; language: 'system' | 'en' | 'ar' | 'ur' | 'tr' | 'id' | 'fr';
}
export interface Snapshot {
  config: Config; day: Day; today: string; now: string;
  deviceLanguages: string[];
  next: { prayer: string; at: string; date: string; secondsRemaining: number } | null;
  preferences: Preferences; startupEnabled: boolean;
  readingAlerts: ReadingAlert[]; readingError: string | null;
  runtime: { status: 'paused' | 'running' | 'external'; error: string | null; playing: string | null; audioPaused?: boolean; audioLoading?: boolean; alerts: { id: string; title: string }[] };
  history: { id: string; scheduled: string; claimed: string; status: string; detail: string }[];
  observances: { name: string; date: string; estimated: boolean }[];
}
export interface Recording { name: string; path: string; group: string; }
export interface DesktopAPI {
  hadithStatus(): Promise<HadithStatus>;
  hadithConnect(key: string): Promise<void>;
  hadithDownload(id: string): Promise<void>;
  hadithSaveAll(): Promise<void>;
  hadithCancel(): Promise<void>;
  hadithRemove(id: string): Promise<void>;
  hadithRead(id: string): Promise<DownloadedHadith | null>;
  hadithSource(id: string, number?: string): Promise<void>;
  snapshot(date?: string): Promise<Snapshot>;
  month(month: string): Promise<Day[]>;
  calendarMonth(month: CalendarMonthInput): Promise<{ days: Day[]; events: CalendarEvent[] }>;
  calendarEvents(year: number): Promise<CalendarEvent[]>;
  convertDate(request: ConversionRequest): Promise<ConvertedDate>;
  exportPdf(options: CalendarPdfOptions): Promise<string | null>;
  saveConfig(config: Config): Promise<void>;
  preferences(patch: Partial<Preferences>): Promise<void>;
  running(enabled: boolean): Promise<void>;
  dismissAlerts(): Promise<void>;
  pauseAudio(paused: boolean): Promise<void>;
  chooseAudio(selected?: string | null): Promise<string | null>;
  recordings(): Promise<Recording[]>;
  deviceLocation(): Promise<DeviceLocation>;
  compass(enabled: boolean): Promise<void>;
  subscribeCompass(callback: (reading: CompassState) => void): () => void;
  devotionLibrary(): Promise<DevotionLibrary>;
  copyDua(id: string): Promise<void>;
  dismissReading(id: string): Promise<void>;
  openReadingSource(id: string): Promise<void>;
  subscribeReading(callback: (target: ReadingTarget) => void): () => void;
  preview(path: string | null): Promise<void>;
  exportCalendar(month: CalendarMonthInput, format: 'csv' | 'ics'): Promise<string | null>;
  exportedFile(path: string, action: 'open' | 'reveal'): Promise<void>;
  countries(): Promise<Country[]>;
  cities(countryCode: string, query?: string, offset?: number): Promise<CityResults>;
  search(query: string, online: boolean, countryCode?: string): Promise<{ locations: Location[]; attribution?: string; cached?: boolean; cacheWarning?: string }>;
  startup(enabled: boolean): Promise<void>;
  diagnostics(): Promise<{ check: string; ok: boolean; detail: string }[]>;
  window(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
  subscribe(callback: () => void): () => void;
}
