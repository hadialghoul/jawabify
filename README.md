# Jawabify mobile app

React Native + Expo client for Android and iOS. It uses the same Supabase backend as the website, with the same Jawabify design (midnight indigo, electric primary, mobile top bar, and bottom navigation).

## Run it

```sh
cd mobile
npm install
npx expo start
```

Then:

- Press `a` for Android emulator / Expo Go
- Press `i` for iOS simulator / Expo Go
- Scan the QR code in Expo Go on a physical phone

## Native store builds (production)

Expo account: `hadialghoul` · Project: [jawabify](https://expo.dev/accounts/hadialghoul/projects/jawabify)

### 1. Android APK (sideload / test)

```sh
cd mobile
eas build --platform android --profile production-apk
```

First run will ask to generate a keystore — choose **Yes**. When the build finishes, download the `.apk` from the Expo dashboard link and install it on a phone.

Privacy policy for both store listings: https://jawabify.com/privacy
Support URL: https://jawabify.com/contact
Bundle / package: `com.jawabify.app`

### 2. iOS TestFlight

Requires a paid [Apple Developer](https://developer.apple.com) account ($99/year).

```sh
cd mobile
eas build --platform ios --profile production --auto-submit
```

You will be prompted for your Apple ID / app-specific password. After processing in App Store Connect (often 5–30 min), open **TestFlight** on an iPhone to install.

Or build and submit separately:

```sh
eas build --platform ios --profile production
eas submit --platform ios --latest
```

Create the app once in App Store Connect with bundle ID `com.jawabify.app`, then add yourself as a TestFlight tester.

### 3. Play Store internal testing

Create the app in Play Console with package `com.jawabify.app`. Add a Google Play service account JSON as `mobile/play-service-account.json` (never commit it) and grant it release permission.

```sh
cd mobile
npm run build:android:play
npm run submit:android:internal
```

That uploads an `.aab` to the **internal** testing track. Testers install from the Play Store link Play Console gives you. When you are ready for production:

```sh
npm run submit:android
```

That uploads the same build as a **draft** production release so you can finish the store listing before it goes live.

### Profiles

| Profile | Use |
|---|---|
| `production-apk` | Release Android APK for device testing |
| `production` | Store builds (iOS → TestFlight/App Store, Android → Play `.aab`) |
| `preview` | Internal APK / internal iOS |
| `development` | Dev client |

### npm shortcuts

```sh
npm run build:apk
npm run build:ios
npm run build:ios:submit
```

## What is included

- Sign in, sign up, password reset, email verification
- Onboarding (identity, details, WhatsApp connect)
- Real-time chats, media send, AI toggle, flag / block / clear
- Overview, Orders, CRM, Interested, Flagged, Campaigns, AI Issues
- Vertical extra tabs (menu, reservations, listings, leads, etc.)
- Settings (AI knowledge, auto-replies, language) and Account
