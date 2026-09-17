# Android and iOS

Athan uses Capacitor 8.5.2 to package the shared React interface and calculation core as native apps. It runs entirely on the phone; no PC, LAN server, login, or API key is required.

## Install the Android test build

Version **0.1.1** fixes touch scrolling on pages, lists, and navigation. Install the updated APK over the previous test build to retain your settings.

Copy `output/mobile/Athan-Android.apk` to your Android phone and open it. Allow installation from that source when Android asks. This is a debug-signed build for testing, not a Play Store release. Minimum Android version is 8.0, with Android System WebView 120 or newer.

The initial profile is Coburg, Victoria. Choose your own location in Settings. Automatic Athan starts paused. Enable it to request notification permission and schedule the upcoming days. On Android, use **Allow precise alarms** on Today to grant Alarms & reminders access. Location is requested only when you choose **Use device location**.

## What is included

- Offline prayer calculations, Gregorian/Hijri calendars, Qibla bearing, cities, fonts, Hisnul Muslim, bundled recordings, and hadith collection files.
- Native location permission and GPS, native settings storage, clipboard, external source links, and calendar sharing via the device share sheet.
- System printing / PDF options through Android PrintManager and iOS UIPrintInteractionController. Available paper sizes and PDF saving options depend on the device print UI; the desktop export remains the reference for exact paper layout.
- Phone and tablet layouts, safe areas, touch targets, native launcher icons and splash artwork, and Android back handling.
- Prayer and daily-reading notifications scheduled by the operating system. No server or continuously running JavaScript background task is required.

## Alerts and sound

Full Athan recordings, dua after Athan, and repeated reminder recordings play while the app is open. This version does **not** provide full-length Athan playback while locked or closed. Background notifications are silent by default; system notification settings can override their presentation.

The app schedules up to **59 upcoming prayer/reading notifications plus one refresh reminder**, within the next seven local calendar days. Dense reminder schedules shorten coverage. Today shows the actual final scheduled time in the saved location's time zone. Open Athan regularly to extend it. The final notification asks you to reopen the app. This is a finite schedule, not an indefinite background service.

Schedules refresh on app launch, resume, settings changes, enable/pause, and hourly while visible. Pause cancels prayer/reminder notifications; enabled daily readings remain independent. Disabling notifications cancels all queued notifications. Changed locations, methods, weekday choices, offsets, DST and daily reading times use the same core calculations. A denied permission or scheduling failure appears on Today and in Activity & health.

Android's exact-alarm permission improves timing; reminders use inexact alarms until permission is granted. Doze can limit closely spaced alerts. Force-stop, device power policies, revoked permissions, clock changes while the app is closed, and iOS Focus can affect delivery. Reopen Athan after changing the device clock or notification permissions. Foreground Activity history records playback in the app; it is not proof that the OS displayed every background notification.

Settings live in native Preferences. Imported audio and installed reading-library records use the app's local IndexedDB. Clearing app data or uninstalling removes saved data. Desktop, browser, and mobile profiles are separate. The compass uses available WebView orientation readings and preserves the existing magnetic/true-north distinction; sensor support varies by device.

## Build Android on Windows

Double-click **Build Android.cmd**, or run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1
```

The helper uses the workspace-local Java 21, Android SDK and Gradle cache in `.cache/mobile-tools` when available. Otherwise set `JAVA_HOME` to JDK 21+ and `ANDROID_HOME` to an SDK with platform 36 and build tools. No system PATH change is needed. It rebuilds the UI, syncs the projects, compiles and debug-signs the APK, and copies it to `output/mobile/Athan-Android.apk`.

For Android Studio:

```sh
npm ci --include=dev
npm run mobile:android
```

Use Android Studio 2025.2.1+ with SDK 36. Build a signed release using Android Studio's **Generate Signed App Bundle / APK** when preparing for distribution. Keep the release key private and backed up. The current application ID is `app.athan.companion`; choose the final owned identifier before a store release.

## Build iOS on a Mac

iOS requires macOS and Xcode 26+. The project targets iOS 17+ so offline decompression and the app's modern browser APIs are available. Copy the project source (including `assets`, `ui`, `src`, `ios`, `scripts`, `package.json`, `package-lock.json`, and `capacitor.config.ts`) to your Mac. Reinstall dependencies there; do not copy Windows `node_modules`.

```sh
npm ci --include=dev
npm run mobile:ios
```

In Xcode, choose the **App** target, select your Apple development team in **Signing & Capabilities**, and run on a simulator or connected iPhone. Swift Package Manager resolves the Capacitor plugins. To distribute through TestFlight/App Store, archive with your Apple Developer account and complete the store listing. No Apple credentials or provisioning profiles are included.

Permissions, the privacy manifest, native print bridge, and app artwork are in the iOS project. The iOS native project has been generated and synced on Windows, but it has not been compiled or run in Xcode. Phone-sized browser tests exercise its JavaScript bridge with mocks; they do not replace native device testing.

## Development and validation

```sh
npm run typecheck
npm test
npm run mobile:sync
npm run test:mobile
```

`build:mobile` creates `mobile-ui`; native sync copies it into both projects. Never configure a remote `server.url` for a release: the production app should load its bundled files. Mobile does not register a service worker. Keep `mobile-ui`, `browser-ui`, and `desktop-ui` separate.

Before distribution, test a real device: first launch offline; GPS permission denied/granted; a near-term notification with the app closed; exact-alarm permission revoked; pause and settings changes; reboot on Android; imported audio; native share/print; notification taps; dark mode and large text. Native delivery and print appearance have not yet been verified on physical phones.

References: [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup), [local notifications](https://capacitorjs.com/docs/apis/local-notifications), [native preferences](https://capacitorjs.com/docs/apis/preferences).
