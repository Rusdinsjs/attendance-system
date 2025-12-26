---
description: How to build the Mobile App for Android/iOS
---

# Building the Mobile Application

Since this project uses native modules (like `expo-camera`, `expo-location`, and potentially `expo-face-detector` in the future), you cannot use the standard "Expo Go" app for advanced features indefinitely. You have two main options:

## Option 1: Development Build (Recommended for Testing)
A "Development Build" is like your own custom version of Expo Go that includes your native libraries.

1.  **Install EAS CLI**:
    ```bash
    npm install -g eas-cli
    ```

2.  **Login to Expo**:
    ```bash
    eas login
    ```

3.  **Configure Build**:
    ```bash
    eas build:configure
    ```

4.  **Create Development Build (Android)**:
    ```bash
    eas build --profile development --platform android
    ```
    - This will generate an `.apk` that you can install on your emulator or device.
    - Run the bundler with: `npx expo start --dev-client`

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
