#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createSocket } from 'node:dgram';
import { activeLocation, configSchema, defaultConfig, locationSchema, METHODS, PRAYERS, readConfig, TIMES, type Config, type Prayer } from './config.js';
import { addDays, dateAt, formatTime, parseDate } from './dates.js';
import { fromHijri, islamicDays, toHijri } from './calendar.js';
import { calculateDay, nextPrayer } from './prayers.js';
import { calendarCsv, calendarIcs, calendarRows } from './exports.js';
import { BUILTIN_LOCATIONS, importLegacy, searchLegacyCities } from './locations.js';
import { doctor, runService, requestStop } from './service.js';
import { eventsForDay } from './scheduler.js';
import { Ledger, writeJson } from './storage.js';
import { playFile } from './audio.js';
import { setStartup, startupCommand } from './startup.js';
import { searchOnline } from './geocoding.js';
import { athanText, DUA_AFTER_ATHAN, PRAYER_UNITS } from './reference.js';

const program = new Command().name('athan').description('Offline Athan prayer times and scheduling').version('0.1.0')
  .option('-c, --config <file>', 'Configuration file', resolve('.athan/config.json'))
  .option('--state <directory>', 'Scheduler ledger and logs', resolve('.athan/state'));
const output = (value: unknown) => console.log(JSON.stringify(value, null, 2));
const configPath = () => resolve(program.opts().config as string);
const getConfig = () => readConfig(configPath());
const statePath = () => resolve(program.opts().state as string);
function saveConfig(config: Config) { writeJson(configPath(), configSchema.parse(config), true); }
const today = (config: Config) => dateAt(new Date(), activeLocation(config).timeZone);
function instant(text?: string): Date {
  if (text && !/(Z|[+-]\d\d:\d\d)$/.test(text)) throw new Error('Instant must include Z or a UTC offset');
  const date = text ? new Date(text) : new Date();
  if (!Number.isFinite(+date)) throw new Error('Invalid ISO timestamp');
  return date;
}
function requirePrayer(name: string): Prayer {
  if (!PRAYERS.includes(name as Prayer)) throw new Error(`Choose: ${PRAYERS.join(', ')}`);
  return name as Prayer;
}

program.command('init').description('Create a configuration; does not start playback or change Windows startup')
  .option('--from-legacy <directory>', 'Import selected city and local recordings')
  .option('--virtual-root <directory>', 'Legacy Windows VirtualStore overrides')
  .option('--timezone <zone>', 'IANA time zone', 'Australia/Melbourne')
  .option('--method <name>', 'Calculation method', 'MuslimWorldLeague')
  .option('--force', 'Replace existing configuration (saved as .bak first)')
  .action(options => {
    let config = defaultConfig();
    if (options.fromLegacy) {
      const virtual = options.virtualRoot ?? (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'VirtualStore', 'Program Files (x86)', 'Athan') : undefined);
      const imported = importLegacy(resolve(options.fromLegacy), { timeZone: options.timezone, method: options.method,
        ...(virtual ? { virtualRoot: virtual } : {}) });
      config = imported.config;
      for (const warning of imported.warnings) console.error(warning);
    } else {
      config.locations[0]!.timeZone = options.timezone;
      config.calculation.method = options.method;
    }
    config = configSchema.parse(config);
    if (existsSync(configPath()) && options.force) writeFileSync(`${configPath()}.bak`, readFileSync(configPath()));
    writeJson(configPath(), config, Boolean(options.force));
    output({ config: configPath(), location: activeLocation(config), method: config.calculation.method });
  });

program.command('times').argument('[date]', 'YYYY-MM-DD').option('--json', 'Machine-readable UTC instants')
  .action((date, options) => {
    const config = getConfig(), day = calculateDay(config, date ?? today(config));
    if (options.json) { output(day); return; }
    console.log(`${activeLocation(config).name} | ${day.date} | ${day.timeZone}`);
    console.log(`${config.calculation.method} / ${config.calculation.madhab} | Hijri ${day.hijri.year}-${day.hijri.month}-${day.hijri.day} (Umm al-Qura)`);
    for (const p of TIMES) console.log(`${p.padEnd(14)} ${formatTime(day.times[p], day.timeZone, config.hour12, config.locale)}`);
    console.log(`Night midpoint ${formatTime(day.middleOfNight, day.timeZone, config.hour12, config.locale)}`);
    console.log(`Last third     ${formatTime(day.lastThirdOfNight, day.timeZone, config.hour12, config.locale)}`);
    for (const warning of day.warnings) console.error(warning);
  });
