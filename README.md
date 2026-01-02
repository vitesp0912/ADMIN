# PetroFI Admin Panel

A comprehensive admin panel for managing all petrol pump related data, built with React and Supabase.

## Features

- **Dashboard**: Overview statistics and recent pumps
- **Pumps Management**: View all pumps, their details, registration status, subscription info
- **Users Management**: View all users, their roles, and pump associations
- **Sales**: View all sales transactions with filtering and search
- **Expenses**: View all expense entries
- **Meter Readings**: View all meter readings
- **Salary Entries**: View salary and attendance records
- **Dip Entries**: View tank dip measurements
- **Settings**: View pump-specific settings and configurations

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Supabase:
   - Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   - Edit `.env` and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   - Get these values from your Supabase project settings: https://app.supabase.com/project/_/settings/api
   - **Note**: The `.env` file is gitignored and won't be committed to version control
   - If no `.env` file exists, the app will use fallback values (for development only)

3. Run the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Authentication

The admin panel uses Supabase authentication. You'll need to:
1. Create an admin user in Supabase Auth
2. Login with email and password

## Database Access

The admin panel connects directly to your Supabase database and displays all data. Make sure:
- Your Supabase project has the correct RLS policies (or use service role key for admin access)
- All tables are accessible (pumps, users, sales, expenses, etc.)

## Responsive Design

The admin panel is fully responsive and works on:
- Desktop
- Tablet
- Mobile devices

## Tech Stack

- React 18
- React Router
- Supabase JS
- Tailwind CSS
- Vite
- Lucide React (icons)
- date-fns (date formatting)

## Notes

- This admin panel is separate from the Flutter mobile app
- It provides full visibility into all data in your Supabase database
- You can view passwords (hashed), user details, and all operational data
- Consider moving this to a separate repository for production use

