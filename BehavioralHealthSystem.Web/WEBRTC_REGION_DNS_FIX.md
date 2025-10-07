# Azure OpenAI Realtime WebRTC - Region DNS Error Fix

## Error
```
POST https://eastus.realtimeapi-preview.ai.azure.com/v1/realtimertc?model=gpt-realtime 
net::ERR_NAME_NOT_RESOLVED
```

## Root Cause

1. **Dev server not restarted** - Environment variables only load when the server starts
2. **Wrong region** - The service is using `eastus` but your `.env.local` has `eastus2`

## Available Regions

According to Microsoft's documentation, Azure OpenAI Realtime WebRTC endpoints are only available in specific regions:

✅ **Confirmed Working Regions:**
- `swedencentral` - https://swedencentral.realtimeapi-preview.ai.azure.com/v1/realtimertc
- `eastus2` - https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc

❌ **Not Available:**
- `eastus` - DNS does not resolve (this is your error!)

## Solution

### Step 1: Verify Your Azure OpenAI Resource Region

1. Open Azure Portal
2. Navigate to your Azure OpenAI resource: `cdc-traci-aif-002`
3. Check the **Location** field
4. Possible locations:
   - If it says **"East US 2"** → Use `eastus2`
   - If it says **"Sweden Central"** → Use `swedencentral`

### Step 2: Update .env.local (if needed)

Your `.env.local` currently has:
```bash
VITE_AZURE_OPENAI_WEBRTC_REGION=eastus2
```

This is correct IF your Azure resource is in East US 2.

If your resource is in a different region, update this line to match.

### Step 3: Restart Dev Server (REQUIRED!)

**Critical:** Environment variable changes only take effect after restarting the dev server.

```powershell
# Stop the current dev server
# Press Ctrl+C in the terminal running npm run dev

# OR if using local-run.ps1, stop it and restart:
cd C:\Users\cwoodland\dev\BehavioralHealthSystem\scripts
.\local-run.ps1
```

### Step 4: Clear Browser Cache (Recommended)

```
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
```

---

## Verification

After restarting, check the console output. You should see:

```
🔧 Azure OpenAI Realtime Config:
  Resource: cdc-traci-aif-002
  Deployment: gpt-realtime
  API Version: 2025-04-01-preview
  WebRTC Region: eastus2    ← Should match your Azure resource region
```

Then when connecting:
```
📡 WebRTC URL: https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc?model=gpt-realtime
```

**The domain should resolve** (no ERR_NAME_NOT_RESOLVED)

---

## Common Issues

### Issue 1: Still says "eastus" instead of "eastus2"
**Cause:** Dev server not restarted or browser cached old version

**Solution:**
1. Completely stop dev server
2. Restart it
3. Hard refresh browser (Ctrl+Shift+R)

### Issue 2: ERR_NAME_NOT_RESOLVED persists
**Cause:** Region mismatch or unsupported region

**Solution:**
1. Verify Azure resource region in portal
2. Use only supported regions: `eastus2` or `swedencentral`
3. Update `.env.local` to match
4. Restart dev server

### Issue 3: 403 or 401 error instead
**Symptom:** DNS resolves but auth fails

**Possible causes:**
- API key incorrect
- Deployment name doesn't exist
- Region mismatch between resource and WebRTC endpoint

**Solution:**
1. Verify API key from Azure Portal
2. Confirm deployment name exists
3. Ensure WebRTC region matches Azure OpenAI resource region

---

## Reference: Regional Endpoints

| Azure Resource Region | WebRTC Endpoint | Status |
|-----------------------|-----------------|--------|
| East US 2 | `eastus2.realtimeapi-preview.ai.azure.com` | ✅ Working |
| Sweden Central | `swedencentral.realtimeapi-preview.ai.azure.com` | ✅ Working |
| East US | `eastus.realtimeapi-preview.ai.azure.com` | ❌ Does not exist |

---

## Next Steps

1. ✅ Verify Azure OpenAI resource region in portal
2. ✅ Confirm `.env.local` has correct region (`eastus2` or `swedencentral`)
3. ✅ **RESTART dev server** (critical!)
4. ✅ Hard refresh browser
5. ✅ Click "Start Session" and check console

---

**Status:** Environment variable issue - restart required  
**Expected result:** DNS should resolve after restart with correct region
