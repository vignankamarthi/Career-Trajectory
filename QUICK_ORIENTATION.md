# Quick Orientation for Claude Code Instances

**Last Updated**: 2025-11-09 16:10
**Purpose**: Get any Claude Code instance up to speed in 60 seconds

---

## Recent Critical Changes (2025-11-09)

### ✅ Navigation & State Persistence Fix (CRITICAL)
**Status**: Production
**Details**: See `NAVIGATION_STATE_FIX_2025-11-09.md`

**Key Rules**:
- Conversation cleared ONLY when entering Timeline View (after generation)
- Conversation preserved on all Home button clicks
- Home button works from Chat AND Timeline views
- Navigation handler pattern: App.tsx registers handler from ConversationalConfigView

**If Navigation Broken**:
1. Check App.tsx lines 95-131 (handleNavigateHome, handleResetTimeline, handleTimelineCreated)
2. Verify console logs: `[APP NAV]`, `[CHAT NAV]`, `[CHAT STATE]`
3. Test localStorage key: `career-trajectory-conversation`

---

## System Architecture (30-second version)

**Three Pages**:
1. **Home** - Initial form, sidebar with saved timelines, start/continue chat
2. **Chat** - Conversational configuration agent
3. **Timeline** - View generated timeline with blocks

**State Flow**:
```
Home → Chat → Home (conversation saved)
     ↓
Generate Timeline → Timeline View (conversation cleared)
     ↓
Home (conversation still cleared, can start new)
```

**localStorage Keys**:
- `career-trajectory-conversation` - Chat state (cleared on Timeline View entry)
- `career-trajectory-phase` - Current view (configuration | timeline)
- `career-trajectory-timeline-id` - Active timeline ID

---

## Server Setup

**Ports**:
- Backend: 3001 (http://localhost:3001)
- Frontend: 3000 (http://localhost:3000)

**Start Commands**:
```bash
# Backend (from /backend)
ANTHROPIC_API_KEY=... PARALLEL_API_KEY=... PORT=3001 npm run dev

# Frontend (from /frontend)
PORT=3000 npm run dev
```

**Common Issue**: Both servers on same port → API fails
**Fix**: Kill all, restart backend 3001 first, then frontend 3000

---

## File Structure (Key Locations)

**Backend** (`/backend/src/`):
- `routes/configure-with-context.ts` - Main config endpoint
- `agents/configuration-agent.ts` - Timeline generation
- `agents/conversational-*.ts` - Chat agents
- `database/db.ts` - SQLite database
- `server.ts` - Express + WebSocket server

**Frontend** (`/frontend/src/`):
- `App.tsx` - Navigation & phase management **[MODIFIED 2025-11-09]**
- `views/ConversationalConfigView.tsx` - Chat interface **[MODIFIED 2025-11-09]**
- `views/TimelineView.tsx` - Timeline display
- `lib/api.ts` - API client (points to port 3001)

**Documentation**:
- `NAVIGATION_STATE_FIX_2025-11-09.md` - Recent navigation fix details
- `CURRENT_STATE.md` - Project status (may be outdated)
- `README.md` - Public-facing docs
- `QUICKSTART.md` - Setup instructions

---

## Recent Work Log

**2025-11-09 16:00-16:10**:
- Fixed Home button navigation from Chat interface
- Fixed conversation persistence across view changes
- Conversation now only cleared when entering Timeline View
- Added comprehensive logging ([APP NAV], [CHAT NAV], [CHAT STATE])
- Servers properly configured (backend 3001, frontend 3000)

**What Was Broken**:
- Home button did nothing from Chat
- Conversation lost on Timeline → Home navigation
- Conversation lost on multi-view navigation

**What Was Fixed**:
- Home button returns to Home page from Chat
- Conversation preserved on all navigation except Timeline View entry
- Clear logging for debugging navigation issues

---

## Debug Commands

**Check servers**:
```bash
lsof -i :3000,3001  # Should show node on 3001, vite on 3000
curl http://localhost:3001/api/configure-with-context/history  # Test backend
```

**Check localStorage** (Browser DevTools Console):
```javascript
JSON.parse(localStorage.getItem('career-trajectory-conversation'))
localStorage.getItem('career-trajectory-phase')
localStorage.getItem('career-trajectory-timeline-id')
```

**Console log prefixes**:
- `[APP NAV]` - App-level navigation
- `[CHAT NAV]` - Chat-specific navigation
- `[CHAT STATE]` - State changes
- `[PERSIST]` - LocalStorage operations

---

## Common Tasks

### Start Development
```bash
# Terminal 1: Backend
cd backend
ANTHROPIC_API_KEY=... PARALLEL_API_KEY=... PORT=3001 npm run dev

# Terminal 2: Frontend
cd frontend
PORT=3000 npm run dev
```

### Debug Navigation Issues
1. Open http://localhost:3000
2. Open browser DevTools console
3. Look for `[APP NAV]`, `[CHAT NAV]`, `[CHAT STATE]` logs
4. Check localStorage: `career-trajectory-conversation`
5. Verify current phase matches UI

### Fix Port Conflicts
```bash
lsof -ti:3000,3001 | xargs kill -9  # Kill everything
# Then restart backend first (3001), then frontend (3000)
```

---

## Critical Rules (Don't Break These!)

1. **Conversation Clearing**:
   - ✅ Clear on `handleTimelineCreated()` (entering Timeline View)
   - ✅ Clear on "Start New Chat" confirmation
   - ❌ Never clear on Home button click
   - ❌ Never clear on Timeline → Home navigation

2. **Navigation Handler**:
   - App.tsx stores `chatNavigationHandler` from ConversationalConfigView
   - Handler calls `setShowInitialForm(true)` to return to Home
   - Handler registered in useEffect, unregistered on unmount

3. **Server Ports**:
   - Backend MUST be on 3001 (api.ts expects this)
   - Frontend can be any port (but typically 3000)
   - Never run both on same port

4. **Phase Management**:
   - `phase: 'configuration'` = Home OR Chat (both use ConversationalConfigView)
   - `phase: 'timeline'` = Timeline View
   - `showInitialForm` controls Home vs Chat within configuration phase

---

## Testing Checklist (30 seconds)

Quick smoke test:
1. ✅ Home page loads with sidebar
2. ✅ Start chat → Chat interface appears
3. ✅ Home button → Returns to Home with "Continue or Start New Chat"
4. ✅ Continue chat → Returns to Chat
5. ✅ View old timeline → Timeline displays
6. ✅ Home button from Timeline → Returns to Home
7. ✅ Generate timeline → Conversation cleared, Timeline View shown

---

## If Something's Broken

**Navigation not working?**
→ Read `NAVIGATION_STATE_FIX_2025-11-09.md`

**Conversation not persisting?**
→ Check console for `[PERSIST]` logs, inspect localStorage

**API calls failing?**
→ Verify backend on 3001, frontend on 3000, check CORS

**Can't find file?**
→ Use File Structure section above

**General confusion?**
→ Read this file top to bottom (2 minutes)

---

*This file is intentionally brief. For deep dives, see linked documentation.*
