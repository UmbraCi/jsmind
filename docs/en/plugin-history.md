[Table of Contents](index.md)

* [Usage](1.usage.md)
* [Options](2.options.md)
* [Operation](3.operation.md)
* [Experimental Features](experimental-features.md)
  * [Screenshot (Export as Image) *](plugin-screenshot.md)
  * [History (Undo/Redo) *](plugin-history.md)
* [Contribution](4.contribution.md)
* [Development Guide](5.development.md)

History (Undo/Redo) <sup>[experimental](experimental-features.md)</sup>
===

> It's strongly recommended that you read [Experimental Features](experimental-features.md) to fully understand the risks before using this feature.

This feature provides complete undo/redo functionality with history management and snapshot comparison.

## Basic Usage

```html
<!-- style -->
<link type="text/css" rel="stylesheet" href="https://unpkg.com/@umbraci/jsmind/style/jsmind.css" />

<!-- jsMind -->
<script type="text/javascript" src="https://unpkg.com/@umbraci/jsmind/es/jsmind.js"></script>

<!-- history plugin -->
<script type="text/javascript" src="https://unpkg.com/@umbraci/jsmind/es/jsmind.history.js"></script>

<script>
    var options = {
        container: 'jsmind_container',
        editable: true,
        theme: 'primary',
        plugins: [
            {
                name: 'history',
                options: {
                    enabled: true,
                    maxHistory: 500,
                    throttleMs: 100
                }
            }
        ]
    };
    
    var jm = new jsMind(options);
    jm.show(mind_data);
    
    // Undo
    jm.history.back();
    
    // Redo
    jm.history.forward();
    
    // Check if can undo/redo
    if (jm.history.canBack()) {
        jm.history.back();
    }
    
    if (jm.history.canForward()) {
        jm.history.forward();
    }
</script>
```

## NPM Usage

If using npm, install jsmind

```bash
npm install @umbraci/jsmind
```

Then use it in your page

```javascript
import jsMind from '@umbraci/jsmind';
import '@umbraci/jsmind/history';
import '@umbraci/jsmind/style/jsmind.css';

const options = {
    container: 'jsmind_container',
    editable: true,
    theme: 'primary',
    plugins: [
        {
            name: 'history',
            options: {
                enabled: true,
                maxHistory: 500,
                throttleMs: 100
            }
        }
    ]
};

const jm = new jsMind(options);
jm.show(mind_data);

// Use history features
jm.history.back();
jm.history.forward();
```

## Configuration Options

### enabled
- Type: `boolean`
- Default: `true`
- Description: Enable/disable history tracking

### maxHistory
- Type: `number`
- Default: `500`
- Description: Maximum number of history entries. Oldest entries are removed when exceeded

### throttleMs
- Type: `number`
- Default: `100`
- Description: Throttle time in milliseconds. Multiple operations within this time are merged into one history entry

### storageMode
- Type: `'object' | 'string'`
- Default: `'object'`
- Description: Snapshot storage mode
  - `'object'`: Store as objects (faster, more memory)
  - `'string'`: Store as JSON strings (less memory, slightly slower)

### autoSwitchThreshold
- Type: `number`
- Default: `0`
- Description: Auto-switch storage mode threshold (node count)
  - `0`: Disable auto-switch
  - `> 0`: Auto-switch to `'string'` mode when node count exceeds this value

### keymap
- Type: `{ enabled: boolean, redoUsesY: boolean }`
- Default: `{ enabled: false, redoUsesY: false }`
- Description: Keyboard shortcut configuration
  - `enabled`: Enable keyboard shortcuts
  - `redoUsesY`: Use Ctrl+Y for redo (default uses Ctrl+Shift+Z)

### diff
- Type: `{ flat: boolean, fields?: string[], maxSize: number }`
- Default: `{ flat: true, fields: undefined, maxSize: 5000 }`
- Description: Snapshot comparison configuration
  - `flat`: Use flattened comparison
  - `fields`: Fields to compare (default: `['topic', 'data', 'id']`)
  - `maxSize`: Maximum comparison result size

