# Conditional Node Handle Connection Fix

## Issue

Conditional node branch handles were not allowing users to drag connections to other nodes after being configured via the config dialog.

### Symptoms
- OLD conditional nodes (loaded from saved state) worked correctly
- NEW conditional nodes (branches added via config dialog) did not work
- Handles appeared visually but were not draggable/connectable

## Root Cause

When conditional node branches are added dynamically via the config dialog, React Flow does not automatically recalculate the handle bounds for the newly created handles. This is because:

1. React Flow registers handles during the initial node mount
2. When handles are added after mount (via dynamic data updates), React Flow's internal connection system doesn't know about them
3. The missing `pointerEvents: 'all'` CSS property was also preventing handle interactions

## Solution

### 1. Added `useUpdateNodeInternals` Hook (workflow-canvas.tsx)

```typescript
import { useUpdateNodeInternals } from '@xyflow/react';

// In component:
const updateNodeInternals = useUpdateNodeInternals();

const handleConfigSave = useCallback(
  (data: WorkflowNodeData, clearOutgoingEdges?: boolean) => {
    // ... update node data ...

    // CRITICAL: Force React Flow to recalculate handle bounds
    setTimeout(() => {
      updateNodeInternals(selectedNodeForConfig);
    }, 50);
  },
  [selectedNodeForConfig, setNodes, setEdges, updateNodeInternals]
);
```

The `setTimeout` ensures the DOM has updated before React Flow recalculates handle positions.

### 2. Restored `pointerEvents: 'all'` (workflow-node.tsx)

Added `pointerEvents: 'all'` to conditional node handle styles:

```typescript
<Handle
  // ... other props ...
  style={{
    left: `${leftPercent}%`,
    transform: 'translateX(-50%)',
    bottom: '-8px',
    backgroundColor: condition.color || '#3B82F6',
    zIndex: 100,
    cursor: 'crosshair',
    pointerEvents: 'all',  // Ensures handle receives pointer events
  }}
/>
```

## Files Modified

| File | Change |
|------|--------|
| `components/workflow-editor/workflow-canvas.tsx` | Added `useUpdateNodeInternals` import and call after config save |
| `components/workflow-editor/workflow-node.tsx` | Added `pointerEvents: 'all'` to handle styles |

## Verification

After the fix, all conditional node handles show:
- `pointerEvents: "all"`
- `connectable` class
- `connectionindicator` class
- Correct 17px size
- `zIndex: 100`

New branches created via the config dialog are immediately usable for creating connections.

## Related Documentation

- [Workflow Form Node Fix](./WORKFLOW_FORM_NODE_FIX.md)
- [E2E Workflow Test Results](./E2E_WORKFLOW_TEST_RESULTS.md)

## Date

December 7, 2025
