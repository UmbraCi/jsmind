# History Plugin

The History plugin provides complete undo/redo functionality with history management and snapshot comparison for jsMind.

## Features

-   ✅ **Undo/Redo**: Full undo/redo support with configurable history stack
-   ✅ **Snapshot Management**: Export and import mind map snapshots
-   ✅ **Diff Algorithm**: Advanced snapshot comparison with detailed change tracking
-   ✅ **Movement Detection**: Detect node movements (drag & drop scenarios)
-   ✅ **Configurable Fields**: Customize which fields to compare
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
console.log('Created:', diff.created);
console.log('Updated:', diff.updated);
console.log('Deleted:', diff.deleted);
```

## Diff Algorithm

The `history-diff.js` module provides a powerful diff algorithm for comparing mind map snapshots.

### Key Features

1. **Default Field Comparison**: By default, only compares `['topic', 'data', 'id']` fields
2. **Structure Tracking**: Optionally includes `parentid` and `index` for movement detection
3. **Custom Fields**: Configure which fields to compare
4. **Movement Detection**: Identifies when nodes are moved to different parents
5. **Change Categorization**: Separates moved, modified, and moved+modified nodes

### API

#### `flatten(tree, options)`

Flattens a tree structure into a Map for efficient comparison.

**Parameters:**

-   `tree`: NodeTreeFormat or NodeTreeData
-   `options`:
    -   `fields`: Array of field names to extract (default: `['topic', 'data', 'id']`)
    -   `includeStructure`: Include `parentid` and `index` (default: `true`)

**Returns:** `Map<string, FlatNode>`

**Example:**

```javascript
import { flatten } from './history-diff.js';

const flatMap = flatten(snapshot, {
    fields: ['id', 'topic'],
    includeStructure: true,
});
```

#### `diff(snapshotA, snapshotB, options)`

Compares two snapshots and returns detailed differences.

**Parameters:**

-   `snapshotA`: First snapshot (before changes)
-   `snapshotB`: Second snapshot (after changes)
-   `options`:
    -   `fields`: Fields to compare (default: `['topic', 'data', 'id']`)
    -   `includeStructure`: Include structure fields (default: `true`)
    -   `maxSize`: Maximum result size (default: `5000`)
    -   `categorize`: Categorize updates into moved/modified/movedAndModified (default: `false`)

**Returns:**

```typescript
{
    created: FlatNode[],      // Newly created nodes
    updated: UpdatedNode[],   // Updated nodes with change details
    deleted: FlatNode[],      // Deleted nodes
    truncated: boolean,       // Whether results were truncated

    // When categorize=true:
    moved?: MovedNode[],              // Only moved
    modified?: ModifiedNode[],        // Only modified
    movedAndModified?: MovedAndModifiedNode[]  // Both moved and modified
}
```

**Example:**

```javascript
import { diff } from './history-diff.js';

// Basic diff
const result = diff(snapshot1, snapshot2);

// With categorization
const categorized = diff(snapshot1, snapshot2, {
    categorize: true,
});

console.log('Moved nodes:', categorized.moved);
console.log('Modified nodes:', categorized.modified);
console.log('Moved + Modified:', categorized.movedAndModified);

// Custom fields
const custom = diff(snapshot1, snapshot2, {
    fields: ['id', 'topic', 'customField'],
});
```

### Change Detection

The diff algorithm detects the following types of changes:

1. **Created**: Nodes that exist in snapshot B but not in A
2. **Deleted**: Nodes that exist in snapshot A but not in B
3. **Updated**: Nodes that exist in both but have different values

When `categorize=true`, updated nodes are further categorized:

1. **Moved**: Only `parentid` or `index` changed
2. **Modified**: Only content fields changed (topic, data, etc.)
3. **MovedAndModified**: Both structure and content changed

### Movement Detection

The algorithm can detect when nodes are moved (e.g., via drag & drop):

```javascript
const result = diff(before, after, { categorize: true });

result.moved.forEach(node => {
    console.log(`Node ${node.id} moved:`);
    console.log(`  From parent: ${node.moveInfo.fromParent}`);
    console.log(`  To parent: ${node.moveInfo.toParent}`);
    console.log(`  Parent changed: ${node.moveInfo.parentChanged}`);
    console.log(`  Order changed: ${node.moveInfo.orderChanged}`);
});
```

### Performance Considerations

-   Uses `Map` instead of `Object` for O(1) lookups
-   Supports `maxSize` option to limit result size
-   Efficient shallow comparison before deep comparison
-   Only compares specified fields (default: topic, data, id)

## Architecture

### Files

-   `jsmind.history.js`: Main plugin implementation with HistoryCore
-   `history-diff.js`: Standalone diff algorithm module
-   `README.md`: This documentation

### Key Components

1. **HistoryPlugin**: Enhanced plugin that mounts `jm.history` API
2. **HistoryCore**: Core implementation of history stack and operations
3. **Diff Module**: Standalone snapshot comparison utilities

### Data Flow

```
User Action → HistoryCore.add() → Take Snapshot → Store in Stack
                                                      ↓
User Undo/Redo ← Apply Snapshot ← Retrieve from Stack
```

### Snapshot Format

Snapshots use the `node_tree` format:

```javascript
{
    meta: { name: 'Mind Map', author: 'user' },
    format: 'node_tree',
    data: {
        id: 'root',
        topic: 'Root',
        children: [
            { id: 'node1', topic: 'Child 1' },
            { id: 'node2', topic: 'Child 2' }
        ]
    }
}
```

## Testing

The plugin includes comprehensive unit tests:

```bash
npm test -- history-diff
```

Test coverage includes:

-   Flatten function with various options
-   Diff algorithm with all change types
-   Movement detection
-   Categorization
-   Edge cases (empty trees, identical trees)

## TypeScript Support

Complete type definitions are provided via JSDoc comments:

```typescript
import type { DiffResult, DiffOptions, FlatNode } from './history-diff.js';

const result: DiffResult = diff(snapshot1, snapshot2, {
    fields: ['id', 'topic'],
    categorize: true,
});
```

## License

BSD Licensed. See LICENSE file for details.
