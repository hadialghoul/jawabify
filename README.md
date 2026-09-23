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
