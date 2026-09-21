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

## Native store builds

```sh
npx eas-cli login
npx eas-cli build --platform android
npx eas-cli build --platform ios
```

## What is included

- Sign in, sign up, password reset, email verification
- Onboarding (identity, details, WhatsApp connect)
- Real-time chats, media send, AI toggle, flag / block / clear
- Overview, Orders, CRM, Interested, Flagged, Campaigns, AI Issues
- Vertical extra tabs (menu, reservations, listings, leads, etc.)
- Settings (AI knowledge, auto-replies, language) and Account
