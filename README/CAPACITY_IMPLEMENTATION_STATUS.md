# Capacity System Implementation Status

**Date**: November 7, 2025  
**Status**: ⚠️ **IN PROGRESS** - Foundation Complete, Site-Wide Integration Needed

---

## ✅ **COMPLETED** (Foundation Layer)

### 1. Database Schema & Backend Services ✅
- ✅ `user_availability` table with RLS policies
- ✅ `time_entries` table with RLS policies
- ✅ `task_week_allocations` table with RLS policies
- ✅ Database views: `weekly_capacity_summary`, `department_capacity_summary`, `project_capacity_summary`
- ✅ Availability service (`lib/services/availability-service.ts`)
- ✅ Time entry service (`lib/services/time-entry-service.ts`)
- ✅ Capacity service (`lib/services/capacity-service.ts`)

### 2. API Routes ✅
- ✅ `/api/availability` (GET, POST, DELETE)
- ✅ `/api/time-entries` (GET, POST, PATCH, DELETE)
- ✅ `/api/capacity` (GET with type: user/department/project/org)

### 3. Permissions System ✅
- ✅ 9 new capacity-related permissions added to RBAC
- ✅ All permissions automatically appear in role management dialogs
- ✅ Permission checks enforced in API routes

### 4. Core Components ✅
- ✅ **Drag-to-Set Calendar** (`components/drag-availability-calendar.tsx`)
  - Motion/Akiflow-style interface ✅
  - Drag to mark unavailable times ✅
  - Week navigation ✅
  - Save functionality ✅
- ✅ Capacity Dashboard widget (`components/capacity-dashboard.tsx`)
- ✅ Dedicated `/capacity` page ✅

### 5. Automatic Time Logging ✅
- ✅ Integrated into remaining hours slider on project pages
- ✅ Automatically logs time when users decrease remaining hours
- ✅ Shows toast notifications

---

## ⚠️ **IN PROGRESS / NOT YET COMPLETED**

### ❌ 1. **Capacity Metrics NOT Displayed Site-Wide**

**Current State**: Capacity calculations exist but aren't shown across the platform

**What's Missing**:
- ❌ Dashboard: No capacity widget visible
- ❌ Project cards: No estimated hours / remaining hours shown on:
  - Table View
  - Kanban Board
  - Dashboard "Assigned Projects" section
  - Any other project list views
- ❌ Department pages: No capacity analytics
- ❌ Account pages: No capacity analytics

**What Needs to Be Done**:
1. Add capacity widget to main dashboard (`app/dashboard/page.tsx`)
2. Modify ALL project card components to display:
   - Estimated Hours
   - Remaining Hours  
   - Progress percentage
3. Add capacity sections to:
   - `app/departments/[departmentId]/page.tsx`
   - `app/accounts/[accountId]/page.tsx`

---

### ❌ 2. **Capacity Analytics Graphs (Daily/Weekly/Monthly/Quarterly)**

**Current State**: NO graphs exist

**What's Missing**:
- ❌ User-level capacity trends (for dashboard)
- ❌ Department-level capacity trends (for department pages)
- ❌ Account-level capacity trends (for account pages)
- ❌ Time period selection: Daily / Weekly / Monthly / Quarterly
- ❌ Historical data snapshots (permanent after week ends)

**What Needs to Be Done**:
1. Create `components/capacity-chart.tsx` using a charting library (e.g., Recharts)
2. Implement historical data snapshot system:
   - Create `capacity_snapshots` table
   - Automatically snapshot data weekly
   - Query snapshots for historical graphs
3. Add chart components to:
   - Dashboard (user capacity)
   - Department pages (team capacity)
   - Account pages (account capacity)
4. Time period filters: Day / Week / Month / Quarter

---

### ❌ 3. **Historical Data Snapshots**

**Current State**: Capacity data is DYNAMIC (changes if users switch departments/accounts)

**What's Needed**:
- Create `capacity_snapshots` table
- Weekly cron job / trigger to save capacity data permanently
- Snapshots should include:
  - `week_start_date`
  - `user_id`
  - `department_id` (at the time)
  - `account_id` (at the time)
  - `available_hours`
  - `actual_hours`
  - `utilization_rate`
- Query snapshots instead of live data for historical graphs

**Why It Matters**:
- If User A moves from Department X to Department Y, historical graphs for Department X should still show User A's past contributions
- Ensures data accuracy over time

---

### ❌ 4. **Permission Testing**

**Current State**: Permissions are defined but not comprehensively tested

