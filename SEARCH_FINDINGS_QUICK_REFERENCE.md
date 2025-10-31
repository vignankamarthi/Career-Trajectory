# Quick Reference: Component Search Findings

## What You Asked For vs What Was Found

### 1. "Test User" & "Jennifer Chen" Examples (Theme Click Display)
```
LOCATION: /Users/vkamarthi24/Desktop/Career-Trajectory/backend/test-e2e-comprehensive.ts (line 72)
FOUND: "Test User" in backend E2E test scenarios only
NOT FOUND: "Jennifer Chen" example anywhere
STATUS: NOT visible in UI when clicking brightness/dark mode toggle
```

### 2. Pricing Button with $ Symbol
```
MISSING FROM: /Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/Navigation.tsx
REFERENCES: /Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/views/ConversationalConfigView.tsx (lines 254, 797-803)
STATUS: References exist but button doesn't exist
ACTION: Need to create PricingButton component and add to Navigation
```

### 3. Page Reload Persistence
```
WORKING: Theme persists via localStorage in /Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/contexts/ThemeContext.tsx (lines 14-22)
MISSING: Pricing/Model selection persistence
MISSING: Form data persistence
CODE PATTERN TO FOLLOW: Use localStorage.getItem() in useState initializer, localStorage.setItem() in useEffect
```

### 4. Parallel API Model Configuration
```
BACKEND: READY & COMPLETE in /Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/services/parallel.ts
FRONTEND: INCOMPLETE
  - ConfigurationView has model selection (lines 18-40) ✓
  - ConversationalConfigView has hardcoded values (lines 802-803 TODO) ✗
  - No global context provider ✗
  - No API key input UI ✗
NEXT: Create PricingContext.tsx with lite/pro selection and cost calculation
```

---

## Key Files to Review

### For Understanding Persistence (Working Example)
File: `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/contexts/ThemeContext.tsx`
```typescript
// THIS PATTERN WORKS - COPY IT FOR OTHER PERSISTENT STATE
const [theme, setTheme] = useState<Theme>(() => {
  const stored = localStorage.getItem('theme') as Theme | null;
  return stored || defaultValue;
});

useEffect(() => {
  localStorage.setItem('theme', theme);
}, [theme]);
```

### For Understanding Model Selection (Partial Example)
File: `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/views/ConfigurationView.tsx` (lines 18-40)
- Shows how to select between 'lite' and 'pro' models
- Has state management for research model

### For Understanding Missing Implementations
File: `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/views/ConversationalConfigView.tsx`
- Lines 802-803: TODO comments show what's missing
- Line 254: References non-existent "Pricing tab"
- Line 797-803: Shows hardcoded model and cost that should be dynamic

---

## Components That Need to Be Created

1. **PricingContext.tsx**
   - Manage selected model (lite/pro)
   - Store cost per call
   - Persist to localStorage
   - Location: `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/contexts/PricingContext.tsx`

2. **PricingButton.tsx**
   - Display $ symbol button
   - Trigger pricing modal
   - Location: `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/PricingButton.tsx`

3. **PricingModal.tsx**
   - Model selection (lite/pro)
   - Cost display
   - API key input
   - Location: `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/PricingModal.tsx`

4. **ExamplesDisplay.tsx**
   - Show example users (Test User, Jennifer Chen, etc.)
   - Load example timeline on click
   - Location: `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/ExamplesDisplay.tsx`

---

## Files to Modify

1. **Navigation.tsx**
   - Add PricingButton
   - Add ExamplesDisplay or trigger

2. **App.tsx**
   - Wrap app with PricingContext provider

3. **ConversationalConfigView.tsx**
   - Connect to PricingContext (replace hardcoded values)
   - Add cost calculation
   - Remove TODO comments

4. **GenerateConfirmationModal.tsx**
   - Get model/cost from PricingContext instead of props

---

## Code Snippets to Implement

### Module Structure (from working code)
```typescript
// From ThemeContext.tsx - COPY THIS PATTERN
const [value, setValue] = useState<Type>(() => {
  const stored = localStorage.getItem('key');
  return stored || defaultValue;
});

useEffect(() => {
  localStorage.setItem('key', value);
}, [value]);
```

### Model Selection Pattern (from ConfigurationView.tsx)
```typescript
// From ConfigurationView.tsx - ADAPT THIS PATTERN
const getResearchModel = (tier: string): 'lite' | 'pro' => {
  return tier === 'lite' ? 'lite' : 'pro';
};

// In form: Add radio buttons for model selection
```

### Button Component Pattern
```typescript
// Add to Navigation.tsx - SIMILAR TO HOME BUTTON
<button
  onClick={onPricingClick}
  className="p-3 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg hover:shadow-xl transition-all duration-200"
  aria-label="Pricing and model selection"
>
  <span className="text-lg font-bold">$</span>
</button>
```

---

## Database/Test References

### Test Data Location
File: `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/test-e2e-comprehensive.ts`
- Line 72-75: "Test User" test scenario
- Multiple test scenarios with different user profiles

### Logs Showing Test Data
File: `/Users/vkamarthi24/Desktop/Career-Trajectory/logs/system.log`
- Multiple entries show "Test User" being inserted during database constraint tests
- Demonstrates test data structure

---

## Absolute Paths Summary

All paths are absolute from filesystem root:

**Navigation Area (needs Pricing button)**
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/Navigation.tsx`

**Configuration (has hardcoded values to fix)**
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/views/ConversationalConfigView.tsx`

**Persistence Example (copy this pattern)**
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/contexts/ThemeContext.tsx`

**Backend API (ready to use)**
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/services/parallel.ts`

**Test Data**
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/test-e2e-comprehensive.ts`

---

## Priority Implementation Order

1. Create PricingContext.tsx (enables everything else)
2. Create PricingButton.tsx (adds UI)
3. Add PricingButton to Navigation.tsx (makes it visible)
4. Create PricingModal.tsx (allows selection)
5. Update ConversationalConfigView to use PricingContext (removes hardcoding)
6. Add ExamplesDisplay.tsx (bonus feature)

---

Last Updated: 2025-10-31
Search Completed By: Claude Code File Search Specialist
