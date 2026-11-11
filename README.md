# Malen

Kids' drawing PWA for touch screens. Bun static server, no dependencies, no build step.

- `public/index.html` – the whole app (inline CSS/JS). 2400×1800 document; paint layer below the template, which is multiply-blended on top so white areas let colour through and black lines stay visible.
- `public/templates/<id>.svg` – 1600×1200 coloring pages. Black strokes and white fills only; dark pixels are bucket-fill boundaries. Third-party pages are CC0/public domain, listed in `public/templates/CREDITS.md`. Import new ones with `python3 scripts/normalize-template.py source.svg=public/templates/<id>.svg`, then add `<id>` to `TEMPLATES` in `index.html` and `sw.js` and bump `CACHE`. Check the bucket doesn't leak: sketchy outlines with gaps are unusable.
- `public/sw.js` – cache-first service worker, precaches everything, works offline. Bump `CACHE` when assets change.
- `src/server.ts` – static server for `public/` (`PORT`, default 8790).

Controls: one finger draws, two fingers zoom and pan (mouse: wheel zooms, right-drag pans). The drawing is saved in IndexedDB.

Donations: the heart in the template picker opens a "Buy me a coffee" modal (PayPal hosted button `7TRVZVKH42ZM6`, user-entered amount). It only appears over HTTPS or under the service worker, is gated behind a random multiplication for grown-ups, and loads the PayPal SDK only after the gate is solved; PayPal requests are never cached by the service worker.

## Android app

`android/` wraps the web app in a full-screen WebView, built without Gradle like `../teeth` (aapt2, javac, d8, zipalign, apksigner; needs the Android SDK at `$ANDROID_HOME` or `/data/android-sdk`):

```bash
bun android/build.ts      # → android/build/malen.apk, copied to public/malen.apk
/data/android-sdk/platform-tools/adb install -r android/build/malen.apk
```

The bundled `public/` files are served from a fake `https://appassets.malen.local/` origin (not `file://`), so the bucket tool can read canvas pixels and the drawing persists in IndexedDB. Inside the app (`window.AndroidBridge`) there is no service worker, no full-screen prompt and no APK button, and the donate gate opens PayPal's hosted page in the system browser. The picker's download button appears only where `malen.apk` exists (GitHub Pages, or after a local build).

Signing: `android/malen-debug.keystore` (alias `malen`, password `android`, gitignored). CI uses the repository secret `ANDROID_KEYSTORE_B64` (`base64 -w0 android/malen-debug.keystore`); without it every CI build gets a throwaway key and can't update an installed copy. The CI run number is the versionCode.

## Deploy

```bash
systemctl --user restart draw                 # ~/.config/systemd/user/draw.service, port 8790
tailscale serve --service=svc:draw --https=443 --bg http://127.0.0.1:8790   # first time: approve svc:draw in the admin console
```

URL: https://draw.anchovy-crocodile.ts.net/ (Tailscale service `svc:draw`; HTTPS is needed for the service worker and installing the app.)

Public: https://lordvlad.github.io/draw/ — `.github/workflows/pages.yml` publishes `public/` on every push to `main` (repo Settings → Pages → Source: GitHub Actions). All URLs are relative, so the app works under the `/draw/` subpath.
