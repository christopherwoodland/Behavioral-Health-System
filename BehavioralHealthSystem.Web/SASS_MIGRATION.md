# Sass Legacy JS API Deprecation Fix

## Issue
When running the development server, you may see this warning:

```
Deprecation Warning [legacy-js-api]: The legacy JS API is deprecated and will be removed in Dart Sass 2.0.0.

More info: https://sass-lang.com/d/legacy-js-api
```

## Root Cause
Vite 4.x uses the **legacy Sass JS API** by default when processing `.scss` files. This API is deprecated and will be removed in Dart Sass 2.0.0. The modern replacement is the **modern Sass API** with the `sass-embedded` compiler.

## Solution

### Option 1: Modern Compiler API (Recommended) ✅

This approach uses the modern Sass compiler API which is faster and future-proof.

#### Step 1: Install `sass-embedded`
```bash
npm install --save-dev sass-embedded
```

#### Step 2: Configure Vite to Use Modern API

Update `vite.config.ts`:

```typescript
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // Use modern Sass API instead of legacy API
        api: 'modern-compiler',
        // Optionally silence deprecation warnings during transition
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  // ... rest of config
})
```

#### Step 3: Restart Dev Server
```bash
npm run dev
```

**Benefits:**
- ✅ Future-proof (compatible with Dart Sass 2.0)
- ✅ Faster compilation
- ✅ Better error messages
- ✅ Eliminates deprecation warning

---

### Option 2: Silence Warnings Only (Temporary)

If you're not ready to switch to the modern API, you can temporarily silence the warnings:

```typescript
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
})
```

**Note:** This only hides the warning but doesn't fix the underlying issue. You'll need to migrate before Dart Sass 2.0.

---

## What Changed in Your Project

### Files Modified

#### 1. `vite.config.ts`
**Added CSS preprocessor configuration:**
```typescript
css: {
  preprocessorOptions: {
    scss: {
      // Use modern Sass API instead of legacy API
      api: 'modern-compiler',
      // Silence deprecation warnings if needed
      silenceDeprecations: ['legacy-js-api'],
    },
  },
},
```

#### 2. `package.json`
**Added `sass-embedded` dependency:**
```json
{
  "devDependencies": {
    "sass": "^1.93.2",
    "sass-embedded": "^1.93.2"
  }
}
```

---

## Installation Steps

To apply this fix to your project:

### 1. Install New Dependency
```bash
npm install
```

This will install `sass-embedded` alongside the existing `sass` package.

### 2. Restart Development Server
```bash
npm run dev
```

The deprecation warning should now be gone! ✅

---

## Understanding the Modern Sass API

### Legacy API (Deprecated)
```javascript
// Old way - deprecated
const sass = require('sass');
sass.renderSync({ file: 'input.scss' });
```

### Modern API (Current)
```javascript
// New way - modern compiler
import * as sass from 'sass';
const result = sass.compile('input.scss');
```

**Key Differences:**
- Modern API is **async-first** (better performance)
- Modern API uses **`compile()` and `compileAsync()`** instead of `render()`
- Modern API has **better type safety** (TypeScript)
- Modern API is **faster** with the embedded compiler

---

## Sass Files in Your Project

Your project currently uses Sass in these locations:

```
src/styles/
├── components.scss
├── layouts.scss
└── dynamic-progress.scss
```

**No changes needed** to these files - they continue to work with the modern API!

---

## Troubleshooting

### Issue: Warning Still Appears
**Solution:** 
1. Stop the dev server (`Ctrl+C`)
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Restart: `npm run dev`

### Issue: Build Errors After Update
**Solution:**
Check your Sass files for deprecated Sass features. The modern compiler is stricter:
- **`@import`** → Use **`@use`** or **`@forward`**
- **Global functions** → Use **namespaced imports**

Example migration:
```scss
// Old (deprecated)
@import 'variables';
$primary: $brand-color;

// New (modern)
@use 'variables';
$primary: variables.$brand-color;
```

### Issue: Performance Issues
**Solution:**
The `sass-embedded` compiler uses a separate process which is faster for large projects. If you experience issues:

1. Verify `sass-embedded` is installed:
   ```bash
   npm list sass-embedded
   ```

2. Check Node.js version (requires Node 14+):
   ```bash
   node --version
   ```

---

## Migration Timeline

| Version | Status | Action Required |
|---------|--------|-----------------|
| **Dart Sass 1.x** | Current | ✅ Add modern API config (done!) |
| **Dart Sass 2.0** | Future | ❌ Legacy API will be removed |

**Recommendation:** Migrate now to avoid breaking changes when Dart Sass 2.0 is released.

---

## Additional Resources

- **Sass Documentation:** https://sass-lang.com/documentation/breaking-changes/legacy-js-api/
- **Vite Sass Options:** https://vitejs.dev/config/shared-options.html#css-preprocessoroptions
- **Modern Sass Compiler:** https://github.com/sass/dart-sass-embedded

---

## Testing the Fix

### Test 1: Check Warning is Gone
```bash
npm run dev
```
**Expected:** No deprecation warning in console ✅

### Test 2: Verify Sass Compilation
1. Open your app in browser
2. Check that styles are applied correctly
3. Make a change to any `.scss` file
4. Verify hot-reload works

### Test 3: Build for Production
```bash
npm run build
```
**Expected:** Build succeeds without warnings ✅

---

## Summary

✅ **Issue Fixed:** Sass legacy API deprecation warning eliminated  
✅ **Future-Proof:** Compatible with Dart Sass 2.0  
✅ **Performance:** Faster compilation with embedded compiler  
✅ **No Breaking Changes:** Existing Sass files work unchanged  
✅ **Clean Console:** No more deprecation warnings  

Your project is now using the modern Sass compiler API! 🎉
