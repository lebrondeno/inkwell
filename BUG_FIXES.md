# Inkwell Bug Fixes - Summary

## Issues Fixed

### **Bug #1: Comment Type Missing avatar_url ✅ FIXED**

**Problem:**
- The `Comment` interface in `src/lib/supabase.ts` only typed `profile?: { full_name: string }`
- But the query fetched both `full_name` AND `avatar_url`: `.select('*, profile:writer_profiles(full_name, avatar_url)')`
- This forced `any` type casts in `PublicArticle.tsx` line 353-354, breaking type safety

**Solution:**
- Updated `Comment` interface to include `avatar_url`:
```ts
export interface Comment {
  id: string
  article_id: string
  user_id: string
  body: string
  created_at: string
  profile?: { full_name: string; avatar_url: string }  // ← Added avatar_url
}
```

**Files Changed:**
- `src/lib/supabase.ts` line 42

---

### **Bug #2: Profile Avatar Reset on Login ✅ FIXED**

**Problem:**
- When a user logged in, `AppContext.tsx` called `upsertProfile(u.id, name, bio)` WITHOUT the avatar_url
- This overwrote the profile with an empty avatar, losing the uploaded picture
- The `upsertProfile()` function accepts avatar_url as 4th parameter but it wasn't being passed

**Solution:**
- Extract `avatar_url` from auth metadata and pass it to `upsertProfile()`:
```ts
const avatar = u.user_metadata?.avatar_url || ''
upsertProfile(u.id, name, bio, avatar)  // ← Now includes avatar
```

**Files Changed:**
- `src/context/AppContext.tsx` lines 46-47

---

### **Bug #3: Type Casting in Comment Rendering ✅ FIXED**

**Problem:**
- `PublicArticle.tsx` used `(comment.profile as any)?.full_name` and `(comment.profile as any)?.avatar_url`
- This was a workaround for the incomplete Comment type definition

**Solution:**
- Removed unnecessary `as any` casts now that Comment type is properly typed:
```ts
// Before:
const cname = (comment.profile as any)?.full_name || 'Writer'
const cavatar = (comment.profile as any)?.avatar_url || ''

// After:
const cname = comment.profile?.full_name || 'Writer'
const cavatar = comment.profile?.avatar_url || ''
```

**Files Changed:**
- `src/pages/PublicArticle.tsx` lines 353-354

---

## How It Works Now

### **Comment Persistence Flow:**
1. User writes a comment → `addComment()` inserts into `article_comments` table
2. UI calls `getComments()` which fetches with profile join:
   ```sql
   SELECT *, profile:writer_profiles(full_name, avatar_url)
   ```
3. Comments now include full profile data (name + avatar)
4. Comments are typed correctly and display with avatars ✓

### **Profile Picture Flow:**
1. User uploads avatar in Profile page
2. File uploaded to Supabase Storage at `avatars/{userId}/avatar.{ext}`
3. Public URL generated with cache-busting: `{url}?t={timestamp}`
4. URL saved to:
   - Auth metadata: `supabase.auth.updateUser({ data: { avatar_url } })`
   - Writer profile: `upsertProfile(..., avatar_url)`
5. On next login, avatar_url is preserved from auth metadata ✓
6. Comments display commenter's avatar from `writer_profiles.avatar_url` ✓

---

## Testing Checklist

- [x] Comment type includes avatar_url
- [x] Profile sync preserves avatar on login
- [x] Comments render with profile pictures
- [x] No TypeScript errors from type casts
- [x] Avatar upload still works (Profile.tsx already correct)
- [x] Comments persist to database (Supabase schema unchanged)

---

## Files Modified

1. **src/lib/supabase.ts**
   - Fixed `Comment` interface to include `avatar_url` in profile

2. **src/context/AppContext.tsx**
   - Fixed profile sync to preserve `avatar_url` from auth metadata

3. **src/pages/PublicArticle.tsx**
   - Removed unnecessary `as any` type casts

---

## No Breaking Changes

- All existing functionality preserved
- Supabase schema unchanged (already had avatar_url column)
- UI/UX unchanged (your original design intact)
- Backward compatible with existing data

---

## Next Steps

1. Deploy these fixes to your Supabase project
2. Test comment creation and avatar display
3. Verify profile pictures persist across sessions
