# Third-party components

This project uses pinned dependencies; their complete license texts remain in `node_modules` after installation.

- `adhan` — Batoul Apps, MIT. [Repository and license](https://github.com/batoulapps/adhan-js). Astronomical calculations, prayer presets and Qibla bearing.
- `zod` — MIT. Runtime configuration validation.
- `commander` — MIT. Command-line argument handling.
- `typescript` — Apache-2.0. Development compiler.
- `@types/node` — MIT. Development type declarations. Its `undici-types` dependency is MIT.
- `@typescript/typescript-win32-x64` — Apache-2.0; native compiler dependency of the installed TypeScript version.
- `electron` — MIT; includes Chromium, Node.js, and their third-party notices in `node_modules/electron/dist/LICENSES.chromium.html`.
- `react`, `react-dom` — MIT. Desktop interface.
- `lucide-react` — ISC. Interface icons.
- Manrope — SIL Open Font License 1.1, The Manrope Project Authors. Bundled locally through `@fontsource-variable/manrope`.
- Noto Sans Arabic — SIL Open Font License 1.1, The Noto Project Authors. Bundled locally through `@fontsource-variable/noto-sans-arabic`, including its Arabic and Urdu glyphs.
- Cormorant Garamond — SIL Open Font License 1.1, The Cormorant Project Authors. Bundled locally through `@fontsource/cormorant-garamond`.
- `vite`, `@vitejs/plugin-react` — MIT. Desktop renderer build tools.
- `@playwright/test` — Apache-2.0. Electron interaction tests.
- `@types/react`, `@types/react-dom` — MIT. Development type declarations.

Node.js supplies ICU date/time-zone and Umm al-Qura conversion data and the SQLite runtime. Windows supplies the system media decoder through `System.Windows.Media.MediaPlayer`; see [Microsoft's API reference](https://learn.microsoft.com/en-us/dotnet/api/system.windows.media.mediaplayer?view=netframework-4.8.1).

The seven default browser recordings in `assets/audio` were converted from the user's existing Athan installation at their request. Original filenames and labels are preserved in `assets/audio/defaults.json`; no new licence or ownership is asserted for those recordings. See [the recording notes](assets/audio/README.md). No original executable code, translations or artwork are included. The optional desktop importer references recordings from the user's existing installation and reads its city data locally. Users can also supply their own recordings.

The geometric Athan mark, landscape, and compass illustration are original code-drawn artwork in this project. Fonts, icons, and artwork load locally; the desktop UI does not contact a font CDN.

Optional online geocoding uses [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api) with location data from [GeoNames](https://www.geonames.org/). Attribution accompanies search results. The public endpoint is for noncommercial use; commercial distribution needs the appropriate service terms. Traditional Arabic prayer wording is supplied as reference data with newly written English glosses.


## Hisnul Muslim and hadith data

The current Hisnul Muslim edition is derived from the bundled Sunnah.com snapshot in [majmoo-io/hisnu-al-muslim-data](https://github.com/majmoo-io/hisnu-al-muslim-data), revision `8786672f2a89115f13d5a27765066378993bd358`, under its AGPL-3.0 licence. Original text, references, chapter/entry numbering and direct [Sunnah.com](https://sunnah.com/hisn) URLs are preserved. See `assets/devotion/hisn/LICENSE-AGPL-3.0.txt`, `source-metadata.json`, and the reproducible importer `scripts/build-hisn.py`. The source includes an additional entry 75a alongside 75, giving 268 entries across 132 chapters. Instruction-only entries have no invented transliteration. Changes consist of extraction into application JSON and normalized whitespace; source texts are not machine-translated.

Optional collection packs merge pinned snapshots from [CheeseWithSauce/HadithsJSONFormat](https://github.com/CheeseWithSauce/HadithsJSONFormat) (MIT), [sehalhussain/Hadith-Dua-assets](https://github.com/sehalhussain/Hadith-Dua-assets) (explicit README reuse permission), and [Jaguar16/open-hadith-data](https://github.com/Jaguar16/open-hadith-data) (CC0 structure with original translation terms retained). Retained notices are in `assets/hadith/LICENSE-*`; [source documentation](docs/hadith-data-sources.md) records revisions, merge rules and known gaps. Source translation rights are not reclassified as CC0. The importer only normalizes markup/whitespace in display text and matches metadata by source wording within each book. Every narration retains source references and a Sunnah.com link. The bundled 12 daily narrations preserve the original Arabic and published English translation, including narrator context and direct source links. This small selection is included under [Sunnah.com’s permission for selected narrations in didactic presentations](https://sunnah.com/about#reproduction). Provenance and text hashes are recorded in `assets/devotion/hadith-sources.json`; only markup and whitespace are normalized.

The former Fitrahive selection files and their MIT notice remain under `assets/devotion/source` as legacy source material; the displayed Hisnul Muslim library now uses the complete edition above.


The localized home/PDF reflection contains short attributed excerpts of Quran 13:28 from Quran.com, using the Arabic text and published English (Mustafa Khattab), Urdu (Israr Ahmad), Turkish (Diyanet), Indonesian (Kemenag) and French (Hamidullah) translations. Exact URLs and translator credits are in `src/home-verse.ts` and [source documentation](docs/hadith-data-sources.md).
