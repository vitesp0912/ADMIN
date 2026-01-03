# Settings Page Deployment Guide

## Overview
This guide walks through deploying the new **backend-driven Settings page** that displays real-time operational metrics for petrol pumps. The implementation follows a **single-source-of-truth** architecture with no hard-coded values and no frontend calculations.

## Architecture

### Components
1. **Backend RPC Function**: `get_pump_operational_metrics(p_pump_id uuid)`
   - Location: `pump_settings_rpc.sql`
   - Purpose: Queries database and returns complete pump metrics in one call
   - Returns: Fuel types, fuel pricing (RSP/RO), nozzle count, fuel type count

2. **Frontend Component**: `src/pages/Settings.jsx`
   - Location: `src/pages/Settings.jsx` (ALREADY UPDATED)
   - Purpose: Displays metrics in a user-friendly two-panel layout
   - Features:
     - Left sidebar: Pump selector with auto-selection
     - Right panel: Operational metrics (nozzles, fuel types)
     - Fuel pricing table with real-time data
     - Data integrity note explaining data flow

### Data Flow
```
Database (pumps, nozzle_info, fuel_types)
           ↓
    RPC Function (get_pump_operational_metrics)
           ↓
    React Component (Settings.jsx)
           ↓
    User Interface (pump metrics display)
```

## Step-by-Step Deployment

### Step 1: Deploy the RPC Function (CRITICAL - MUST DO FIRST)

**Location**: `pump_settings_rpc.sql`

**What to do**:
1. Open [Supabase Dashboard](https://supabase.com)
2. Navigate to your project → **SQL Editor**
3. Click **New Query** (or open a new tab)
4. Copy the entire contents of `pump_settings_rpc.sql`
5. Paste into the SQL Editor
6. Click **Run** button (or press Ctrl+Enter)

**Expected Result**:
- Function `get_pump_operational_metrics` is created
- You should see: `"Query executed successfully"` message
- No errors in the output

**What the RPC Does**:
- Accepts a `pump_id` parameter
- Queries `fuel_types` table and joins with `nozzle_info` to find fuel types used by the pump
- Aggregates fuel pricing (RSP, RO) for each fuel type
- Counts total nozzles for the pump
- Counts distinct fuel types configured
- Returns all data in a single query result

**Test the RPC**:
After deployment, you can test it with:
```sql
SELECT * FROM get_pump_operational_metrics('<your-pump-id-here>');
```

### Step 2: Verify Frontend Component

**Location**: `src/pages/Settings.jsx`

**Status**: ✅ ALREADY UPDATED

The Settings component has been completely rewritten to:
- Fetch all pumps on page load
- Auto-select the first pump
- Call the RPC function when a pump is selected
- Display operational metrics in a clean, readable format

**Key Features**:
- **Left Sidebar**: Pump selector that highlights selected pump
- **Right Panel**: 
  - Pump header with name and code
  - Summary cards showing nozzle count and fuel type count
  - Fuel pricing table with all fuel types, RSP, and RO
  - Data integrity note
  - Graceful empty states

### Step 3: Test in Development

**In your local environment**:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to Settings page in the UI

3. Verify the following work correctly:
   - ✅ Pump list loads on the left sidebar
   - ✅ First pump is auto-selected
   - ✅ Metrics display on the right panel
   - ✅ Nozzle count and fuel type count show correct numbers
   - ✅ Fuel pricing table displays all fuel types
   - ✅ RSP and RO prices display with ₹ symbol and 2 decimal places
   - ✅ Switching between pumps updates the metrics
   - ✅ Empty states display correctly (if a pump has no fuel types)

### Step 4: Verify Data Accuracy

**Cross-check with actual database**:

1. Go to Supabase SQL Editor
2. Run this query to see what the RPC should return:
   ```sql
   SELECT 
     p.id, p.name, p.pump_code,
     ft.id, ft.name, ft.rsp, ft.ro,
     COUNT(DISTINCT ni.id) as nozzle_count,
     COUNT(DISTINCT ni.fuel_type_id) as fuel_type_count
   FROM pumps p
   LEFT JOIN nozzle_info ni ON ni.pump_id = p.id
   LEFT JOIN fuel_types ft ON ft.id = ni.fuel_type_id
   WHERE p.id = '<pump-id>'
   GROUP BY p.id, p.name, p.pump_code, ft.id, ft.name, ft.rsp, ft.ro;
   ```

3. Compare the results with what the Settings page displays
4. Numbers should match exactly (no frontend calculations)

## Troubleshooting

### Issue: "Function not found" error when opening Settings

**Solution**:
- Confirm you ran the SQL from `pump_settings_rpc.sql` in Supabase SQL Editor
- Verify the function was created successfully (no error messages during execution)
- Refresh the page and try again

### Issue: Settings page shows "Select a pump to view metrics"

**Possible causes**:
1. RPC function hasn't been deployed yet → **Deploy pump_settings_rpc.sql first**
2. No pumps exist in the database → Create test pump data in Supabase
3. Selected pump has no nozzles configured → Confirm nozzle_info records exist for the pump

### Issue: Metrics show incorrect numbers

**Verification**:
1. Run the cross-check query above in Supabase SQL Editor
2. Compare database numbers with UI numbers
3. If they don't match, check:
   - RPC function logic (see `pump_settings_rpc.sql`)
   - nozzle_info table has correct pump_id entries
   - fuel_types table has RSP/RO values populated

### Issue: RPC function returns empty fuel_types array

**Possible causes**:
1. No nozzles configured for the pump in nozzle_info table
2. Fuel type IDs in nozzle_info don't exist in fuel_types table
3. Fuel type prices (RSP/RO) are NULL in fuel_types table

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `pump_settings_rpc.sql` | RPC function definition | Ready to deploy |
| `src/pages/Settings.jsx` | React component | ✅ Updated |
| `src/lib/supabase.js` | Supabase client | Already exists |

## Compliance Checklist

- ✅ **No hard-coded values**: All data from database
- ✅ **No calculations on frontend**: All aggregations done by RPC
- ✅ **Single source of truth**: Only one query point (the RPC)
- ✅ **Real-time data**: Fetched fresh every time pump is selected
- ✅ **Audit-ready**: Data flow is transparent and explainable
- ✅ **Graceful empty states**: Handles pumps with no fuel types
- ✅ **Error handling**: Console logs show any issues
- ✅ **Performance**: Single RPC call per pump selection

## Next Steps

1. ✅ **Execute pump_settings_rpc.sql** in Supabase SQL Editor
2. ✅ **Test the Settings page** by selecting different pumps
3. ✅ **Verify data accuracy** against database queries
4. ✅ **Commit changes** to version control

## Questions?

Refer to the data integrity note displayed on the Settings page for a quick explanation of the data flow.
