# Admin configure-on-behalf (fuel / shifts / nozzles)

Keep the Flutter dealer onboarding path unchanged. From your **admin panel**, configure a pump using the Supabase **service role** and these RPCs. Do **not** log in as the dealer.

Admin RPCs enforce the **same business rules** as the app (fuel enum / counts, shift 24h coverage, nozzle limits, meter date not in the future).

## Isolation from the app (no collision)

| | Flutter app path | Admin panel |
|--|------------------|-------------|
| Fuel | Direct `fuel_types` insert via `AuthService.saveFuelTypes` | `admin_save_fuel_types` |
| Shifts | RPC `sync_pump_shifts` | RPC `admin_sync_pump_shifts` (**different name**) |
| Nozzles | Direct inserts via `AuthService.saveNozzles` | `admin_save_nozzles` |
| Triggers | None added by this script | None |
| Who can call | `authenticated` client | **`service_role` only** |

The script **does not** replace or wrap `sync_pump_shifts` / dealer inserts. Grants are revoked from `PUBLIC`, `anon`, and `authenticated`, so the Flutter app cannot invoke `admin_*` even by mistake.

## Apply

Run in Supabase SQL Editor:

[`admin_configure_onboarding_rpc.sql`](./admin_configure_onboarding_rpc.sql)

## Prerequisite

Works for **pending** and **approved** pumps (not rejected). Call with the pump’s `pump_id` from your admin list.

Dealer login still needs your normal approve/activate step (`registration_status = approved`, user `is_active`, etc.). After you configure fuel + nozzles while pending, then approve, the dealer skips in-app onboarding on first login.

Table RLS on `fuel_types` / `shifts` / `nozzle_*` often requires `registration_status = approved` (or pending only for the logged-in dealer). Admin RPCs are `SECURITY DEFINER` with **`SET row_security = off`**, so those policies do **not** apply inside the function. Dealer Flutter path is unchanged and still subject to normal RLS.

## App flow (unchanged)

After fuel types **and** nozzles exist for the `pump_id`, Flutter `AuthService.getOnboardingStep()` returns `null` and the dealer skips in-app onboarding. That is data-driven only — no admin trigger on the dealer path.

## RPCs

| RPC | Purpose |
|-----|---------|
| `admin_save_fuel_types(p_pump_id, p_fuel_types)` | Insert/upsert `fuel_types` |
| `admin_sync_pump_shifts(p_pump_id, p_shifts)` | Upsert `shifts` (app coverage rules) |
| `admin_save_nozzles(p_pump_id, p_nozzles, p_meter_date, p_shift_id)` | Replace `nozzle_info` + baseline `nozzle_reading` + seed prices |
| `admin_complete_onboarding(...)` | All three in one call |

## Rules (same as app)

**Fuel types**
- Count 1–27
- Name must match `FuelType` display names (case-sensitive), e.g. `Petrol 91`, `Diesel Regular`
- `rsp` / `ro_price`: valid prices, max ₹200; `rsp > 0`; `ro_price < rsp`
- No duplicate names in the payload

**Shifts**
- 1–4 active shifts
- Unique names; unique start times
- Full-day inclusive coverage (each end = one minute before next start; total 1440 minutes)

**Nozzles**
- Count 1–25
- `shift_id` must belong to the pump
- `p_meter_date` not after `CURRENT_DATE`
- `initial_meter_reading` required and ≥ 0
- `fuel_type_id` (or resolvable `fuel_type_name`) on this pump

## Call shapes (JS / service role)

```js
import { createClient } from '@supabase/supabase-js'

// Must use SERVICE_ROLE_KEY — anon/authenticated keys cannot call these RPCs
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const pumpId = '…'

await admin.rpc('admin_complete_onboarding', {
  p_pump_id: pumpId,
  p_fuel_types: [
    { name: 'Petrol 91', rsp: 100.5, ro_price: 95.0, display_order: 1 },
    { name: 'Diesel Regular', rsp: 90.0, ro_price: 85.0, display_order: 2 },
  ],
  p_shifts: [
    {
      name: 'Morning',
      sequence: 1,
      start_time: '06:00:00',
      end_time: '13:59:00',
      is_active: true,
    },
    {
      name: 'Evening',
      sequence: 2,
      start_time: '14:00:00',
      end_time: '05:59:00',
      is_active: true,
    },
  ],
  p_nozzles: [
    { fuel_type_name: 'Petrol 91', initial_meter_reading: 0 },
    { fuel_type_name: 'Diesel Regular', initial_meter_reading: 0 },
  ],
  p_meter_date: '2026-08-01',
})
```

Or call `admin_save_fuel_types` → `admin_sync_pump_shifts` → `admin_save_nozzles` in order.

## What not to do

- Impersonate the dealer or store their password
- Call these RPCs from the Flutter app (use existing `AuthService` / `sync_pump_shifts`)
- Grant these RPCs to `authenticated` / `anon`
- Rename/replace `sync_pump_shifts` with the admin function
