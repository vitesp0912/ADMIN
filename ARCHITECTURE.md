# PetroFI Admin Panel - Architecture Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Component Architecture](#component-architecture)
5. [Routing Structure](#routing-structure)
6. [State Management](#state-management)
7. [Database Integration](#database-integration)
8. [Authentication Flow](#authentication-flow)
9. [Data Flow](#data-flow)
10. [Styling Architecture](#styling-architecture)
11. [Key Features](#key-features)
12. [Security Considerations](#security-considerations)
13. [Build & Deployment](#build--deployment)

---

## Overview

The PetroFI Admin Panel is a comprehensive React-based web application designed to manage all aspects of petrol pump operations. It provides administrators with full visibility and control over pumps, users, sales, expenses, and other operational data stored in Supabase.

### Purpose
- Centralized management of all petrol pumps
- User and access control management
- Real-time monitoring of sales, expenses, and operations
- Pump registration approval workflow
- Subscription and billing management

---

## Technology Stack

### Core Framework
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router v6** - Client-side routing

### UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **PostCSS** - CSS processing

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Row Level Security (RLS)
  - Authentication
  - Real-time subscriptions (if needed)

### Utilities
- **date-fns** - Date formatting and manipulation

---

## Project Structure

```
Reactapp/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable components
│   │   └── Layout.jsx     # Main layout with sidebar
│   ├── lib/               # Utilities and configurations
│   │   └── supabase.js    # Supabase client initialization
│   ├── pages/             # Page components
│   │   ├── Login.jsx      # Authentication page
│   │   ├── Dashboard.jsx  # Overview dashboard
│   │   ├── Pumps.jsx      # Pumps list view
│   │   ├── PumpDetail.jsx # Individual pump management
│   │   ├── Users.jsx      # Users management
│   │   ├── Sales.jsx      # Sales transactions
│   │   ├── Expenses.jsx   # Expense entries
│   │   ├── MeterReadings.jsx # Meter reading records
│   │   ├── DipEntries.jsx    # Tank dip measurements
│   │   ├── SalaryEntries.jsx # Salary records
│   │   └── Settings.jsx   # Pump settings
│   ├── App.jsx            # Main app component with routes
│   ├── main.jsx           # Application entry point
│   └── index.css          # Global styles & Tailwind imports
├── admin_rls_policies.sql # Database RLS policies
├── package.json           # Dependencies
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind configuration
├── postcss.config.js     # PostCSS configuration
└── ARCHITECTURE.md       # This file
```

---

## Component Architecture

### Layout Component (`Layout.jsx`)
- **Purpose**: Provides consistent page structure
- **Features**:
  - Responsive sidebar navigation
  - Mobile hamburger menu
  - Active route highlighting
  - User logout functionality
- **State**: `sidebarOpen` (boolean)

### Page Components

#### 1. **Login.jsx**
- **Purpose**: User authentication
- **Features**:
  - Email/password login
  - Error handling
  - Redirect to dashboard on success
- **State**: `email`, `password`, `loading`, `error`

#### 2. **Dashboard.jsx**
- **Purpose**: Overview statistics and recent activity
- **Features**:
  - Stat cards (Total Pumps, Active Pumps, Pending, Users, Sales, Expenses)
  - Recent pumps table
  - Clickable stat cards for navigation
- **State**: `stats`, `recentPumps`, `loading`
- **Data Fetched**: Pumps, Users, Sales (30 days), Expenses (30 days)

#### 3. **Pumps.jsx**
- **Purpose**: List and manage all pumps
- **Features**:
  - Search functionality
  - Status filtering (All/Active/Pending/Inactive)
  - Clickable rows to navigate to pump details
  - Quick approve/reject (removed from UI, available in detail view)
- **State**: `pumps`, `loading`, `searchTerm`, `filterStatus`, `message`, `updating`
- **Functions**:
  - `fetchPumps()` - Load all pumps
  - `handleApprovePump()` - Approve pump and activate users
  - `handleRejectPump()` - Reject pump registration
  - `handleRowClick()` - Navigate to pump detail

#### 4. **PumpDetail.jsx** ⭐ (Most Complex)
- **Purpose**: Comprehensive pump management
- **Structure**: Two-card layout
  - **Card 1**: Pump Information
    - **Details Tab**: Basic info, owner info, payment status
    - **Subscription Tab**: Plan, status, billing cycle, dates
    - **Management Tab**: Active status, registration status, payment verification, subscription management
  - **Card 2**: Pump Data
    - **Users Tab**: Associated users list
    - **Sales Tab**: Sales transactions
    - **Meter Readings Tab**: Meter reading records
    - **Expenses Tab**: Expense entries
    - **Dip Entries Tab**: Tank dip measurements
    - **Salaries Tab**: Salary entries
- **State**:
  - `pump` - Current pump data
  - `users`, `sales`, `meterReadings`, `expenses`, `dipEntries`, `salaryEntries` - Data arrays
  - `activeTab` - Card 1 tab state
  - `activeDataTab` - Card 2 tab state
  - `formData` - Management form state
  - `loading`, `saving`, `message`, `dataLoading`
- **Functions**:
  - `fetchPumpDetails()` - Load pump data
  - `fetchPumpUsers()` - Load users for pump
  - `fetchTabData()` - Lazy load tab data
  - `handleSaveChanges()` - Update pump details
  - `handleQuickApprove()` - Quick approval workflow
- **Special Features**:
  - Auto-activates users when pump is approved
  - Form validation and error handling
  - Real-time data updates

#### 5. **Users.jsx**
- **Purpose**: View all system users
- **Features**:
  - Search by name, phone, pump name/code
  - Role filtering
  - Link to pump detail page
- **State**: `users`, `pumps`, `loading`, `searchTerm`, `filterRole`
- **Data**: Users table with pump relationships

#### 6. **Sales.jsx**
- **Purpose**: View all sales transactions
- **Features**:
  - Date filtering (Today/Week/Month/Custom)
  - Search functionality
  - Summary statistics (Total Transactions, Amount, Liters)
- **State**: `sales`, `pumps`, `loading`, `searchTerm`, `dateFilter`, `startDate`, `endDate`
- **Data**: Sales table with pump relationships

#### 7. **Expenses.jsx**
- **Purpose**: View all expense entries
- **Features**:
  - Date filtering
  - Category and description search
  - Total expenses summary
- **State**: `expenses`, `pumps`, `loading`, `searchTerm`, `dateFilter`, `startDate`, `endDate`

#### 8. **MeterReadings.jsx**
- **Purpose**: View meter reading records
- **Features**:
  - Search by pump, nozzle, fuel type
  - Reading type indicators (start/end)
- **State**: `readings`, `pumps`, `loading`, `searchTerm`

#### 9. **DipEntries.jsx**
- **Purpose**: View tank dip measurements
- **Features**:
  - Search by pump, tank
  - Calculated liters display
- **State**: `entries`, `pumps`, `loading`, `searchTerm`

#### 10. **SalaryEntries.jsx**
- **Purpose**: View salary and attendance records
- **Features**:
  - Search by pump, employee name, role
  - Total salary paid summary
  - Status indicators (Active/Inactive, Present/Absent)
- **State**: `entries`, `pumps`, `loading`, `searchTerm`

#### 11. **Settings.jsx**
- **Purpose**: View pump-specific settings
- **Features**:
  - Fuel pricing (RSP/RO for Diesel/Petrol)
  - Settings explanation card
- **State**: `settings`, `pumps`, `loading`

---

## Routing Structure

### Route Configuration (`App.jsx`)
```javascript
Routes:
├── /login          → Login.jsx (public)
└── /               → Layout (protected)
    ├── /           → Dashboard.jsx
    ├── /pumps      → Pumps.jsx
    ├── /pumps/:id  → PumpDetail.jsx
    ├── /users      → Users.jsx
    ├── /sales      → Sales.jsx
    ├── /expenses   → Expenses.jsx
    ├── /meter-readings → MeterReadings.jsx
    ├── /dip-entries    → DipEntries.jsx
    ├── /salary-entries → SalaryEntries.jsx
    └── /settings   → Settings.jsx
```

### Route Protection
- Protected routes check authentication via Supabase
- Unauthenticated users redirected to `/login`
- Layout component wraps all protected routes

---

## State Management

### Local State (React Hooks)
- **useState**: Component-level state
- **useEffect**: Side effects and data fetching
- **useParams**: Route parameters (for PumpDetail)
- **useNavigate**: Programmatic navigation

### State Patterns
1. **Loading States**: Each page manages its own loading state
2. **Error Handling**: Error messages displayed via `message` state
3. **Form State**: `formData` object for form inputs
4. **Filter State**: Search terms and filters stored locally

### Data Flow
```
User Action → Event Handler → State Update → Re-render → UI Update
                ↓
         Supabase Query
                ↓
         Data Received → State Update → UI Update
```

---

## Database Integration

### Supabase Client (`lib/supabase.js`)
```javascript
Configuration:
- URL: Environment variable or fallback
- Anon Key: Environment variable or fallback
- Client: Singleton instance exported
```

### Database Tables Used

#### 1. **pumps**
- Primary table for pump information
- Fields: `id`, `name`, `pump_code`, `phone`, `address`, `owner_name`, `owner_phone`, `is_active`, `registration_status`, `payment_verified`, `subscription_status`, `subscription_plan`, `billing_cycle`, `subscription_start_date`, `subscription_end_date`, `created_at`, `updated_at`

#### 2. **users**
- User accounts linked to pumps
- Fields: `id`, `pump_id`, `phone`, `name`, `role`, `is_active`, `last_login_at`, `created_at`

#### 3. **sales**
- Sales transactions
- Fields: `id`, `pump_id`, `date_time`, `shift`, `nozzle`, `fuel_type`, `liters`, `price_per_liter`, `total_amount`, `payment_mode`, `customer_name`, `vehicle_number`

#### 4. **expenses**
- Expense entries
- Fields: `id`, `pump_id`, `date_time`, `category`, `description`, `amount`, `payment_mode`

#### 5. **meter_readings**
- Meter reading records
- Fields: `id`, `pump_id`, `date_time`, `shift`, `nozzle`, `fuel_type`, `reading_type`, `reading_value`, `difference`

#### 6. **dip_entries**
- Tank dip measurements
- Fields: `id`, `pump_id`, `date_time`, `tank`, `shift`, `dip_in_cm`, `calculated_liters`, `notes`

#### 7. **salary_entries**
- Salary and attendance records
- Fields: `id`, `pump_id`, `date_time`, `name`, `role`, `is_active`, `is_present`, `daily_wage`, `bonus`, `deduction`, `total_amount`

#### 8. **settings**
- Pump-specific settings
- Fields: `id`, `pump_id`, `diesel_rsp`, `petrol_rsp`, `diesel_ro`, `petrol_ro`, `updated_at`

### Query Patterns

#### Fetching Data
```javascript
// Single record
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id)
  .single()

// Multiple records with filter
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('pump_id', pumpId)
  .order('created_at', { ascending: false })
  .limit(1000)

// Count
const { count, error } = await supabase
  .from('table_name')
  .select('*', { count: 'exact', head: true })
```

#### Updating Data
```javascript
const { data, error } = await supabase
  .from('pumps')
  .update({ field: value })
  .eq('id', id)
  .select()
```

---

## Authentication Flow

### Login Process
1. User enters email/password
2. `supabase.auth.signInWithPassword()` called
3. On success: Navigate to dashboard
4. On error: Display error message

### Session Management
- Supabase handles session persistence
- `supabase.auth.getUser()` checks current session
- Protected routes verify authentication
- Logout clears session

### Authentication State
- Stored in Supabase Auth
- Accessible via `supabase.auth.getUser()`
- Used for:
  - Route protection
  - User identification in updates
  - Payment verification tracking

---

## Data Flow

### Fetching Data
```
Component Mount
    ↓
useEffect Hook
    ↓
Fetch Function (async)
    ↓
Supabase Query
    ↓
Set Loading State
    ↓
Receive Data/Error
    ↓
Update State
    ↓
Re-render Component
```

### Updating Data
```
User Action (Form Submit/Button Click)
    ↓
Validation
    ↓
Set Saving State
    ↓
Supabase Update Query
    ↓
Success/Error Response
    ↓
Update State
    ↓
Show Success/Error Message
    ↓
Refresh Data (if needed)
```

### Auto-Activation Flow (Pump Approval)
```
Pump Approved/Activated
    ↓
Check if users should be activated
    ↓
Update users table (set is_active = true)
    ↓
Show success message
    ↓
Refresh users list
```

---

## Styling Architecture

### Tailwind CSS Configuration
- Utility-first approach
- Custom color palette
- Responsive breakpoints
- Custom spacing and typography

### Design System

#### Colors
- **Primary**: Blue (`blue-600`, `blue-700`)
- **Success**: Green (`green-500`, `green-600`)
- **Warning**: Yellow (`yellow-400`, `yellow-500`)
- **Error**: Red (`red-500`, `red-600`)
- **Info**: Purple (`purple-500`, `purple-600`)
- **Neutral**: Gray scale (`gray-50` to `gray-900`)

#### Typography
- **Headings**: `text-4xl`, `text-3xl`, `text-2xl`, `text-xl`
- **Body**: `text-sm`, `text-base`
- **Labels**: `text-xs` with `uppercase` and `tracking-wide`
- **Font Weights**: `font-medium`, `font-semibold`, `font-bold`

#### Components

##### Cards
- Background: `bg-white`
- Border: `border border-gray-200`
- Radius: `rounded-xl`
- Shadow: `shadow-lg` with `hover:shadow-xl`
- Padding: `p-6`

##### Tables
- Header: `bg-gradient-to-r from-gray-100 to-gray-50`
- Rows: `hover:bg-{color}-50` (color-coded per page)
- Borders: `divide-y divide-gray-200`

##### Badges
- Shape: `rounded-full`
- Padding: `px-3 py-1`
- Font: `text-xs font-semibold`

##### Buttons
- Primary: Gradient backgrounds (`bg-gradient-to-r`)
- Hover: Darker gradients
- Shadow: `shadow-md` with `hover:shadow-lg`
- Transitions: `transition-all duration-200`

##### Forms
- Inputs: `border-2` with focus states
- Focus: `focus:ring-2 focus:ring-{color}-500`
- Transitions: `transition-all`

---

## Key Features

### 1. Pump Management
- ✅ View all pumps in a table
- ✅ Search and filter pumps
- ✅ Click row to view details
- ✅ Approve/reject pump registrations
- ✅ Manage pump status (active/inactive)
- ✅ Update registration status
- ✅ Payment verification
- ✅ Subscription management

### 2. User Management
- ✅ View all users across pumps
- ✅ Search users
- ✅ Filter by role
- ✅ View user details and pump association
- ✅ Auto-activate users on pump approval

### 3. Data Viewing
- ✅ Sales transactions with filtering
- ✅ Expense entries with date ranges
- ✅ Meter readings
- ✅ Dip entries
- ✅ Salary entries
- ✅ Settings overview

### 4. Dashboard
- ✅ Overview statistics
- ✅ Recent pumps list
- ✅ Quick navigation via stat cards

### 5. UI/UX Features
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Loading states
- ✅ Error handling and messages
- ✅ Empty states with icons
- ✅ Smooth transitions and animations
- ✅ Color-coded status indicators
- ✅ Title Case formatting for data
- ✅ Consistent design language

---

## Security Considerations

### Row Level Security (RLS)
- **Policies Required**: See `admin_rls_policies.sql`
- **Pumps Table**: Authenticated users can UPDATE
- **Users Table**: Authenticated users can UPDATE
- **Other Tables**: Read-only for authenticated users

### Authentication
- Supabase Auth handles password hashing
- Session management via Supabase
- Protected routes require authentication

### Data Access
- Admin panel uses authenticated Supabase client
- All queries respect RLS policies
- Service role key NOT exposed in frontend

### Best Practices
- ✅ Environment variables for sensitive config
- ✅ Error messages don't expose sensitive info
- ✅ Input validation on forms
- ✅ Proper error handling

---

## Build & Deployment

### Development
```bash
npm install          # Install dependencies
npm run dev         # Start dev server (http://localhost:5173)
```

### Production Build
```bash
npm run build       # Build for production
# Output: dist/ directory
```

### Environment Variables
Create `.env` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Deployment Options
1. **Vercel**: Connect GitHub repo, auto-deploy
2. **Netlify**: Drag & drop `dist/` folder or connect repo
3. **Static Hosting**: Upload `dist/` to any static host
4. **Docker**: Containerize the app

### Build Output
- `dist/index.html` - Entry HTML
- `dist/assets/index-*.css` - Compiled CSS
- `dist/assets/index-*.js` - Compiled JavaScript

---

## Helper Functions

### Title Case Conversion
Used across all pages to format data:
```javascript
const toTitleCase = (str) => {
  if (!str) return str
  return str
    .toString()
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
```

**Converts**:
- `"basic"` → `"Basic"`
- `"subscription_plan"` → `"Subscription Plan"`
- `"payment_mode"` → `"Payment Mode"`

---

## Database Relationships

```
pumps (1) ──< (many) users
pumps (1) ──< (many) sales
pumps (1) ──< (many) expenses
pumps (1) ──< (many) meter_readings
pumps (1) ──< (many) dip_entries
pumps (1) ──< (many) salary_entries
pumps (1) ──< (1) settings
```

### Foreign Keys
- All data tables reference `pumps.id` via `pump_id`
- `users.id` references `auth.users.id` (Supabase Auth)

---

## Component Communication

### Parent-Child
- Props passed down
- Callbacks passed up
- No global state management library

### Sibling Components
- Independent state
- Shared data fetched separately
- No direct communication

### Navigation
- React Router for page navigation
- `useNavigate()` hook for programmatic navigation
- `Link` components for declarative navigation

---

## Performance Considerations

### Data Loading
- **Lazy Loading**: Tab data loaded on-demand in PumpDetail
- **Pagination**: Limited to 1000 records per query
- **Caching**: No explicit caching, relies on React state

### Optimization
- React.memo not used (can be added if needed)
- useMemo/useCallback not used (can be added for expensive operations)
- Images/icons optimized via Lucide React

### Bundle Size
- Current: ~470KB (gzipped: ~120KB)
- Tree-shaking enabled via Vite
- Code splitting possible via React.lazy()

---

## Error Handling

### Patterns
1. **Try-Catch Blocks**: All async operations wrapped
2. **Error State**: `error` or `message` state for UI feedback
3. **Console Logging**: Errors logged for debugging
4. **User-Friendly Messages**: Error messages displayed to users

### Error Types
- **Network Errors**: Supabase connection issues
- **Auth Errors**: Authentication failures
- **Validation Errors**: Form validation failures
- **RLS Errors**: Permission denied errors

---

## Future Enhancements (Potential)

### Features
- [ ] Export data to CSV/Excel
- [ ] Advanced filtering and sorting
- [ ] Bulk operations
- [ ] Real-time updates via Supabase subscriptions
- [ ] Charts and graphs for analytics
- [ ] User role management
- [ ] Audit logs
- [ ] Email notifications

### Technical
- [ ] Add React Query for better data management
- [ ] Implement proper caching strategy
- [ ] Add unit tests
- [ ] Add E2E tests
- [ ] Performance monitoring
- [ ] Error tracking (Sentry)

---

## File Naming Conventions

- **Components**: PascalCase (`PumpDetail.jsx`)
- **Utilities**: camelCase (`supabase.js`)
- **Config Files**: kebab-case (`vite.config.js`)
- **Constants**: UPPER_SNAKE_CASE (if needed)

---

## Code Style

### JavaScript/JSX
- ES6+ syntax
- Arrow functions preferred
- Template literals for strings
- Destructuring for props and state
- Optional chaining (`?.`) for safe access

### Formatting
- 2-space indentation
- Semicolons used
- Single quotes preferred (but double quotes in JSX)
- Trailing commas in objects/arrays

---

## Dependencies

### Production
```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "react-router-dom": "^6.x",
  "@supabase/supabase-js": "^2.x",
  "lucide-react": "^0.x",
  "date-fns": "^2.x"
}
```

### Development
```json
{
  "@vitejs/plugin-react": "^4.x",
  "autoprefixer": "^10.x",
  "postcss": "^8.x",
  "tailwindcss": "^3.x",
  "vite": "^5.x"
}
```

---

## API Endpoints (Supabase)

All endpoints are Supabase REST API calls:

### Authentication
- `POST /auth/v1/token` - Login
- `GET /auth/v1/user` - Get current user
- `POST /auth/v1/logout` - Logout

### Data
- `GET /rest/v1/{table}` - Query data
- `POST /rest/v1/{table}` - Insert data
- `PATCH /rest/v1/{table}` - Update data
- `DELETE /rest/v1/{table}` - Delete data

### Tables Accessed
- `pumps`
- `users`
- `sales`
- `expenses`
- `meter_readings`
- `dip_entries`
- `salary_entries`
- `settings`

---

## Configuration Files

### `vite.config.js`
- React plugin configuration
- Build optimizations

### `tailwind.config.js`
- Content paths
- Theme customization
- Plugin configuration

### `postcss.config.js`
- Tailwind CSS plugin
- Autoprefixer plugin

### `package.json`
- Dependencies
- Scripts (dev, build, preview)
- Project metadata

---

## Development Workflow

### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `App.jsx`
3. Add navigation link in `Layout.jsx`
4. Implement data fetching
5. Style with Tailwind CSS
6. Add Title Case helper if needed

### Adding a New Feature
1. Identify affected components
2. Add state management
3. Implement Supabase queries
4. Update UI
5. Add error handling
6. Test functionality

---

## Troubleshooting

### Common Issues

#### Build Errors
- Check Node.js version (should be 16+)
- Clear `node_modules` and reinstall
- Check for syntax errors in components

#### Supabase Connection Issues
- Verify environment variables
- Check Supabase project status
- Verify RLS policies are set

#### Authentication Issues
- Check Supabase Auth configuration
- Verify user exists in Supabase Auth
- Check RLS policies allow authenticated access

---

## Version History

### Current Version: 1.0.0

#### Features Implemented
- ✅ Complete admin panel UI
- ✅ Pump management
- ✅ User management
- ✅ Data viewing (Sales, Expenses, etc.)
- ✅ Dashboard with statistics
- ✅ Responsive design
- ✅ Title Case formatting
- ✅ Auto-activation of users on pump approval
- ✅ RLS policy support

---

## Contact & Support

For issues or questions:
1. Check this architecture document
2. Review code comments
3. Check Supabase documentation
4. Review RLS policies in `admin_rls_policies.sql`

---

**Last Updated**: 2024
**Maintained By**: PetroFI Development Team

