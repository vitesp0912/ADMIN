# Settings Page - Visual Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SETTINGS PAGE                            │
│                   (React Component)                         │
│                                                             │
│  ┌─────────────────┬──────────────────────────────────┐   │
│  │                 │                                  │   │
│  │  PUMP SELECTOR  │      METRICS DISPLAY             │   │
│  │                 │                                  │   │
│  │ SELECT PUMP     │  Pump: Petrol A                  │   │
│  │ ┌─────────────┐ │  Code: PA-001                    │   │
│  │ │ Pump A   ✓  │ │                                  │   │
│  │ │           │ │  ┌──────────────────┐              │   │
│  │ │ Code: PA  │ │  │ NOZZLES: 8      │              │   │
│  │ │ PA-001    │ │  │ FUEL TYPES: 2   │              │   │
│  │ │           │ │  └──────────────────┘              │   │
│  │ │ Pump B    │ │                                    │   │
│  │ │ Code: PB  │ │  FUEL PRICING                      │   │
│  │ │ PB-002    │ │  ┌────────────────────────┐        │   │
│  │ │           │ │  │ Petrol │ ₹95.50 │₹92.25│       │   │
│  │ │ Pump C    │ │  │ Diesel │ ₹85.75 │₹82.50│       │   │
│  │ │ Code: PC  │ │  └────────────────────────┘        │   │
│  │ │ PC-003    │ │                                    │   │
│  │ └─────────────┘ │  [Data from database in         │   │
│  │                 │   real-time, no hard-coded]    │   │
│  └─────────────────┴──────────────────────────────────┘   │
│                                                             │
│  onClick → setSelectedPumpId → useEffect → fetchPumpMetrics│
└─────────────────────────────────────────────────────────────┘
                            ↓
                       (RPC Call)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           PostgreSQL RPC Function                           │
