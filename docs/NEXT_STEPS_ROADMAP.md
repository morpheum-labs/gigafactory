# Next Steps Roadmap

## ✅ Completed

1. **Canvas UI Improvements** - LiteGraph.js-inspired architecture
2. **Pan & Zoom** - Classic mouse wheel zoom, right-click drag pan
3. **Workspace Scaling** - Zoom-aware rendering, title-only mode
4. **LocalStorage Persistence** - Workspaces and viewport state
5. **Rendering Modularization** - Extracted 5 rendering modules

## 🎯 Recommended Next Steps (Priority Order)

### Phase 1: Complete Import Functionality (High Priority) ⚠️

**Current State**: Import is partially implemented (logs to console)
**Impact**: Users can export but can't fully import graphs

**Tasks**:
1. Implement `GraphModel → Workspaces` conversion
2. Add workspace creation from imported nodes
3. Restore connections from imported graph
4. Handle viewport state from imported graph
5. Add error handling and validation

**Files to Modify**:
- `src/canvas/CanvasRoot.tsx` - Complete `handleImport`
- `src/lib/graph/WorkspaceNodeAdapter.ts` - Add `createWorkspaceFromNode`
- `src/stores/workspaces.ts` - Add batch import methods

**Estimated Effort**: 2-3 hours
**Value**: High - Completes export/import workflow

---

### Phase 2: Extract Event Handlers (Medium Priority) 🔧

**Current State**: 700+ lines of event handling inline in CanvasRoot
**Impact**: Further modularization, easier testing

**Tasks**:
1. Create `src/lib/canvas/CanvasEventHandlers.ts`
   - Pointer events (down, move, up)
   - Wheel events (zoom)
   - Keyboard shortcuts
   - Context menu handling
2. Create `src/lib/canvas/WorkspaceFactory.ts`
   - Quick-create logic
   - Grid snapping integration
   - Auto-connect logic
3. Update CanvasRoot to use extracted handlers

**Files to Create**:
- `src/lib/canvas/CanvasEventHandlers.ts`
- `src/lib/canvas/WorkspaceFactory.ts`

**Estimated Effort**: 3-4 hours
**Value**: Medium - Better code organization

---

### Phase 3: Performance Optimizations (Medium Priority) ⚡

**Current State**: Renders everything every frame
**Impact**: Better performance with large graphs

**Tasks**:
1. **Viewport Culling**
   - Only render visible workspaces
   - Skip off-screen connections
   - Optimize grid rendering

2. **Dirty Flag System**
   - Track what needs re-rendering
   - Incremental updates
   - Reduce unnecessary renders

3. **Memoization**
   - Memoize rendering functions
   - Cache coordinate calculations
   - Optimize expensive operations

**Files to Modify**:
- `src/lib/canvas/GridRenderer.ts` - Add culling
- `src/lib/canvas/ConnectionRenderer.ts` - Add culling
- `src/lib/canvas/NodeRenderer.ts` - Add culling
- `src/canvas/CanvasRoot.tsx` - Add dirty flags

**Estimated Effort**: 4-5 hours
**Value**: Medium-High - Better performance

---

### Phase 4: Extract Particle System (Low Priority) 🎨

**Current State**: 50+ lines of particle logic inline
**Impact**: Minor modularization

**Tasks**:
1. Create `src/lib/canvas/ParticleSystem.ts`
   - Particle creation
   - Particle updates
   - Particle rendering
2. Update CanvasRoot to use ParticleSystem

**Files to Create**:
- `src/lib/canvas/ParticleSystem.ts`

**Estimated Effort**: 1-2 hours
**Value**: Low - Minor improvement

---

### Phase 5: Testing (High Priority) 🧪

**Current State**: No unit tests for rendering modules
**Impact**: Confidence in refactoring, catch bugs early

**Tasks**:
1. Add unit tests for rendering modules
   - `GridRenderer.test.ts`
   - `ConnectionRenderer.test.ts`
   - `NodeRenderer.test.ts`
   - `CanvasUtils.test.ts`
