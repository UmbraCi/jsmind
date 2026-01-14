# History Plugin

The History plugin provides complete undo/redo functionality with history management and snapshot comparison for jsMind.

## Features

-   ✅ **Undo/Redo**: Full undo/redo support with configurable history stack
-   ✅ **Snapshot Management**: Export and import mind map snapshots
-   ✅ **Diff Algorithm**: Advanced snapshot comparison with detailed change tracking
-   ✅ **LIS-based Movement Detection**: Precise detection using Longest Increasing Subsequence algorithm
-   ✅ **Performance Optimized**: Efficient diff algorithm with Map-based lookups
-   ✅ **TypeScript Support**: Complete type definitions

## Installation

```bash
npm install @umbraci/jsmind
```

## Usage

```javascript
import jsMind from '@umbraci/jsmind';
import '@umbraci/jsmind/history';

const jm = new jsMind({
    container: 'jsmind_container',
    editable: true,
    plugins: [
        {
            name: 'history',
            options: {
                enabled: true,
                maxHistory: 500,
                throttleMs: 100,
            },
        },
    ],
});

// Undo/Redo
jm.history.back();
jm.history.forward();

// Snapshot comparison
const snapshot1 = jm.history.exportSnapshot();
// ... make changes ...
const snapshot2 = jm.history.exportSnapshot();

const diff = jm.history.diff(snapshot1, snapshot2);
console.log('Moved:', diff.moved);
console.log('Modified:', diff.modified);
console.log('Created:', diff.created);
console.log('Deleted:', diff.deleted);
```

## Diff Algorithm

The `history-diff.js` module provides a powerful diff algorithm for comparing mind map snapshots, using **LIS (Longest Increasing Subsequence)** algorithm for precise movement detection.

### Key Features

1. **LIS-based Movement Detection**: Accurately distinguishes between "real moves" and "passive shifts" caused by sibling deletions
2. **Move Type Classification**: Categorizes moves as `cross-parent` (different parent) or `reorder` (same parent)
3. **Structure Tracking**: Includes `parentid` and `index` for movement detection
4. **Default Field Comparison**: Compares `['topic', 'data', 'id']` fields by default

### API

#### `diff(snapshotA, snapshotB, options)`

Compares two snapshots and returns detailed differences.

**Parameters:**

-   `snapshotA`: First snapshot (before changes)
-   `snapshotB`: Second snapshot (after changes)
-   `options`:
    -   `includeStructure`: Include structure fields (default: `true`)
    -   `maxSize`: Maximum result size (default: `5000`)

**Returns:**

```typescript
{
    created: FlatNode[],              // Newly created nodes
    deleted: FlatNode[],              // Deleted nodes
    truncated: boolean,               // Whether results were truncated
    moved: MovedNode[],               // Only moved (with moveInfo)
    modified: ModifiedNode[],         // Only modified
    movedAndModified: MovedAndModifiedNode[]  // Both moved and modified
}
```

**Example:**

```javascript
const result = jm.history.diff(snapshot1, snapshot2);

// Check move types
result.moved.forEach(node => {
    if (node.moveInfo.moveType === 'cross-parent') {
        console.log(
            `${node.id} moved from ${node.moveInfo.fromParent} to ${node.moveInfo.toParent}`
        );
    } else if (node.moveInfo.moveType === 'reorder') {
        console.log(
            `${node.id} reordered from index ${node.moveInfo.fromOrder} to ${node.moveInfo.toOrder}`
        );
    }
});
```

### Movement Detection with LIS Algorithm

The algorithm uses **Longest Increasing Subsequence (LIS)** to precisely detect which nodes were actively moved:

| Scenario                              | Detection                               |
| ------------------------------------- | --------------------------------------- |
| Node dragged to different parent      | `moveType: 'cross-parent'`              |
| Node reordered within same parent     | `moveType: 'reorder'`                   |
| Index changed due to sibling deletion | **Not marked as moved** (passive shift) |

```javascript
// Example: Delete node B from [A, B, C, D]
// Result: [A, C, D] - C and D indices decrease but are NOT marked as moved

// Example: Drag D to position 1 in [A, B, C, D]
// Result: [A, D, B, C] - Only D is marked as moved (reorder)
```

### MoveInfo Structure

```typescript
interface MoveInfo {
    moveType: 'cross-parent' | 'reorder'; // Type of move
    parentChanged: boolean; // Whether parent changed
    orderChanged: boolean; // Whether order changed
    fromParent: string | null; // Original parent ID
    toParent: string | null; // New parent ID
    fromOrder: number; // Original index
    toOrder: number; // New index
}
```

### Performance Considerations

-   Uses `Map` instead of `Object` for O(1) lookups
-   LIS algorithm: O(n log n) time complexity
-   Supports `maxSize` option to limit result size
-   Efficient shallow comparison before deep comparison

## Architecture

### Files

-   `jsmind.history.js`: Main plugin implementation with HistoryCore
-   `history-diff.js`: Standalone diff algorithm module with LIS implementation

### Key Components

1. **HistoryPlugin**: Enhanced plugin that mounts `jm.history` API
2. **HistoryCore**: Core implementation of history stack and operations
3. **Diff Module**: Snapshot comparison with LIS-based move detection

### Data Flow

```
User Action → HistoryCore.add() → Take Snapshot → Store in Stack
                                                      ↓
User Undo/Redo ← Apply Snapshot ← Retrieve from Stack
```

## Testing

```bash
npm test -- history-diff
```

Test coverage includes:

-   Flatten function with various options
-   Diff algorithm with all change types
-   LIS-based movement detection
-   Cross-parent and reorder move detection
-   Passive shift filtering (deletion scenarios)
-   Edge cases (empty trees, identical trees)

## License

BSD Licensed. See LICENSE file for details.
