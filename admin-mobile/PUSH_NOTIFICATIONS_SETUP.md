# Android rider push notification setup

The app already registers Expo push tokens, stores each rider's alert preferences, and sends newly assigned orders through the Expo Push Service. Expo then routes Android delivery through FCM V1.

Before producing the release APK:

1. Open the [Firebase Console](https://console.firebase.google.com/) and create or select the Himaliya project.
2. Add an Android app with package name `com.himaliyaspring.admin`.
3. Download `google-services.json` into this `admin-mobile` folder.
4. Add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`.
5. In Firebase Project settings → Service accounts, generate a private key.
6. Upload that private service-account JSON to EAS:
   - Run `eas credentials`.
   - Select Android → production → Google Service Account.
   - Choose the FCM V1 push-notification key option.
7. Never commit the private service-account JSON. The common local filenames are ignored by `.gitignore`.
8. Build a physical-device APK and assign a test order after the rider signs in once.

Official guide: [Expo FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)
