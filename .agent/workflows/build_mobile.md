---
description: How to build the Mobile App for Android/iOS
---

# Building the Mobile Application

Since this project uses native modules (like `expo-camera`, `expo-location`), you need to build a binary. You can use **EAS Cloud Build** (easiest, runs on Expo servers) or **Local Build** (faster if you have a powerful machine).

## Prerequisites
1.  **Install EAS CLI**:
    ```bash
    npm install -g eas-cli
    ```

2.  **Login to Expo**:
    ```bash
    eas login
    ```

3.  **Configure Build** (One time only):
    ```bash
    eas build:configure
    ```

## Option 1: EAS Cloud Build (Recommended for Ease)
Builds run on Expo's servers. No need for Android Studio/Xcode locally.

1.  **Build APK (Android)**:
    ```bash
    eas build -p android --profile production
    ```
    - Select "Yes" to generate new keystore if asked.
    - Wait for the queue (free tier has wait times).
    - Download link will be provided at the end.

## Option 2: Local Build (Recommended for Speed)
Builds run on your machine. Requires Android SDK/Java configured.

1.  **Build APK Locally**:
    ```bash
    eas build -p android --profile production --local --output mobile-app.apk
    ```
    - Faster (no queue).
    - Harder to setup (needs environment).

## Option 2: Production Build (For Release)
This generates the final `.apk` or `.aab` for the Play Store.

1.  **Build APK (Side-loading)**:
    Modify `eas.json` to include a preview profile (or use default preview):
    ```json
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
    ```
    Run:
    ```bash
    eas build -p android --profile preview
    ```

2.  **Build AAB (Play Store)**:
    ```bash
    eas build -p android --profile production
    ```

## Notes on Face Detector
- We have currently disabled `expo-face-detector` to allow the app to run in standard **Expo Go** mode for basic testing.
- The `FaceEmbeddingService.ts` is running in "Simulation Mode" (always detects a face, generates fake embeddings).
- To restore full functionality later:
  1. `npm install expo-face-detector`
  2. Update `FaceEmbeddingService.ts` to implement the actual logic.
  3. Create a **Development Build** as described above.
