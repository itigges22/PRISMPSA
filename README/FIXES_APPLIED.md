# Capacity System - Fixes Applied (Nov 7, 2025)

## ✅ **FIXED Issues**

### 1. ✅ Dashboard Layout
- **Issue**: Capacity data was above tasks
- **Fix**: Moved capacity widget below tasks component
- **Status**: COMPLETE

### 2. ✅ Team/Org Views on Dashboard
- **Issue**: Dashboard showed team/org capacity views (should only be on dept/account pages)
- **Fix**: Added `showViewSelector` prop to `CapacityDashboard`, set to `false` on dashboard
- **Status**: COMPLETE

### 3. ✅ "Database connection not available" Error
- **Issue**: API routes were using `createClientSupabase()` which returns null on server-side
- **Fix**: Updated all API routes to use `createApiSupabaseClient(request)` from `lib/supabase-server.ts`:
  - `app/api/capacity/route.ts`
  - `app/api/availability/route.ts`
  - `app/api/time-entries/route.ts`
- **Status**: COMPLETE

### 4. ✅ Drag-and-Set Calendar on Dashboard  
- **Issue**: No calendar component on dashboard
- **Fix**: Added `<DragAvailabilityCalendar>` component below capacity data on dashboard
- **Layout**: Tasks → Capacity Data → Calendar → Profile/Quick Links
- **Status**: COMPLETE

---

## ⚠️ **REMAINING Issues to Fix**

### 1. ❌ Daily/Weekly/Quarterly Filters
- **Issue**: Capacity Data should have time period filters
- **Action Needed**: Add filter buttons (Daily/Weekly/Quarterly) to CapacityDashboard
- **Files**: `components/capacity-dashboard.tsx`

### 2. ❌ Org Analytics Page - No Capacity Data
- **Issue**: `/analytics` page missing capacity metrics
- **Action Needed**: Add capacity widget to analytics page
- **Files**: `app/analytics/page.tsx` (or wherever org analytics lives)

### 3. ❌ Department Cards - Mock Data
- **Issue**: Department cards on `/departments` page show mock capacity data
- **Action Needed**: Replace with real capacity calculations
- **Files**: `app/departments/page.tsx`

### 4. ❌ Replace Workload Distribution with Capacity Graph
- **Issue**: Need to replace workload card with capacity trend graph
- **Action Needed**: 
  - Create chart component using Recharts
  - Replace workload distribution component
- **Files**: Department/Account pages

### 5. ❌ Projects Missing Timeframe/Est Hours/Remaining Hours
- **Issue**: Projects across the site don't show time metrics
- **Action Needed**: Add to ALL project displays:
  - Estimated Hours
  - Remaining Hours
  - Progress percentage
- **Files**: 
  - `components/assigned-projects-section.tsx` (dashboard)
  - `app/table-view/page.tsx`
  - `app/kanban/page.tsx`
  - All other project list components

---

## 🔧 **Next Steps Priority**

1. **HIGH**: Add est/remaining hours to all project cards (most visible impact)
2. **HIGH**: Fix department cards real data
3. **MEDIUM**: Add time period filters to capacity dashboard
4. **MEDIUM**: Add capacity to org analytics page
5. **MEDIUM**: Build capacity trend graphs
6. **LOW**: Comprehensive testing

---

## 📊 **Files Modified So Far**

✅ `app/dashboard/page.tsx` - Added capacity & calendar widgets  
✅ `components/capacity-dashboard.tsx` - Added showViewSelector prop  
✅ `app/api/capacity/route.ts` - Fixed supabase client  
✅ `app/api/availability/route.ts` - Fixed supabase client  
✅ `app/api/time-entries/route.ts` - Fixed supabase client  

---

**CONTINUING WORK...**

