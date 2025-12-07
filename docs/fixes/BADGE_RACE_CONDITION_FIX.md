# Badge Race Condition Fix

## Issue

Approval/rejection badges on workflow form submissions would flash briefly then disappear until page refresh.

### Symptoms
- After approving/rejecting a form, the badge would appear momentarily
- Badge would then disappear
- Badge would reappear correctly after manual page refresh

## Root Cause

There were two code paths loading workflow form data in `app/projects/[projectId]/page.tsx`:

1. **`loadWorkflowFormData()`** - Comprehensive function that includes `approvalDecision` field
2. **Inline refresh code in `handleWorkflowProgress()`** - Incomplete version that was missing `approvalDecision`

The inline code would execute after `loadWorkflowFormData()`, overwriting the complete data with incomplete data (missing the `approvalDecision` field).

### Race Condition Flow
```
1. User clicks Approve/Reject
2. handleWorkflowProgress() processes the action
3. loadWorkflowFormData() is called (includes approvalDecision) - Badge shows
4. Inline refresh code executes (missing approvalDecision) - Badge disappears
5. State is overwritten with incomplete data
```

## Solution

Removed the redundant inline refresh code from `handleWorkflowProgress()` (lines 937-989), keeping only the `workflowRefreshKey` increment which triggers `loadWorkflowFormData()` via useEffect.

### Before (Problematic)
```typescript
// In handleWorkflowProgress():
setWorkflowRefreshKey(prev => prev + 1); // Triggers loadWorkflowFormData

// Then immediately after, inline code that overwrites the data:
const { data: historyData } = await supabase
  .from('workflow_history')
  .select('...')  // Missing approval_decision!
  .eq('workflow_instance_id', workflowInstance.id);
// ... sets state with incomplete data
```

### After (Fixed)
```typescript
// In handleWorkflowProgress():
setWorkflowRefreshKey(prev => prev + 1); // Triggers loadWorkflowFormData

// Note: Workflow form data is now refreshed via the workflowRefreshKey mechanism
// which triggers loadWorkflowFormData() through the useEffect. This ensures
// the comprehensive loading logic (including approval_decision) is used consistently.
```

## Files Modified

| File | Change |
|------|--------|
| `app/projects/[projectId]/page.tsx` | Removed redundant inline refresh code (lines 937-989) |

## Verification

After the fix:
- Approval/rejection badges persist immediately after action
- No flash-then-disappear behavior
- Consistent state across all refresh triggers

## Related Documentation

- [Workflow Form Node Fix](../workflows/WORKFLOW_FORM_NODE_FIX.md)

## Date

December 7, 2025
