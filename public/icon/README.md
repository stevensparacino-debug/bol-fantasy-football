# BOL Fantasy Football - app icon

## Files
- app-icon.svg - master, 1024 viewBox, square (no built-in rounding)
- app-icon-maskable.svg - art inset to the 80% safe zone for Android adaptive masks
- app-icon-32/180/192/512/1024.png - favicon, apple-touch-icon, PWA manifest
- app-icon-maskable-512/1024.png - manifest purpose: "maskable"
- manifest-snippet.json - drop into the web app manifest

## Head
```html
<link rel="icon" href="/icon/app-icon.svg" type="image/svg+xml">
<link rel="icon" href="/icon/app-icon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/icon/app-icon-180.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#1E2433">
```

iOS masks the square itself, so ship app-icon-180.png unrounded.

## Colors
Graphite ground #1E2433 - Orange #F85E32 - Cyan #7BEDF8 - Ink #0E121A - Slate #353D50
