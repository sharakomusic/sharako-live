# Android WebView app that opens your live site

This folder contains a minimal Android Studio project (android-app) that opens your site in a WebView.

How to build (recommended for non-technical users):
1. Install Android Studio: https://developer.android.com/studio
2. In Android Studio: File → Open... → select the `android-app` directory in this repository.
3. Let Android Studio sync and download components. If prompted it will suggest installing the Gradle wrapper and SDK components.
4. Build the APK: Build → Build Bundle(s) / APK(s) → Build APK(s).
5. After the build finishes, Android Studio will show a link to the generated APK; or find it at:
   `android-app/app/build/outputs/apk/debug/app-debug.apk`

Install on your device:
- Copy the APK to your device and open it (allow installs from unknown sources), or use adb:
  `adb install -r android-app/app/build/outputs/apk/debug/app-debug.apk`

Notes:
- The app loads https://sharakomusic.github.io/sharako-live in a WebView and requires internet access.
- This is an unsigned debug APK (suitable for testing). If you want a release-signed APK for Play Store, tell me and I can add signing instructions.
