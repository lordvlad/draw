#!/usr/bin/env bun
// Lightweight Android APK build without Android Studio / Gradle (same approach as ../teeth):
// aapt2 + javac + d8 (r8.jar) + zip + zipalign + apksigner. Output: android/build/malen.apk, copied to public/malen.apk.
import { $ } from "bun";
import { rm, mkdir, cp } from "node:fs/promises";

process.chdir(import.meta.dir);
$.throws(true);

const sdk = process.env.ANDROID_HOME ?? "/data/android-sdk";
const bt = `${sdk}/build-tools/34.0.0`;
const jar = `${sdk}/platforms/android-34/android.jar`;
const ks = process.env.MALEN_KEYSTORE ?? `${import.meta.dir}/malen-debug.keystore`;
const version = process.env.MALEN_VERSION_CODE ?? "1";

console.log("Cleaning build directory...");
await rm("build", { recursive: true, force: true });
await rm("assets", { recursive: true, force: true });
await mkdir("build/classes", { recursive: true });

// Bundle the web app. sw.js and the APK itself are left out: the WebView serves assets directly.
await cp("../public", "assets", { recursive: true, filter: src => !/(sw\.js|\.apk|\.md)$/.test(src) });

console.log("Compiling Android resources...");
await $`${bt}/aapt2 compile --dir res -o build/res.zip`;

console.log("Linking APK with manifest and assets...");
await $`${bt}/aapt2 link -I ${jar} --manifest AndroidManifest.xml -A assets --min-sdk-version 26 --target-sdk-version 34 --version-code ${version} --version-name 1.${version} -o build/base.apk build/res.zip --java build/gen`;

console.log("Compiling Java sources...");
await $`javac --release 11 -g -cp ${jar} -d build/classes src/app/malen/MainActivity.java build/gen/app/malen/R.java`;

console.log("Dexing with D8...");
// The build-tools d8 crashes on very new JDKs, so prefer the standalone R8 jar when present; otherwise use d8 (JDK 17 on CI).
const classes = (await Array.fromAsync(new Bun.Glob("app/malen/*.class").scan({ cwd: "build/classes" }))).map(f => `build/classes/${f}`);
if (await Bun.file(`${sdk}/r8.jar`).exists()) {
  await $`java -cp ${sdk}/r8.jar com.android.tools.r8.D8 --release --min-api 26 --lib ${jar} --output build ${classes}`;
} else {
  await $`${bt}/d8 --release --min-api 26 --lib ${jar} --output build ${classes}`;
}

console.log("Packaging DEX into APK...");
await $`cp build/base.apk build/unsigned.apk`;
await $`zip -qj build/unsigned.apk build/classes.dex`;

console.log("Aligning APK...");
await $`${bt}/zipalign -f 4 build/unsigned.apk build/aligned.apk`;

if (!(await Bun.file(ks).exists())) {
  console.log("Generating debug keystore...");
  await $`keytool -genkeypair -keystore ${ks} -storepass android -keypass android -alias malen -dname CN=malen -keyalg RSA -keysize 2048 -validity 10000`.quiet();
}

console.log("Signing APK...");
await $`${bt}/apksigner sign --ks ${ks} --ks-pass pass:android --out build/malen.apk build/aligned.apk`.quiet();
await $`cp build/malen.apk ../public/malen.apk`;

const apk = Bun.file("build/malen.apk");
console.log(`Success! Built build/malen.apk (${(apk.size / 1024).toFixed(1)} KB)`);
