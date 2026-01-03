# ⚡ Settings Page - Quick Start (5 Minutes)

## TL;DR - What You Need to Do

### 1️⃣ Deploy RPC (2 minutes)
Copy `pump_settings_rpc.sql` → Paste in Supabase SQL Editor → Click Run

### 2️⃣ Test (2 minutes)
Start `npm run dev` → Go to Settings page → See metrics

### 3️⃣ Verify (1 minute)
Click different pumps → Check numbers match database

---

## 📋 Detailed Steps

### Step 1: Deploy RPC Function

#### What is it?
A database function that fetches all pump operational metrics in one query.

#### Where?
- File: `pump_settings_rpc.sql`
- Destination: Supabase SQL Editor

#### How?

**A. Go to Supabase**
1. https://supabase.com → Login
2. Select your project
3. Click **SQL Editor** (left sidebar)

**B. Create new query**
1. Click **New Query** or open blank tab
2. Clear any placeholder text

**C. Copy RPC code**
1. Open `pump_settings_rpc.sql` in workspace
2. Select all text (Ctrl+A)
3. Copy (Ctrl+C)

**D. Paste and run**
1. Paste into SQL Editor (Ctrl+V)
2. Click **Run** button
3. Look for: "Query executed successfully" ✅

#### Expected output
```
Query executed successfully
```

#### If you see an error
- Check you copied the ENTIRE file
- Check for syntax errors (missing semicolon, etc.)
- Try clicking Run again

---

### Step 2: Test Settings Page

#### Start dev server
```bash
npm run dev
```

#### Navigate to Settings
- Click "Settings" in menu
- Or go to `http://localhost:5173/settings`

#### What you should see
- Left side: List of pumps (blue highlight on first)
- Right side: Pump metrics
  - Pump name and code
  - Nozzle count (large blue number)
  - Fuel type count (large green number)
  - Fuel pricing table

#### Try it
1. Click different pumps on the left
2. Watch metrics update on the right
3. Check console (F12 → Console)
   - Should show: `Pump Metrics (from DB): { ... }`
   - Should NOT show errors

---

### Step 3: Verify Data

#### Quick check in Supabase
1. SQL Editor → New Query
2. Run this:
```sql
SELECT 
  p.name,
  COUNT(DISTINCT ni.id) as nozzle_count,
  COUNT(DISTINCT ft.id) as fuel_type_count
FROM pumps p
LEFT JOIN nozzle_info ni ON ni.pump_id = p.id
LEFT JOIN fuel_types ft ON ft.id = ni.fuel_type_id
GROUP BY p.id, p.name
LIMIT 5;
```

3. Compare these numbers with Settings page
4. Should match exactly ✅

---

## 🚨 Common Issues & Fixes

### Issue: "Function not found"
```
Error: function get_pump_operational_metrics(uuid) does not exist
```
**Fix**: You didn't deploy the RPC yet. Go back to Step 1.

### Issue: Settings page shows "Select a pump..."
**Fix**: 
- Check Step 1 completed
- Refresh page (Ctrl+R)
- Check browser console (F12)

### Issue: Numbers don't match
**Fix**:
- Run the verification query in Step 3
- Compare numbers carefully
- Check decimal places (RSP should have 2 decimals)

### Issue: Console shows red errors
**Fix**:
- Check RPC deployed correctly
- Check pump_id exists in database
- Check browser network tab (F12 → Network)

---

## 📊 What The System Does

```
Database has: pumps, nozzles, fuel pricing
                    ↓
RPC function aggregates everything
                    ↓
Frontend displays in nice UI
                    ↓
User sees: "Pump X has 8 nozzles, 2 fuel types, $5.50 petrol"
```

---

## ✅ Success Indicators

- [ ] RPC deployed without errors
- [ ] Settings page loads
- [ ] Pumps appear in left sidebar  
- [ ] Metrics appear when pump selected
- [ ] Numbers match database
- [ ] No red errors in console
- [ ] Switching pumps works smoothly

---

## 🎯 You're Done When

All checkboxes above are checked ✅

---

## 📞 If Still Stuck

1. Check `SETTINGS_DEPLOYMENT_GUIDE.md` for more details
2. Check `SETTINGS_PAGE_README.md` for architecture
3. Check console for actual error messages
4. Check Supabase logs

---

## 🚀 Next (Optional)

After verifying Settings works:
- Commit to git
- Deploy to production
- Monitor for any issues

---

**Total Time**: ~5 minutes
**Difficulty**: Easy
**Status**: Ready to deploy