## API Methods

### Control & Stack Management

#### add(reason?, meta?)
Manually add a history snapshot
- `reason`: Optional, reason for adding
- `meta`: Optional, metadata

```javascript
jm.history.add('manual', { user: 'admin' });
```

#### pause()
Pause history tracking

```javascript
jm.history.pause();
// Perform operations that shouldn't be tracked
jm.history.resume();
```

#### resume(flush?)
Resume history tracking
- `flush`: Optional, immediately flush pending records

```javascript
jm.history.resume(true);
```

#### clear()
Clear all history records

```javascript
jm.history.clear();
```

### Navigation

#### canBack()
Check if undo is available

```javascript
if (jm.history.canBack()) {
    jm.history.back();
}
```

#### canForward()
Check if redo is available

```javascript
if (jm.history.canForward()) {
    jm.history.forward();
}
```

#### back(steps?)
Undo operation
- `steps`: Optional, number of steps to undo (default: 1)

```javascript
jm.history.back();     // Undo 1 step
jm.history.back(3);    // Undo 3 steps
```

#### forward(steps?)
Redo operation
- `steps`: Optional, number of steps to redo (default: 1)

```javascript
jm.history.forward();  // Redo 1 step
jm.history.forward(3); // Redo 3 steps
```

### Information & Configuration

#### length()
Get total number of history records

```javascript
const total = jm.history.length();
console.log(`Total ${total} history records`);
```

#### index()
Get current history index

```javascript
const current = jm.history.index();
console.log(`Currently at record ${current + 1}`);
```

#### setMax(count)
Set maximum history count

```javascript
jm.history.setMax(1000);
```

#### setThrottle(ms)
Set throttle time

```javascript
jm.history.setThrottle(200);
```

### Snapshot Management

#### exportSnapshot()
Export current snapshot

```javascript
const snapshot = jm.history.exportSnapshot();
console.log(snapshot);
```

#### importSnapshot(data, opts?)
Import snapshot
- `data`: Snapshot data
- `opts`: Optional, import options

```javascript
jm.history.importSnapshot(snapshot);
```

#### getStack()
Get history stack information

```javascript
const stack = jm.history.getStack();
console.log('History records:', stack.items);
console.log('Current index:', stack.index);
```

### Snapshot Comparison

#### diff(snapshotA, snapshotB, options?)
Compare two snapshots and return differences

**Parameters:**
- `snapshotA`: First snapshot (before changes)
- `snapshotB`: Second snapshot (after changes)
- `options`: Optional configuration
  - `fields`: Array of fields to compare (default: `['topic', 'data', 'id']`)
  - `includeStructure`: Include structure information (default: `true`)
  - `maxSize`: Maximum result size (default: `5000`)

**Returns:**
```typescript
{
    created: Array,              // Newly created nodes
    deleted: Array,              // Deleted nodes
    truncated: boolean,          // Whether results were truncated
    moved: Array,                // Nodes that were only moved
    modified: Array,             // Nodes that were only modified
    movedAndModified: Array      // Nodes that were both moved and modified
}
```

**Examples:**

```javascript
// Basic usage
const snapshot1 = jm.history.exportSnapshot();
// ... make some changes ...
const snapshot2 = jm.history.exportSnapshot();

const diff = jm.history.diff(snapshot1, snapshot2);
console.log('Created nodes:', diff.created);
console.log('Moved nodes:', diff.moved);
console.log('Modified nodes:', diff.modified);
console.log('Deleted nodes:', diff.deleted);

// Custom comparison fields
const diffCustom = jm.history.diff(snapshot1, snapshot2, { 
    fields: ['id', 'topic']  // Only compare id and topic
});
```

Copyright
===

BSD Licensed.

