import { BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import type { Config } from '../config.js';
import { calendarPrintHtml, type CalendarPdfOptions } from '../calendar-print.js';

/** Uses the bundled print engine, fonts and calculations; no web or extra runtime required. */
export async function exportCalendarPdf(config: Config, options: CalendarPdfOptions, destination: string) {
  const html = calendarPrintHtml(config, options);
  const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  printWindow.webContents.on('will-navigate', event => event.preventDefault());
  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await printWindow.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    const pdf = await printWindow.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, generateTaggedPDF: true });
    await writeFile(destination, pdf);
  } finally { if (!printWindow.isDestroyed()) printWindow.destroy(); }
}
