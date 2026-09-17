const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');
const invoke = (method: string, ...args: unknown[]) => ipcRenderer.invoke('athan:invoke', method, ...args);
contextBridge.exposeInMainWorld('athan', Object.freeze({
  hadithStatus: () => invoke('hadithStatus'), hadithConnect: (key: string) => invoke('hadithConnect', key),
  hadithDownload: (id: string) => invoke('hadithDownload', id), hadithCancel: () => invoke('hadithCancel'),
  hadithRead: (id: string) => invoke('hadithRead', id), hadithRemove: (id: string) => invoke('hadithRemove', id),
  hadithSource: (id: string, number?: string) => invoke('hadithSource', id, number),
  snapshot: (date?: string) => invoke('snapshot', date),
  month: (month: string) => invoke('month', month),
  calendarMonth: (month: unknown) => invoke('calendarMonth', month),
  calendarEvents: (year: number) => invoke('calendarEvents', year),
  convertDate: (request: unknown) => invoke('convertDate', request),
  exportPdf: (options: unknown) => invoke('exportPdf', options),
  saveConfig: (config: unknown) => invoke('saveConfig', config),
  preferences: (patch: unknown) => invoke('preferences', patch),
  running: (enabled: boolean) => invoke('running', enabled),
  dismissAlerts: () => invoke('dismissAlerts'),
  chooseAudio: (selected?: string | null) => invoke('chooseAudio', selected), recordings: () => invoke('recordings'),
  preview: (path: string | null) => invoke('preview', path),
  deviceLocation: () => invoke('deviceLocation'),
  compass: (enabled: boolean) => invoke('compass', enabled),
  devotionLibrary: () => invoke('devotionLibrary'),
  copyDua: (id: string) => invoke('copyDua', id),
  dismissReading: (id: string) => invoke('dismissReading', id),
  openReadingSource: (id: string) => invoke('openReadingSource', id),
  subscribeCompass: (callback: (value: unknown) => void) => {
    const listener = (_event: unknown, value: unknown) => callback(value); ipcRenderer.on('athan:compass', listener);
    return () => ipcRenderer.removeListener('athan:compass', listener);
  },
  subscribeReading: (callback: (value: unknown) => void) => {
    const listener = (_event: unknown, value: unknown) => callback(value); ipcRenderer.on('athan:open-reading', listener);
    return () => ipcRenderer.removeListener('athan:open-reading', listener);
  },
  exportCalendar: (month: unknown, format: string) => invoke('exportCalendar', month, format),
  exportedFile: (path: string, action: string) => invoke('exportedFile', path, action),
  countries: () => invoke('countries'),
  cities: (countryCode: string, query = '', offset = 0) => invoke('cities', countryCode, query, offset),
  search: (query: string, online: boolean, countryCode?: string) => invoke('search', query, online, countryCode),
  startup: (enabled: boolean) => invoke('startup', enabled), diagnostics: () => invoke('diagnostics'),
  window: (action: string) => invoke('window', action),
  subscribe: (callback: () => void) => {
    const listener = () => callback(); ipcRenderer.on('athan:changed', listener);
    return () => ipcRenderer.removeListener('athan:changed', listener);
  },
}));