2. Add integration tests
   - Canvas rendering flow
   - Event handling
   - Viewport interactions

**Files to Create**:
- `src/lib/canvas/__tests__/GridRenderer.test.ts`
- `src/lib/canvas/__tests__/ConnectionRenderer.test.ts`
- `src/lib/canvas/__tests__/NodeRenderer.test.ts`
- `src/lib/canvas/__tests__/CanvasUtils.test.ts`

**Estimated Effort**: 4-6 hours
**Value**: High - Quality assurance

---

### Phase 6: Additional Features (Future) 🚀

**Ideas**:
1. **Multi-select** - Select multiple workspaces
2. **Copy/Paste** - Duplicate workspaces
3. **Undo/Redo** - Action history
4. **Minimap** - Overview navigation
5. **Layers** - Group workspaces into layers
6. **Templates** - Save/load workspace templates
7. **Search** - Find workspaces by name/content
8. **Keyboard Navigation** - Arrow keys to move between workspaces

**Estimated Effort**: Varies
**Value**: High - Enhanced UX

---

## 🎯 Immediate Next Step Recommendation

### **Phase 1: Complete Import Functionality** ⭐

**Why**:
- Export works but import is incomplete
- Users expect full round-trip functionality
- Relatively quick to implement
- High user value

**Implementation Plan**:

1. **Create workspace from GraphNode**:
```typescript
// src/lib/graph/WorkspaceNodeAdapter.ts
export function createWorkspaceFromNode(
  node: GraphNode,
  defaultSize: { width: number; height: number }
): Omit<Workspace, 'id' | 'createdAt'> {
  // Convert GraphNode back to Workspace format
}
```

2. **Batch import workspaces**:
```typescript
// src/stores/workspaces.ts
importWorkspaces: (workspaces: Omit<Workspace, 'id'>[]) => void;
```

3. **Complete handleImport**:
```typescript
const handleImport = async () => {
  const model = await loadGraphFromFile(file);
  if (model) {
    // Convert nodes to workspaces
    const workspaces = model.getNodes().map(node => 
      createWorkspaceFromNode(node, { width: 280, height: 280 })
    );
    
    // Batch add workspaces
    importWorkspaces(workspaces);
    
    // Restore connections
    model.getConnections().forEach(conn => {
      connectWorkspaces(conn.fromId, conn.toId);
    });
  }
};
```

**Estimated Time**: 2-3 hours
**Difficulty**: Medium
**Impact**: High

---

## 📊 Progress Tracking

| Phase | Status | Priority | Effort | Value |
|-------|--------|----------|--------|-------|
| Phase 1: Import | ⚠️ Incomplete | High | 2-3h | High |
| Phase 2: Event Handlers | 📋 Planned | Medium | 3-4h | Medium |
| Phase 3: Performance | 📋 Planned | Medium | 4-5h | Medium-High |
| Phase 4: Particles | 📋 Planned | Low | 1-2h | Low |
| Phase 5: Testing | 📋 Planned | High | 4-6h | High |
| Phase 6: Features | 💡 Ideas | Varies | Varies | High |

---

## 🎯 Quick Wins (Can Do Now)

1. **Fix Import** (2-3 hours) - Complete the TODO
2. **Add Error Handling** (1 hour) - Better user feedback
3. **Add Loading States** (1 hour) - Better UX during import/export
4. **Documentation** (1 hour) - Update user guide

---

## 💡 Recommendation

**Start with Phase 1: Complete Import Functionality**

This will:
- ✅ Complete the export/import workflow
- ✅ Provide immediate user value
- ✅ Be relatively quick to implement
- ✅ Set foundation for future features

Then proceed with:
- Phase 5: Testing (to ensure quality)
- Phase 3: Performance (if needed)
- Phase 2: Event Handlers (for better organization)

---

*Last Updated: January 2026*