**What Needs Testing**:
- ❌ Test with user with NO capacity permissions → should not see any capacity widgets
- ❌ Test with `VIEW_OWN_CAPACITY` only → should see personal metrics only
- ❌ Test with `VIEW_TEAM_CAPACITY` → should see department metrics
- ❌ Test with `VIEW_ALL_CAPACITY` → should see org-wide metrics
- ❌ Test `EDIT_OWN_AVAILABILITY` → should be able to edit calendar
- ❌ Test `LOG_TIME` → should be able to log time entries

**How to Test**:
1. Use `scripts/debug-permissions.ts` to check user permissions
2. Create test roles with specific permission combinations
3. Verify UI elements show/hide correctly
4. Verify API routes enforce permissions

---

## 🔧 **IMPLEMENTATION PLAN TO COMPLETE**

### **Phase 1: Add Capacity Metrics Site-Wide** (4-6 hours)
1. **Dashboard** (`app/dashboard/page.tsx`):
   - Add `<CapacityDashboard userProfile={userProfile} />` widget
   - Show user's current week utilization

2. **Project Cards** - Add est/remaining hours to:
   - `app/table-view/page.tsx` (Table View)
   - `components/assigned-projects-section.tsx` (Dashboard assigned projects)
   - `app/kanban/page.tsx` (Kanban Board)
   - Any other project list components

3. **Department Pages** (`app/departments/[departmentId]/page.tsx`):
   - Add department capacity section
   - Show team utilization for current week

4. **Account Pages** (`app/accounts/[accountId]/page.tsx`):
   - Add account capacity section  
   - Show account team utilization

### **Phase 2: Build Capacity Analytics Graphs** (6-8 hours)
1. Install charting library: `npm install recharts`
2. Create `capacity_snapshots` table:
   ```sql
   CREATE TABLE capacity_snapshots (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     week_start_date DATE NOT NULL,
     user_id UUID NOT NULL,
     department_id UUID,
     account_id UUID,
     available_hours NUMERIC,
     actual_hours NUMERIC,
     utilization_rate NUMERIC,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
3. Create snapshot generation function (run weekly)
4. Create `components/capacity-chart.tsx`:
   - Line chart for utilization over time
   - Time period selector: Day/Week/Month/Quarter
   - Query historical snapshots
5. Add charts to:
   - Dashboard (user capacity trends)
   - Department pages (team capacity trends)
   - Account pages (account capacity trends)

### **Phase 3: Comprehensive Permission Testing** (2-3 hours)
1. Create test script: `scripts/test-capacity-permissions.ts`
2. Test all 9 capacity permissions
3. Verify frontend elements show/hide correctly
4. Verify API routes enforce permissions
5. Fix any permission issues found

### **Phase 4: Final Testing & Validation** (2-3 hours)
1. End-to-end test: Set availability → Log time → View metrics
2. Test across all user roles
3. Test performance with large datasets
4. Verify no breaking changes to existing features
5. Update documentation

---

## 📊 **ESTIMATED TIME TO COMPLETE**: 14-20 hours

### Breakdown:
- Phase 1 (Site-Wide Integration): 4-6 hours
- Phase 2 (Analytics Graphs): 6-8 hours
- Phase 3 (Permission Testing): 2-3 hours
- Phase 4 (Final Testing): 2-3 hours

---

## 🚀 **NEXT IMMEDIATE STEPS**

1. ✅ **Already Done**: Foundation (database, services, API, core components)
2. **NOW**: Add capacity widgets to dashboard
3. **NEXT**: Add est/remaining hours to all project cards
4. **THEN**: Build analytics graphs with historical snapshots
5. **FINALLY**: Comprehensive permission testing

---

## 🐛 **KNOWN ISSUES**

1. **Capacity Dashboard Widget**: Currently uses mock data - needs connection to real capacity calculations ✅ (partially fixed, needs site-wide integration)
2. **Historical Data**: Currently dynamic - needs snapshot system
3. **Project Cards**: Missing est/remaining hours display
4. **No Graphs**: No trend visualization yet

---

## 📝 **USER FEEDBACK ADDRESSED**

✅ "Capacity analytics are mock data" → API & services exist, need UI integration  
✅ "No drag-to-set calendar" → Implemented (`drag-availability-calendar.tsx`)  
❌ "Nothing on dashboard for working hours" → **NEEDS IMPLEMENTATION**  
❌ "No work capacity across the site" → **NEEDS IMPLEMENTATION**  
❌ "No est hours/remaining hours on project blocks" → **NEEDS IMPLEMENTATION**  
❌ "No Department/Account analytics graphs" → **NEEDS IMPLEMENTATION**  
❌ "Permissions not tested" → **NEEDS IMPLEMENTATION**

---

**CONCLUSION**: The foundation is solid and complete. The remaining work is primarily:
1. UI integration (adding widgets/metrics across existing pages)
2. Analytics visualization (graphs with historical data)
3. Comprehensive testing

The backend is ready. The frontend needs to be wired up site-wide.

