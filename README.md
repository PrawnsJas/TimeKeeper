# TimeKeeper DTR

A Daily Time Record web app built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- Email/password authentication with Supabase Auth
- User roles: `admin` and `user`
- Punch actions: Time In, Lunch Out, Lunch In, Time Out
- Daily record editing and manual entry
- Paginated DTR table
- Search by date and filter by month
- Total hours calculation with lunch deduction
- Admin access to all records, editing, manual creation, and deletion
- Responsive dashboard with summary cards
- Row-level security policies for Supabase

## Setup

1. Copy `.env.example` to `.env` and fill in your Supabase values.

2. Install dependencies:

```bash
npm install
```

3. Create a Supabase project and apply the schema:

```bash
psql < sql/schema.sql
psql < sql/policies.sql
```

4. Start the app:

```bash
npm run dev
```

5. Open the app in your browser at `http://localhost:5173`

## Supabase Schema

- `users` table stores user profiles and admin roles.
- `dtr` table stores daily punch records.
- Unique constraint prevents duplicate daily records per user.
- Policies enforce row-level security.

## Notes

- New sign-ups create a `user` role by default.
- Admin users can view and manage all employee records.
- Regular users can only manage their own records.
