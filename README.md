# Parcel Desk

A responsive Supabase-powered parcel/order dashboard.

## Features in this starter

- Supabase email/password authentication
- Owner approval workflow
- Four roles: moderator, admin, owner, editor
- Sequential order numbers from 1001
- 11-digit phone validation
- Customer phone history
- Order search
- Exchange/return/completed/cancelled statuses
- Admin/Owner order closing via database `close_order()`
- Notifications and activity-log database integration
- Responsive mobile layout

## Run locally

1. Install Node.js.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put your Supabase project URL and publishable/anon key in `.env`.
5. Run `npm run dev`.

Never put a Supabase service-role key in this frontend.
