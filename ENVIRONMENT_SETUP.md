# Environment Variables Setup

## 📍 Location

Environment variables are accessed in: **`src/lib/supabase.js`**

```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'fallback-url'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'fallback-key'
```

## 📁 Files

### `.env` (Actual Credentials)
- **Location**: Root directory (`/Reactapp/.env`)
- **Status**: Gitignored (not committed to version control)
- **Contains**: Your actual Supabase credentials
- **Purpose**: Used by the application at runtime

### `.env.example` (Template)
- **Location**: Root directory (`/Reactapp/.env.example`)
- **Status**: Committed to version control
- **Contains**: Template with placeholder values
- **Purpose**: Reference for setting up the `.env` file

## 🔧 How It Works

1. **Vite Environment Variables**:
   - Vite automatically loads `.env` files from the project root
   - Only variables prefixed with `VITE_` are exposed to the client
   - Access via `import.meta.env.VITE_VARIABLE_NAME`

2. **Fallback Values**:
   - If `.env` file doesn't exist, the app uses hardcoded fallback values
   - Fallbacks are in `src/lib/supabase.js` (lines 3-4)

3. **Priority**:
   ```
   Environment Variable (.env) > Fallback (hardcoded)
   ```

## 📝 Setup Instructions

### For Development (Current Repo)
1. The `.env` file already exists with current credentials
2. It's gitignored, so it won't be committed
3. You can use it as-is or update it with new values

### When Moving to New Repo
1. Copy `.env.example` to `.env` in the new repo
2. Fill in your Supabase credentials:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Make sure `.env` is in `.gitignore` (already configured)

### Getting Supabase Credentials
1. Go to: https://app.supabase.com/project/_/settings/api
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
   - ⚠️ **DO NOT** use the service_role key (it bypasses RLS)

## 🔒 Security Notes

- ✅ `.env` is gitignored - won't be committed
- ✅ Only anon key is used (safe for client-side)
- ✅ Service role key should NEVER be in frontend code
- ⚠️ Environment variables are exposed in the browser (that's why we use anon key)

## 📦 Files to Copy When Moving Repo

When moving this admin panel to a separate repository, copy:

1. ✅ `.env.example` - Template file (safe to commit)
2. ✅ `.gitignore` - Already excludes `.env`
3. ✅ `src/lib/supabase.js` - Contains the access code
4. ❌ `.env` - **DO NOT copy** (create new one in new repo)

## 🚀 Usage

The app will automatically:
- Load `.env` if it exists
- Use environment variables if available
- Fall back to hardcoded values if `.env` is missing

No code changes needed - just create/update the `.env` file!

