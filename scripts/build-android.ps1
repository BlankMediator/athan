$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $projectRoot '.cache\mobile-tools'
if (-not $env:JAVA_HOME -or $env:JAVA_HOME -match 'jdk-17') {
    $localJdk = Get-ChildItem (Join-Path $toolRoot 'jdk') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($localJdk) { $env:JAVA_HOME = $localJdk.FullName }
}
if (-not $env:ANDROID_HOME -and (Test-Path (Join-Path $toolRoot 'android-sdk'))) { $env:ANDROID_HOME = Join-Path $toolRoot 'android-sdk' }
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle' }
if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Set JAVA_HOME to JDK 21+ and ANDROID_HOME to your Android SDK, or use Android Studio.' }
Push-Location $projectRoot
try {
    & npm.cmd run mobile:sync
    if ($LASTEXITCODE) { throw 'Mobile build failed' }
    Push-Location (Join-Path $projectRoot 'android')
    try { & .\gradlew.bat assembleDebug --no-daemon --console=plain; if ($LASTEXITCODE) { throw 'Android build failed' } }
    finally { Pop-Location }
    $destination = Join-Path $projectRoot 'output\mobile'
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk') -Destination (Join-Path $destination 'Athan-Android.apk')
    Write-Output "Installable debug APK: $destination\Athan-Android.apk"
} finally { Pop-Location }
