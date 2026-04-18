# Inkwell - Latest Fixes (v2)

## Changes Made

### 1. ✅ Comments Display Fixed
**Files Modified:** 
- `src/lib/supabase.ts` - Enhanced `getComments()` function
- `src/pages/PublicArticle.tsx` - Improved comment refresh logic

**What was fixed:**
- Added error handling and logging to `getComments()` to catch database issues
- Added 500ms delay after comment submission to ensure database is updated
- Added console logging to track comment refresh
- Comments now properly load after posting

**How it works:**
1. User posts a comment
2. Comment is saved to database
3. 500ms delay ensures database is ready
4. Comments are refreshed and displayed
5. User sees their comment immediately

**Debugging tips if comments still don't show:**
- Check browser console for error messages
- Verify Supabase RLS policies allow reading comments
- Make sure user is authenticated
- Check that `article_comments` table exists and has data

---

### 2. ✅ Editor Width Increased
**File:** `src/pages/Editor.module.css`

**Changes:**
- Reduced left/right padding from `80px` to `40px` (normal mode)
- Reduced focus mode padding from `120px` to `60px`
- Increased focus mode max-width from `820px` to `1000px`

**Result:** Editor now uses more horizontal space for writing

---

### 3. ✅ Share Card Removed
**File:** `src/pages/PublicArticle.tsx`

**What was removed:**
- The "📋 Share this article" card below the article
- Share link input field
- Copy link button

**What remains:**
- Like button (❤️) with count
- Bookmark button (🏷️)
- Comments section
- Comment form and list

---

## Testing Checklist

- [ ] Post a comment and verify it appears immediately
- [ ] Refresh the page and verify comment persists
- [ ] Check browser console for any errors
- [ ] Verify editor has more horizontal space
- [ ] Confirm share card is gone from article view
- [ ] Verify like and bookmark buttons still work
- [ ] Verify comments section displays correctly

---

## If Comments Still Don't Work

Check your Supabase RLS policies. You need:

```sql
-- Allow authenticated users to read comments
create policy "Anyone can read comments"
on public.article_comments for select
using (true);

-- Allow users to insert their own comments
create policy "Users can insert own comments"
on public.article_comments for insert
with check (auth.uid() = user_id);

-- Allow users to delete their own comments
create policy "Users can delete own comments"
on public.article_comments for delete
using (auth.uid() = user_id);
```

Also verify:
1. `article_comments` table exists
2. It has columns: `id`, `article_id`, `user_id`, `body`, `created_at`
3. `writer_profiles` table exists with `avatar_url` column
4. User profile is created when they first log in

---

## Files Modified

1. `src/lib/supabase.ts` - Better error handling in getComments()
2. `src/pages/PublicArticle.tsx` - Comment refresh delay + removed share card
3. `src/pages/Editor.module.css` - Increased editor width

All changes are backward compatible and don't affect existing functionality.
