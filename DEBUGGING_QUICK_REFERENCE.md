# Extended Assessment Debugging - Quick Reference

## 🚀 How to Debug

### 1. Open Browser Console
- Press **F12**
- Go to **Console** tab
- Type `ExtendedRiskAssessment` in the filter box

### 2. Generate Assessment
- Click "Generate Extended Risk Assessment" button
- Watch the console logs

### 3. Look for Key Logs

#### Starting
```
[ExtendedRiskAssessment] 🚀 Starting assessment generation for session: {id}
```

#### Response Received
```
[ExtendedRiskAssessment] 📥 Raw response received: {full JSON}
```

#### Success Checks
```
[ExtendedRiskAssessment] Response structure check:
  - response.success: {true/false}
  - response.data exists: {true/false}
  - response.error: {string/undefined}

[ExtendedRiskAssessment] response.data structure:
  - response.data.success: {true/false}
  - response.data.extendedRiskAssessment exists: {true/false}
```

#### Result
- ✅✅ = Success
- ❌ = Error (with explanation)

---

## 🔍 Quick Diagnosis

### All True = Should Work
```
response.success: true                          ✅
response.data exists: true                      ✅
response.data.success: true                     ✅
response.data.extendedRiskAssessment exists: true  ✅
```

### Any False = Problem Found
```
response.success: false                         ❌ Network/fetch issue
response.data exists: false                     ❌ API not responding properly
response.data.success: false                    ❌ API returned error
response.data.extendedRiskAssessment exists: false ❌ No assessment data
```

---

## 📋 Expected Response Structure

Your API returns:
```json
{
  "success": true,
  "message": "Extended risk assessment generated successfully",
  "extendedRiskAssessment": {...}
}
```

But the component receives (wrapped by `apiCall`):
```json
{
  "success": true,           // ← From fetch wrapper
  "data": {
    "success": true,         // ← From your API
    "message": "...",
    "extendedRiskAssessment": {...}  // ← The actual assessment
  },
  "statusCode": 200
}
```

**Both `success` fields must be `true`!**

---

## 🎯 What the Logs Will Tell You

### Scenario 1: Network Error
```
[ExtendedRiskAssessment] ❌ Wrapper response failed
[ExtendedRiskAssessment] response.success: false
[ExtendedRiskAssessment] Setting error: Request timeout
```
→ **Fix**: Check if Functions app is running, increase timeout

### Scenario 2: API Error
```
[ExtendedRiskAssessment] ❌ Inner response failed or missing extendedRiskAssessment
[ExtendedRiskAssessment] response.data.success: false
```
→ **Fix**: Check Azure Function logic, ensure it returns proper structure

### Scenario 3: Missing Data
```
[ExtendedRiskAssessment] response.data.extendedRiskAssessment exists: false
```
→ **Fix**: Ensure API returns `extendedRiskAssessment` field

### Scenario 4: Type Mismatch
```
[ExtendedRiskAssessment] ❌ Exception caught during generation
[ExtendedRiskAssessment] Exception error message: Cannot read property 'extendedRiskAssessment' of undefined
```
→ **Fix**: Check response structure, verify TypeScript types

---

## 📝 Current Issue

You reported getting HTTP 200 with valid data but seeing "Failed to generate assessment".

The logs will now show **exactly** which check is failing:
1. Is `response.success` true?
2. Does `response.data` exist?
3. Is `response.data.success` true?
4. Does `response.data.extendedRiskAssessment` exist?

**One of these must be false, causing the error message.**

---

## 🛠️ Test Now

1. Open your app at `http://localhost:5173` (or your dev URL)
2. Open DevTools (F12) → Console tab
3. Navigate to a session
4. Click "Generate Extended Risk Assessment"
5. Watch the console logs
6. **Copy and paste the logs here** to diagnose!

---

## 📚 Full Documentation

See [EXTENDED_ASSESSMENT_DEBUGGING.md](./EXTENDED_ASSESSMENT_DEBUGGING.md) for:
- Complete log reference
- All log points
- Common issues and solutions
- Debugging workflow
- Testing checklist

---

## ✅ Changes Made

**File Modified:** `BehavioralHealthSystem.Web/src/components/ExtendedRiskAssessmentButton.tsx`

**Logging Added:**
- `checkStatus()` - 5 log points
- `fetchAssessment()` - 8 log points
- `generateAssessment()` - 15+ log points

**What's Logged:**
- Function start/end
- Full API responses (JSON)
- Structure validation checks
- Success/failure paths
- Error messages

**Build Status:** ✅ Successful (6.90s)

---

## 🎉 Next Steps

After you test and see the logs:

1. **Share the console output** - especially the "📥 Raw response received" log
2. **Identify which check failed** - all the booleans are logged
3. **We'll fix the root cause** - whether it's API structure or component logic

The mystery will be solved! 🕵️