program.command('next').option('--at <instant>', 'ISO timestamp with offset').action(options => output(nextPrayer(getConfig(), instant(options.at))));
program.command('qibla').action(() => {
  const config = getConfig(); output({ location: activeLocation(config).name, degreesClockwiseFromTrueNorth: calculateDay(config, today(config)).qibla });
});
program.command('methods').action(() => output(METHODS));
program.command('config').description('Show resolved configuration').action(() => output(getConfig()));
program.command('validate').action(() => { getConfig(); console.log('Configuration is valid.'); });
program.command('doctor').action(() => { const checks = doctor(getConfig()); output(checks); if (checks.some(c => !c.ok)) process.exitCode = 1; });

program.command('calendar').description('Export a month, year, or explicit range')
  .option('--month <YYYY-MM>').option('--year <YYYY>').option('--from <date>').option('--to <date>')
  .option('--format <format>', 'json, csv or ics', 'json').option('-o, --out <file>')
  .action(options => {
    const choices = Number(Boolean(options.month)) + Number(Boolean(options.year)) + Number(Boolean(options.from || options.to));
    if (choices > 1) throw new Error('Choose a month, a year, or a from/to range');
    const config = getConfig(); let from: string, to: string;
    if (options.year) { from = `${options.year}-01-01`; to = `${options.year}-12-31`; }
    else if (options.from || options.to) {
      if (!options.from || !options.to) throw new Error('Supply both --from and --to');
      from = options.from; to = options.to;
    } else {
      const month = options.month ?? today(config).slice(0, 7); from = `${month}-01`;
      const first = parseDate(from), end = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
      to = end.toISOString().slice(0, 10);
    }
    let text: string;
    if (options.format === 'csv') text = calendarCsv(config, from, to);
    else if (options.format === 'ics') text = calendarIcs(config, from, to);
    else if (options.format === 'json') text = JSON.stringify(calendarRows(config, from, to), null, 2) + '\n';
    else throw new Error('Format must be json, csv or ics');
    if (options.out) { writeFileSync(resolve(options.out), text, { flag: 'wx' }); console.log(resolve(options.out)); }
    else console.log(text);
  });
program.command('convert').description('Convert Gregorian and Umm al-Qura Hijri dates')
  .option('--gregorian <date>').option('--hijri <YYYY-MM-DD>').option('--adjustment <days>', 'Hijri date correction', '0')
  .action(options => {
    if (Boolean(options.gregorian) === Boolean(options.hijri)) throw new Error('Supply exactly one of --gregorian and --hijri');
    if (options.gregorian) output(toHijri(options.gregorian, Number(options.adjustment)));
    else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(options.hijri)) throw new Error('Hijri date must be YYYY-MM-DD');
      const [year, month, day] = String(options.hijri).split('-').map(Number);
      output({ gregorian: fromHijri(year!, month!, day!, Number(options.adjustment)) });
    }
  });
program.command('islamic-days').argument('<hijri-year>').action(year => output(islamicDays(Number(year), getConfig().hijriAdjustment)));

const locations = program.command('locations').description('Offline locations and manual coordinates');
locations.command('list').action(() => output(getConfig().locations));
locations.command('search').argument('<query>').option('--legacy-root <directory>').option('--country <name>')
  .option('--online', 'Search worldwide via Open-Meteo/GeoNames').option('--country-code <code>', 'Online country filter, e.g. AU')
  .action(async (query, options) => {
    if (options.online && options.legacyRoot) throw new Error('Choose online or legacy search');
    if (options.online) { output(await searchOnline(query, options.countryCode)); return; }
    output(options.legacyRoot ? searchLegacyCities(options.legacyRoot, query, options.country) :
      BUILTIN_LOCATIONS.filter(l => `${l.name} ${l.country}`.toLowerCase().includes(String(query).toLowerCase())));
  });
locations.command('add').requiredOption('--id <id>').requiredOption('--name <name>').option('--country <country>', '', '')
  .requiredOption('--lat <latitude>').requiredOption('--lon <longitude>').requiredOption('--timezone <zone>').option('--select')
  .action(options => {
    const config = getConfig();
    config.locations.push(locationSchema.parse({ id: options.id, name: options.name, country: options.country,
      latitude: Number(options.lat), longitude: Number(options.lon), timeZone: options.timezone }));
    if (options.select) config.activeLocation = options.id;
    saveConfig(config); output(activeLocation(config));
  });
locations.command('use').argument('<id>').action(id => { const config = getConfig(); config.activeLocation = id; saveConfig(config); output(activeLocation(config)); });

