# Plugin System

## Overview

The Plugin System is a new plugin architecture for jsMind that provides:

- **Synchronous Initialization**: Plugins initialize before rendering, allowing them to affect the initial render
- **Preload Support**: Control plugin initialization order (before or after core modules)
- **Lifecycle Management**: Proper cleanup with `beforePluginRemove()` and `beforePluginDestroy()` hooks
- **Dynamic Plugin Management**: Add or remove plugins at runtime
- **Backward Compatibility**: Works alongside the existing plugin system

## Why Plugin System?

The original plugin system initializes plugins asynchronously (using `setTimeout`), which means:
- Plugins cannot affect the initial render
- Plugins that modify rendering behavior require a full re-render
- No lifecycle management for cleanup

The Plugin System solves these issues while maintaining full backward compatibility.

## Quick Start

### 1. Create a Plugin

```javascript
import { Plugin } from './jsmind.plugin.js';

class MyPlugin extends Plugin {
    // Required: Define plugin instance name
    static instanceName = 'myPlugin';
    
    // Optional: Preload before core modules (default: false)
    static preload = false;

    constructor({ jm, pluginOpt }) {
        super({ jm, pluginOpt });
        
        // Your initialization code here
        console.log('MyPlugin initialized with options:', this.options);
    }

    // Optional: Cleanup when plugin is removed
    beforePluginRemove() {
        console.log('MyPlugin is being removed');
        // Clean up resources here
    }

    // Optional: Cleanup when jsMind instance is destroyed
    beforePluginDestroy() {
        console.log('MyPlugin is being destroyed');
        // Clean up resources here
    }
}

export default MyPlugin;
```

### 2. Register the Plugin

```javascript
import jsMind from './jsmind.js';
import MyPlugin from './my-plugin.js';

// Register plugin BEFORE creating jsMind instance
jsMind.usePlugin(MyPlugin, {
    // Plugin options
    option1: 'value1',
    option2: 'value2'
});

// Create jsMind instance
const jm = new jsMind({
    container: 'jsmind_container',
    editable: true,
    theme: 'primary'
});
```

### 3. Use the Plugin

```javascript
// Access plugin instance
const myPlugin = jm.myPlugin;
// or
const myPlugin = jm.getPlugin('myPlugin');

// Remove plugin dynamically
jm.removePlugin(MyPlugin);
```

## API Reference

### Static Methods

#### `jsMind.usePlugin(PluginClass, options)`

Register a plugin.

**Parameters:**
- `PluginClass` (typeof Plugin): Plugin class
- `options` (object, optional): Plugin options

**Returns:** `jsMind` class for chaining

**Example:**
```javascript
jsMind.usePlugin(MyPlugin, { option1: 'value1' });
```

#### `jsMind.hasPlugin(PluginClass)`

Check if a plugin is registered.

**Parameters:**
- `PluginClass` (typeof Plugin): Plugin class

**Returns:** `boolean`

**Example:**
```javascript
if (jsMind.hasPlugin(MyPlugin)) {
    console.log('MyPlugin is registered');
}
```

### Instance Methods

#### `jm.removePlugin(PluginClass)`

Remove a plugin from the instance.

**Parameters:**
- `PluginClass` (typeof Plugin): Plugin class

**Example:**
```javascript
jm.removePlugin(MyPlugin);
```

#### `jm.getPlugin(instanceName)`

Get a plugin instance by name.

**Parameters:**
- `instanceName` (string): Plugin instance name

**Returns:** `Plugin | undefined`

**Example:**
```javascript
const myPlugin = jm.getPlugin('myPlugin');
```

#### `jm.destroy()`

Destroy the jsMind instance and clean up all plugins.

**Example:**
```javascript
jm.destroy();
```

### Plugin Class

#### Static Properties

##### `static instanceName`

**Required.** The name used to mount the plugin instance on the jsMind instance.

```javascript
static instanceName = 'myPlugin';
```

##### `static preload`

**Optional.** Whether to initialize before core modules. Default: `false`.

```javascript
static preload = true;  // Initialize before core modules
static preload = false; // Initialize after core modules (default)
```

#### Constructor

```javascript
constructor({ jm, pluginOpt })
```

**Parameters:**
- `jm` (jsMind): jsMind instance
- `pluginOpt` (object): Plugin options passed to `usePlugin()`

#### Lifecycle Hooks

##### `beforePluginRemove()`

Called when the plugin is removed via `removePlugin()`.

```javascript
beforePluginRemove() {
    // Clean up resources
    // Remove event listeners
    // Restore original state
}
```

##### `beforePluginDestroy()`

Called when the jsMind instance is destroyed via `destroy()`.

```javascript
beforePluginDestroy() {
    // Clean up resources
    // By default, calls beforePluginRemove()
}
```

## Initialization Order

