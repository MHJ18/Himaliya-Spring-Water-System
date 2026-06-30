# Himaliya Spring Water Admin

React 18 operations dashboard for Himaliya Spring Water. It manages customers, daily bottle sales, admin access, settings, analytics, CSV/PDF exports, and Supabase-backed persistence.

## Run locally

```bash
npm install --legacy-peer-deps
npm start
```

The development app runs at `http://localhost:3000` unless that port is occupied.

## Environment

Create `.env` with:

```text
REACT_APP_SUPABASE_URL=your-project-url
REACT_APP_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Never place a Supabase service-role key in this client application.

## Main routes

- `/` - animated landing page
- `/login` - Supabase admin sign-in
- `/app/main/dashboard` - operations overview
- `/app/add-customer` - customer creation
- `/app/customers` - customer records and purchase history
- `/app/daily-sales` - sales entry
- `/app/analytics` - business analytics and exports
- `/app/admins` - admin management
- `/app/settings` - business settings and theme

## Database migrations

Reviewed SQL migrations live in `supabase/migrations`. Apply them through the normal Supabase migration workflow after reviewing the target project and taking a backup.
