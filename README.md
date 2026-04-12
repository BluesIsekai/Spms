# SPMS - Stock Paper Trading Platform

SPMS is a React + Vite paper trading app with a premium dark, TradingView-inspired dashboard.

It supports authenticated users, virtual wallet tracking, buy/sell simulation, portfolio P/L calculations, watchlist management, and transaction history using Supabase as backend.

## Core Features

- Authentication (Signup, Login, Forgot Password)
- User-scoped data with Supabase Auth + RLS
- Paper wallet with default virtual balance (INR 100000)
- Real-time style price polling from Yahoo Finance
- Functional Buy/Sell trade execution
- Portfolio holdings with live P/L and return calculations
- Transaction history (newest first)
- Watchlist with quick trade actions
- Dashboard summary cards:
  - Virtual Balance
  - Portfolio Value
  - Total P/L
  - Today P/L %

## Tech Stack

- React 19
- Vite 8
- React Router DOM 7
- Supabase JS 2
- Lightweight Charts 5

## Project Structure

- src/pages: Dashboard, Portfolio, Watchlist, Transactions, Settings, Auth pages
- src/components: Sidebar, Navbar, tables, charts, UI primitives
- src/services: auth, portfolio, wallet, settings, search, Yahoo API, Supabase client
- src/hooks: auth, polling, search, socket helpers
- supabase_schema.sql: database schema, RLS policies, triggers

## Environment Setup

Create a .env.local file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

If these are not set or invalid, the Supabase client is not initialized.

## Database Setup (Supabase)

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run the SQL from:
	- supabase_schema.sql

This sets up:

- users
- holdings
- transactions
- watchlist
- paper_wallet
- user_settings
- Row Level Security policies
- Auth-to-public user sync trigger
- Default wallet/settings creation triggers

## Install and Run

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

## Yahoo Finance Proxy

The app uses Vite dev proxy routes configured in vite.config.js:

- /api/yahoo -> query1.finance.yahoo.com
- /api/yahoo-search -> query2.finance.yahoo.com

This avoids direct browser CORS issues during development.

## Trading Logic (Paper Mode)

Buy flow:

1. Validate authenticated user
2. Fetch live market price
3. Validate wallet balance
4. Insert BUY transaction
5. Update or create holding with weighted average buy price
6. Deduct paper wallet balance

Sell flow:

1. Validate authenticated user
2. Fetch live market price
3. Validate available holdings quantity
4. Insert SELL transaction
5. Reduce/remove holding
6. Credit paper wallet balance

All operations are user-scoped by auth user id.

## Common Troubleshooting

1. Dashboard or pages blank:
	- Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
	- Restart dev server after env changes

2. Realtime callback subscribe error:
	- Ensure latest code is pulled where channel names are unique per subscription

3. Email not confirmed on login:
	- Confirm user email in Supabase Auth or disable confirm-email in Auth settings for development

4. User already registered after deleting public.users row:
	- Delete from auth.users (not only public.users)

## Notes

- Currency defaults to INR formatting throughout the dashboard tables/cards.
- The platform is for paper trading simulation only, not real brokerage execution.
