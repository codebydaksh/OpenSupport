# OpenSupport

Intercom-lite customer messaging platform.

## Quick Start

```bash
# Install all dependencies
npm install

# Start backend (from root)
npm run dev:backend

# Start frontend (from root)
npm run dev:frontend

# Start widget dev server (from root)
npm run dev:widget
```

## Environment Variables

Copy `.env.example` to `.env` in the backend directory and fill in your values.

## Project Structure

```
opensupport/
├── backend/          # Node.js/Express API + WebSocket server
├── frontend/         # React agent dashboard
├── widget/           # Embeddable chat widget
└── supabase/         # Database migrations
```

## Tech Stack

- **Backend**: Node.js, Express, Socket.io, Redis
- **Frontend**: React, Tailwind CSS, Vite
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth
- **Payments**: Stripe
- **Email**: Resend
