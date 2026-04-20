# Inkwell v10 — Community Admin Controls + Privacy Fix

## Changes Made

### 1. **Admin Community Management** ✅
- **Edit Community**: Admins can now edit name, description, emoji, and category
- **Delete Community**: Admins can delete entire communities (with confirmation)
- **Delete Posts**: Admins can remove individual articles from community feeds
- Added admin control buttons in community header
- Added modal form for editing community details

**Files Modified:**
- `src/pages/community/CommunityPage.tsx` - Added edit/delete handlers and modals
- `src/pages/community/CommunityPage.module.css` - Added styles for edit form and delete button
- `src/lib/supabase.ts` - Added `updateCommunity()`, `deleteCommunity()`, `deleteCommunityPost()` functions

### 2. **Daily Verse Per Community** ✅
- Each community now gets a **unique, deterministic verse** based on the day + community ID
- Same verse displays for all members in a community on a given day
- Different communities see different verses on the same day
- Verse changes daily at midnight UTC

**Files Modified:**
- `src/lib/supabase.ts` - Rewrote `fetchVerseOfDay()` with hash-based selection
- `src/components/VerseOfDay.tsx` - Added optional `communityId` prop
- `src/pages/community/CommunityPage.tsx` - Pass `community.id` to VerseOfDay component

**Technical Implementation:**
```typescript
// Creates deterministic seed from date + communityId
const today = new Date().toISOString().split('T')[0]  // "2026-04-20"
const seed = communityId ? `${today}-${communityId}` : today
// Hash the seed and use it to select from 31 verses
```

### 3. **Community Post Privacy (RLS Fix)** 🔴 **REQUIRES DATABASE MIGRATION**
- **CRITICAL FIX**: Community posts are now PRIVATE to members only
- Previously: approved posts were publicly readable by anyone
- Now: only community members can see approved posts in their communities

**Migration Required:**
Run `fix-community-privacy-rls.sql` in your Supabase SQL Editor

**What Changed:**
- Dropped `"Approved posts are public"` policy
- Created `"Community members can read posts"` policy with proper member checks
- Members see approved posts only
- Submitters see their own pending/rejected submissions
- Admins see everything in their community

### 4. **Pending Queue Notification Persistence** ✅
**NO CHANGES NEEDED** - Already working correctly in the code.

The frontend already removes items from the pending queue immediately:
```typescript
setPending(p => p.filter(x => x.id !== postId))
```

If notifications persist after refresh, the issue is in your database:
- Check that `reviewCommunityPost()` is actually updating the status
- Verify the RLS policies allow the update
- Check for failed API calls in browser network tab

## New SQL Functions
Added to `src/lib/supabase.ts`:

```typescript
updateCommunity(communityId, { name, description, emoji, category })
deleteCommunity(communityId)
deleteCommunityPost(postId)
fetchVerseOfDay(communityId?) // Made deterministic
```

## Installation & Deployment

### 1. Apply Database Migration
```bash
# In Supabase SQL Editor, run:
fix-community-privacy-rls.sql
```

### 2. Build & Deploy
```bash
npm install
npm run build
# Deploy dist/ to Vercel
```

### 3. Verify Changes
- Create/edit/delete a community as admin
- Check that verse is the same for all members today
- Verify non-members cannot see community posts
- Test admin post removal

## Breaking Changes
⚠️ **RLS Policy Change**: If you have external integrations that read community posts, they will break after the migration. Only authenticated members can now read posts.

## Next Steps / Known Issues
- Consider adding admin transfer functionality (currently only creator can delete)
- Add bulk post moderation in review queue
- Add community settings page for more granular controls
- Consider adding "featured" posts or pinned announcements

---
**Version:** v10  
**Date:** April 20, 2026  
**Author:** Denis Ochieng (lebrondeno)