program.command('plan').argument('[date]').description('Inspect scheduled events without sending or playing anything')
  .action(date => { const config = getConfig(); output(eventsForDay(config, date ?? today(config))); });
program.command('run').description('Run the scheduler until Ctrl+C')
  .option('--once').option('--dry-run', 'Inspect due events; no state, audio, or network writes')
  .option('--at <instant>', 'Simulated clock for --once')
  .action(async options => {
    if (options.at && !options.dryRun) throw new Error('A simulated clock requires --dry-run; live playback uses the real clock');
    await runService(getConfig(), statePath(), { once: Boolean(options.once), dryRun: Boolean(options.dryRun),
      ...(options.at ? { now: instant(options.at) } : {}) });
  });
program.command('history').option('--limit <count>', '', '50').action(options => {
  const limit = Number(options.limit); if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('History limit must be 1–10000');
  const path = join(statePath(), 'deliveries.sqlite'); if (!existsSync(path)) { output([]); return; }
  const ledger = new Ledger(path); try { output(ledger.history(limit)); } finally { ledger.close(); }
});
program.command('stop').description('Request graceful shutdown of the scheduler in this state directory')
  .action(() => { requestStop(statePath()); console.log('Stop requested. The scheduler will close within its polling interval.'); });
const audio = program.command('audio');
const reference = program.command('reference').description('Text references for the future interface');
reference.command('athan').option('--fajr').action(options => output(athanText(Boolean(options.fajr))));
reference.command('dua').action(() => output(DUA_AFTER_ATHAN));
reference.command('prayer-units').action(() => output({ prayers: PRAYER_UNITS,
  note: 'Common emphasized Sunnah counts as in the legacy reference. Additional voluntary prayers and Witr are not included; details vary by school.' }));
audio.command('set').argument('<prayer>').argument('<file>').action((prayer, file) => {
  const config = getConfig(); config.audio.prayers[requirePrayer(prayer)] = { enabled: true, file: resolve(file) }; saveConfig(config);
});
audio.command('mute').argument('<prayer>').option('--off', 'Enable again').action((prayer, options) => {
  const config = getConfig(); config.audio.prayers[requirePrayer(prayer)].enabled = Boolean(options.off); saveConfig(config);
});
audio.command('test').option('--prayer <name>', '', 'fajr').option('--file <path>')
  .option('--volume <0-100>').option('--seconds <n>', 'Maximum test duration', '5').action(async options => {
    const config = getConfig(); const path = options.file ?? config.audio.prayers[requirePrayer(options.prayer)].file;
    if (!path) throw new Error('No recording is selected');
    const volume = options.volume === undefined ? config.audio.volume : Number(options.volume), maxSeconds = Number(options.seconds);
    if (!Number.isFinite(volume) || volume < 0 || volume > 100 || !Number.isFinite(maxSeconds) || maxSeconds < 1 || maxSeconds > 600) throw new Error('Invalid volume or test duration');
    console.log(await playFile(path, { volume, maxSeconds }));
  });
const startup = program.command('startup');
startup.command('show').action(() => output({ command: startupCommand(configPath(), statePath()), installedByInit: false }));
startup.command('enable').action(() => { getConfig(); setStartup(true, configPath(), statePath()); console.log('Athan Core enabled at Windows sign-in.'); });
startup.command('disable').action(() => { setStartup(false, configPath(), statePath()); console.log('Athan Core disabled at Windows sign-in.'); });

program.command('listen').description('Listen for Athan UDP alerts; prints JSON without executing received content')
  .option('--host <address>', 'Bind address', '127.0.0.1').option('--port <port>', '', '45845')
  .action(options => {
    const port = Number(options.port); if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be 1024–65535');
    const socket = createSocket('udp4');
    socket.on('message', (data, sender) => {
      if (data.length > 4096) return;
      try {
        const event = JSON.parse(data.toString('utf8'));
        if (event.protocol !== 'athan-alert-v1' || typeof event.id !== 'string' || !PRAYERS.includes(event.prayer) || typeof event.at !== 'string') return;
        output({ sender: sender.address, event });
      } catch { /* Ignore unrelated or malformed UDP traffic. */ }
    });
    socket.on('error', error => { console.error(error.message); socket.close(); process.exitCode = 1; });
    socket.bind(port, options.host, () => console.log(`Listening at ${options.host}:${port}`));
    const close = () => socket.close(); process.once('SIGINT', close); process.once('SIGTERM', close);
  });

try { await program.parseAsync(); } catch (error) {
  console.error(`Athan: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1;
}
