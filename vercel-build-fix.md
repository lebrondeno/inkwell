# Vercel Build Error Fix Guide

## Issue Analysis
Vercel deployment is failing with "Command 'npm run build' exited with 2" but local build succeeds.

## Common Causes & Solutions

### 1. Node Version Mismatch
Vercel might use different Node.js version than local.

**Solution:** Add Node version specification to package.json
```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 2. Missing Environment Variables
Vercel might need environment variables that local doesn't require.

**Solution:** Check Vercel dashboard for required env vars:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

### 3. Build Script Issues
Production build might have different requirements.

**Solution:** Update build script to handle production:
```json
{
  "scripts": {
    "build": "npm ci && npm run build"
  }
}
```

### 4. TypeScript Compilation Issues
Production TypeScript might be stricter.

**Solution:** Add production-specific tsconfig:
```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "strict": false
  }
}
```

## Immediate Actions
1. Check Vercel deployment logs for specific error
2. Verify environment variables in Vercel dashboard
3. Try manual redeployment with environment override
4. Consider adding Node version specification

## Quick Fix Attempt
Add engines field to package.json to specify Node version requirements.