```
1. jsMind instance created
2. Plugin manager initialized
3. Preload plugins initialized (preload: true)
4. Core modules initialized (data, layout, view, shortcut)
5. Normal plugins initialized (preload: false)
6. 'plugins_initialized' event emitted
7. Old plugins initialized (asynchronously)
```

## Example: MultilineText Plugin

See `src/plugins/jsmind.multiline-text.js` for a complete example.

```javascript
import { Plugin } from '../jsmind.plugin.js';

export class MultilineTextPlugin extends Plugin {
    static instanceName = 'multilineText';
    static preload = true;

    constructor({ jm, pluginOpt }) {
        super({ jm, pluginOpt });
        
        // Merge default options
        this.options = Object.assign({
            text_width: 200,
            min_height: 30,
            line_height: '1.5'
        }, pluginOpt);

        // Setup custom rendering
        this.setupCustomRender();
    }

    setupCustomRender() {
        const view = this.jm.view;
        
        // Save original custom render
        this._original_custom_render = view.opts.custom_node_render;
        
        // Create multiline-aware custom render
        view.opts.custom_node_render = (jm, element, node) => {
            if (node.topic && node.topic.includes('\n')) {
                element.textContent = node.topic;
                element.style.whiteSpace = 'pre-wrap';
                element.style.wordBreak = 'break-word';
            }
            return true;
        };
        
        view.render_node = view._custom_node_render;
    }

    beforePluginRemove() {
        // Restore original render
        const view = this.jm.view;
        view.opts.custom_node_render = this._original_custom_render;
        view.render_node = view._default_node_render;
    }
}
```

## Migration from Old Plugin System

### Old Plugin System

```javascript
const jm = new jsMind({
    container: 'jsmind_container',
    plugin: {
        myPlugin: {
            // Plugin options
        }
    }
});
```

### Plugin System

```javascript
import { Plugin } from './jsmind.plugin.js';

class MyPlugin extends Plugin {
    static instanceName = 'myPlugin';
    
    constructor({ jm, pluginOpt }) {
        super({ jm, pluginOpt });
        // Plugin code here
    }
    
    beforePluginRemove() {
        // Cleanup code
    }
}

jsMind.usePlugin(MyPlugin, {
    // Plugin options
});

const jm = new jsMind({
    container: 'jsmind_container'
});
```

### Key Differences

| Feature | Old System | Enhanced System |
|---------|-----------|-----------------|
| Initialization | Asynchronous | Synchronous |
| Timing | After render | Before/after core modules |
| Lifecycle | None | beforePluginRemove, beforePluginDestroy |
| Preload | No | Yes |
| Dynamic removal | No | Yes |
| Type safety | No | Yes (TypeScript) |

## Best Practices

### 1. Always Define `instanceName`

```javascript
static instanceName = 'myPlugin'; // Required
```

### 2. Clean Up Resources

```javascript
beforePluginRemove() {
    // Remove event listeners
    this.jm.off('event_name', this.handler);
    
    // Remove DOM elements
    if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
    }
    
    // Clear references
    this.element = null;
}
```

### 3. Use Preload Wisely

Only use `preload: true` if your plugin needs to initialize before core modules:

```javascript
static preload = true; // Only if you need to run before core modules
```

### 4. Handle Errors Gracefully

```javascript
constructor({ jm, pluginOpt }) {
    super({ jm, pluginOpt });
    
    try {
        // Plugin initialization
    } catch (error) {
        console.error('Failed to initialize plugin:', error);
        // Handle error gracefully
    }
}
```

### 5. Provide Default Options

```javascript
constructor({ jm, pluginOpt }) {
    super({ jm, pluginOpt });
    
    this.options = Object.assign({
        option1: 'default1',
        option2: 'default2'
    }, pluginOpt);
}
```

## Troubleshooting

### Plugin Not Working

1. Check if plugin is registered before creating jsMind instance
2. Check if `instanceName` is defined
3. Check browser console for errors

### Plugin Not Affecting Initial Render

1. Make sure plugin is registered with `usePlugin()` before creating instance
2. Check if plugin modifies rendering in constructor or `setupCustomRender()`
3. Consider using `preload: true` if needed

### Memory Leaks

1. Implement `beforePluginRemove()` and `beforePluginDestroy()`
2. Remove all event listeners
3. Clear all DOM references
4. Remove all timers/intervals

## TypeScript Support

Type definitions are provided in `src/jsmind.plugin.d.ts`.

```typescript
import type { Plugin } from './jsmind.plugin.js';

interface MyPluginOptions {
    option1: string;
    option2: number;
}

class MyPlugin extends Plugin {
    static instanceName = 'myPlugin';
    options: MyPluginOptions;
    
    constructor({ jm, pluginOpt }: { jm: jsMind; pluginOpt?: MyPluginOptions }) {
        super({ jm, pluginOpt });
        this.options = Object.assign({
            option1: 'default',
            option2: 0
        }, pluginOpt);
    }
}
```

## Examples

See `example/demo.html` for a complete working example.
