# Default browser recordings

These seven MP3 recordings were converted from the user's existing Athan installation at their request. Original filenames and labels are retained in `defaults.json`; no new licence or ownership is asserted for the recordings. The application does not download them from a third-party service at runtime.

To reproduce the conversion on the original Windows installation, run:

```powershell
node scripts/prepare-default-recordings.mjs
```

This explicit import requires FFmpeg and the original local WMA files. Ordinary builds use the checked-in MP3 assets and require neither. Conversion removes container metadata, encodes MP3 at 96 kbps, and generates byte lengths, SHA-256 hashes and content-addressed filenames.

Default selections match the initial desktop choices: Mishary Rashid for Fajr, Al-Aqsa for Dhuhr, Egypt for Asr/Maghrib/Isha, plus the dua and Bismillah. Makkah and Madina remain selectable. Automatic prayers and startup Bismillah remain off initially. Existing browser selections, including silent choices, are preserved. All seven recordings cache automatically in each browser profile; the first-run audio download is approximately 10.5 MB.