│      get_pump_operational_metrics(pump_id)                 │
│                                                             │
│  1. Verify pump exists                                     │
│  2. Find fuel types used by pump                           │
│  3. Aggregate pricing (RSP, RO)                            │
│  4. Count nozzles                                          │
│  5. Count fuel types                                       │
│  6. Return as JSON                                         │
│                                                             │
│  Returns: {                                                │
│    pump_id: uuid,                                          │
│    pump_name: "Petrol A",                                  │
│    pump_code: "PA-001",                                    │
│    fuel_types: [                                           │
│      {id: uuid, name: "Petrol", rsp: 95.50, ro: 92.25},  │
│      {id: uuid, name: "Diesel", rsp: 85.75, ro: 82.50}   │
│    ],                                                      │
│    fuel_type_count: 2,                                     │
│    nozzle_count: 8,                                        │
│    created_at: timestamp                                   │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Database Tables                               │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │  pumps   │  │ nozzle_info  │  │  fuel_types     │      │
│  ├──────────┤  ├──────────────┤  ├─────────────────┤      │
│  │ id       │  │ pump_id  ───────→ id              │      │
│  │ name     │  │ nozzle_id    │  │ name            │      │
│  │ code     │  │ fuel_type_id─────→ rsp             │      │
│  │ address  │  │            │  │ ro              │      │
│  └──────────┘  └──────────────┘  │ fuel_type       │      │
│                                   └─────────────────┘      │
│  RPC joins all three tables                                │
│  and returns aggregated data                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```
USER ACTION: Click "Pump A"
    ↓
setSelectedPumpId("pump-a-uuid")
    ↓
useEffect detects selectedPumpId changed
    ↓
fetchPumpMetrics("pump-a-uuid")
    ↓
setMetricsLoading(true)
    ↓
supabase.rpc('get_pump_operational_metrics', {p_pump_id: "pump-a-uuid"})
    ↓
[Network: Request goes to Supabase]
    ↓
PostgreSQL RPC function executes
    ├─ Query pumps table
    ├─ Query nozzle_info table
    ├─ Query fuel_types table
    ├─ JOIN and AGGREGATE
    └─ Return single row
    ↓
[Network: Response comes back as JSON]
    ↓
supabase callback receives data
    ↓
setPumpMetrics(data[0])
    ↓
setMetricsLoading(false)
    ↓
React re-renders
    ↓
Right side shows:
├─ Pump name & code
├─ Nozzle count
├─ Fuel type count  
└─ Fuel pricing table
    ↓
USER SEES: Beautiful metrics display
```

## Component State Lifecycle

```
INITIAL STATE
├─ pumps: []
├─ selectedPumpId: null
├─ pumpMetrics: null
├─ loading: true
└─ metricsLoading: false

AFTER MOUNT
├─ fetchPumps() called
├─ Query pumps table
└─ Set state

AFTER PUMPS LOADED
├─ pumps: [{id: "a", name: "Pump A"}, ...]
├─ selectedPumpId: "a" (auto-select first)
├─ pumpMetrics: null
├─ loading: false
└─ metricsLoading: false

AFTER PUMP SELECTED
├─ fetchPumpMetrics() called
├─ Call RPC function
└─ Set metricsLoading: true

AFTER METRICS LOADED
├─ pumps: [{...}, ...]
├─ selectedPumpId: "a"
├─ pumpMetrics: {name: "Pump A", nozzles: 8, ...}
├─ loading: false
└─ metricsLoading: false

WHEN USER CLICKS ANOTHER PUMP
├─ selectedPumpId: "b"
├─ pumpMetrics: {name: "Pump B", ...}
└─ (repeat)
```

## Rendering Decision Tree

```
START: Is loading?
├─ YES → Show "Loading pumps..."
└─ NO ↓
   
   Is pumps.length > 0?
   ├─ NO → Show "No pumps found"
   └─ YES ↓
      
      Show left sidebar with pump list
      
      Is metricsLoading?
      ├─ YES → Show "Loading metrics..."
      └─ NO ↓
         
         Is pumpMetrics null?
         ├─ YES → Show "Select a pump to view metrics"
         └─ NO ↓
            
            Show metrics display:
            ├─ Pump header
            ├─ Nozzles & Fuel count cards
            ├─ Is fuel_types array not empty?
            │  ├─ YES → Show fuel pricing table
            │  └─ NO → Show "No fuel types"
            └─ Data integrity note
```

## Table Relationships

```
pumps (1) ←─ (many) nozzle_info
  id
  name
  code
  address
  created_at

nozzle_info (many) ─→ (1) fuel_types
  pump_id ─────────────────┐
  nozzle_id               │
  fuel_type_id ───┐      │
  ...             │      │
                  ↓      ↓
              fuel_types
              id
              name
              fuel_type
              rsp (Retail Selling Price)
              ro (Retail Outlet cost)
              created_at
```

## UI Layout Responsiveness

```
MOBILE (< 1024px)
─────────────────────
┌──────────────────────┐
│     HEADER           │
├──────────────────────┤
│   PUMP SELECTOR      │
│  [Pump 1] [Pump 2]  │
├──────────────────────┤
│   METRICS DISPLAY    │
│  - Pump name         │
│  - Nozzle count      │
│  - Fuel type count   │
│  - Fuel table        │
└──────────────────────┘


TABLET (1024px - 1280px)
────────────────────────────────────────
┌────────────────────────────────────────┐
│          HEADER                        │
├──────────┬───────────────────────────┤
│ PUMPS    │ METRICS                   │
│ [Pump 1] │ - Pump name               │
│ [Pump 2] │ - Nozzle count            │
│ [Pump 3] │ - Fuel type count         │
│          │ - Fuel table              │
│          │                           │
└──────────┴───────────────────────────┘


DESKTOP (> 1280px)
─────────────────────────────────────────────────
┌──────────────────────────────────────────────────┐
│              HEADER                              │
├────────────────┬────────────────────────────────┤
│  PUMPS (25%)   │  METRICS (75%)                 │
│  ┌──────────┐  │  ┌──────────────────────────┐ │
│  │ Pump 1 ✓ │  │  │ Pump 1                  │ │
│  │ Pump 2   │  │  │ ├─ Nozzles: 8           │ │
│  │ Pump 3   │  │  │ ├─ Fuel Types: 2        │ │
│  │ Pump 4   │  │  │ └─ Prices table         │ │
│  │ Pump 5   │  │  │   ├─ Petrol $95.50     │ │
│  │ (scroll) │  │  │   └─ Diesel $85.75     │ │
│  └──────────┘  │  └──────────────────────────┘ │
│                │  [Data integrity note]        │
└────────────────┴────────────────────────────────┘
```

## Error Handling Flow

```
fetchPumpMetrics called
    ↓
setMetricsLoading(true)
    ↓
try {
    supabase.rpc(...)
}
    ↓
Does error exist?
├─ YES → catch block
│   ├─ console.error(error)
│   ├─ setPumpMetrics(null)
│   └─ Show: "Select a pump to view metrics"
│
└─ NO → Success
    ├─ Is data returned?
    │  ├─ YES → setPumpMetrics(data[0])
    │  │        console.log('Pump Metrics:', data[0])
    │  │        Show metrics display
    │  │
    │  └─ NO → setPumpMetrics(null)
    │          Show: "Select a pump..."
    │
finally {
    setMetricsLoading(false)
}
```

## Performance Timeline

```
User clicks pump
    ↓ (0ms)
State updates
    ↓ (1ms)
fetchPumpMetrics called
    ↓ (2ms)
Network request sent
    ↓ (20-50ms - network latency)
Database executes RPC
    ├─ Query pumps: 5ms
    ├─ Query nozzle_info: 5ms
    ├─ Query fuel_types: 5ms
    ├─ JOIN & AGGREGATE: 5ms
    └─ Total: ~20ms
    ↓ (20-50ms - network latency back)
Response received
    ↓ (1ms)
setPumpMetrics(data)
    ↓ (1ms)
React re-renders
    ↓ (1ms)
Browser paints
    ↓
TOTAL TIME: 50-100ms ✅

User sees metrics update smoothly
```

## Code Structure

```
src/pages/Settings.jsx
├─ Imports (React, Supabase, Icons)
├─ Component function
│  ├─ State declarations (5 pieces)
│  ├─ useEffect #1 (mount: fetch pumps)
│  ├─ useEffect #2 (when pump selected)
│  ├─ fetchPumps() function
│  │  ├─ Try block
│  │  ├─ Query pumps table
│  │  ├─ Auto-select first
│  │  ├─ Catch error
│  │  └─ Finally: setLoading(false)
│  ├─ fetchPumpMetrics() function
│  │  ├─ Try block
│  │  ├─ Call RPC
│  │  ├─ Handle response
│  │  ├─ Catch error
│  │  └─ Finally: setMetricsLoading(false)
│  └─ Return JSX
│     ├─ Header section
│     ├─ Conditional rendering
│     │  ├─ Loading state
│     │  ├─ No pumps state
│     │  └─ Main content
│     ├─ Left sidebar (pumps)
│     ├─ Right panel (metrics)
│     │  ├─ Loading state
│     │  ├─ No selection state
│     │  └─ Metrics display
│     │     ├─ Header
│     │     ├─ Cards
│     │     ├─ Table
│     │     └─ Info note
│     └─ Tailwind styling
└─ Export default
```

## Single Source of Truth

```
                  DATABASE (TRUTH)
              /       |       \
            /         |         \
          /           |           \
    nozzle_info   fuel_types    pumps
        │              │           │
        └──────────────┼───────────┘
                       │
                       ↓
                   RPC Function
                  (aggregates)
                       │
                       ↓
                Frontend/React
               (displays data)
                       │
                       ↓
                   User Interface

KEY RULE: Everything comes from ONE place (RPC)
          Nothing calculated in frontend
          Always up-to-date
```

---

All diagrams show how Settings page creates a professional, data-driven experience using backend-first architecture.
