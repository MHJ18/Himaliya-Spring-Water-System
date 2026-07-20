# Himaliya Admin Mobile

Native React Native/Expo administration app for Himaliya Spring Water. It connects to the same Supabase project and respects the existing row-level security policies.

## Requirements

- Android 10 (API 29) or newer
- Node.js 22 or 24
- An active account in `admin_profiles`

## Configure

Copy `.env.example` to `.env` and supply the same project URL and client-safe publishable/anon key used by the web admin. Never place the service-role key in this app.

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Run and verify

```bash
npm install
npm run typecheck
npx expo start
```

## Build an installable APK

The `apk` EAS profile is already configured to produce an APK rather than an AAB.

```bash
npx eas-cli login
npx eas-cli build --platform android --profile apk
```

Set both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the EAS project environment before the cloud build.

## Mobile modules

The mobile app includes the public landing experience, dashboard visualizations, customer CRUD and photos, detailed purchase ledgers, invoice generation/PDF sharing/validation/payment controls, sales entry, customer order workflow, delivery celebrations, analytics and CSV export, administrator management, detailed customer-user profiles, notifications, messages, live inventory, business settings, bottle prices, and administrator profile/password management. Privileged customer password resets remain protected by the existing server-side admin endpoint; no service key is bundled in the APK.
