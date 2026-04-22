# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

#### Plugin System

-   **New Plugin Architecture**: Introduced plugin system with synchronous initialization, preload support, and lifecycle management

    -   `PluginManager` class for managing plugin lifecycle
    -   `Plugin` base class for creating plugins
    -   Static method `jsMind.usePlugin(PluginClass, options)` for registering plugins
    -   Static method `jsMind.hasPlugin(PluginClass)` for checking plugin registration
    -   Instance method `jm.removePlugin(PluginClass)` for removing plugins
    -   Instance method `jm.getPlugin(instanceName)` for getting plugin instances
    -   Instance method `jm.destroy()` for destroying jsMind instance and cleaning up plugins

-   **Plugin Features**:

    -   Synchronous initialization: Plugins initialize before rendering
    -   Preload support: Control initialization order with `static preload = true/false`
    -   Lifecycle hooks: `beforePluginRemove()` and `beforePluginDestroy()`
    -   Dynamic plugin management: Add/remove plugins at runtime
    -   Full backward compatibility with existing plugin system

-   **MultilineText Plugin**: Multiline plugin now uses unified plugin system with preload and lifecycle support

    -   Displays multiline text correctly on initial render (no re-render needed)
    -   Textarea-based editor for editing multiline text
    -   Auto-resize support
    -   Proper cleanup with lifecycle hooks

-   **Documentation**:

    -   Comprehensive plugin development guide: `docs/plugin-system.md`
    -   API reference with examples
    -   Migration guide from old plugin system
    -   TypeScript type definitions: `src/jsmind.plugin.d.ts`

-   **Examples**:
    -   Complete demo page: `example/demo.html`
    -   Shows plugin registration, usage, and dynamic management

### Changed

-   **Build Configuration**: Updated Rollup config to build plugin system and MultilineText plugin
-   **Core Initialization**: Modified jsMind initialization to support plugins
    -   Preload plugins initialize before core modules
    -   Normal plugins initialize after core modules
    -   Old plugins continue to initialize asynchronously (backward compatible)

### Technical Details

#### Initialization Order

```
1. jsMind instance created
2. Plugin manager initialized
3. Preload plugins initialized (preload: true)
4. Core modules initialized (data, layout, view, shortcut)
5. Normal plugins initialized (preload: false)
6. 'plugins_initialized' event emitted
7. Old plugins initialized (asynchronously)
```

#### Files Added

-   `src/jsmind.plugin.js` - Plugin system
-   `src/jsmind.plugin.d.ts` - TypeScript type definitions
-   `src/plugins/jsmind.multiline-text.js` - MultilineText plugin
-   `example/demo.html` - Demo page
-   `docs/plugin-system.md` - Documentation

#### Files Modified

-   `src/jsmind.js` - Added plugin system support
-   `.config/rollup.config.js` - Added build configuration for new modules
-   `README.md` - Added plugin system introduction

### Upgrade Guide

#### For Plugin Users

If you're using the old plugin system, no changes are required. The old plugin system continues to work as before.

To use the new plugin system:

```javascript
// Old way (still works)
const jm = new jsMind({
    container: 'jsmind_container',
    plugin: {
        multiline_text: {
            /* options */
        },
    },
});

// New way
import { MultilineTextPlugin } from './plugins/jsmind.multiline-text.js';

jsMind.usePlugin(MultilineTextPlugin, {
    /* options */
});

const jm = new jsMind({
    container: 'jsmind_container',
});
```

#### For Plugin Developers

To migrate your plugin to the enhanced system:

1. Extend `Plugin` base class
2. Define `static instanceName`
3. Implement constructor with `{ jm, pluginOpt }` parameters
4. Implement lifecycle hooks: `beforePluginRemove()`, `beforePluginDestroy()`
5. Register with `jsMind.usePlugin(YourPlugin, options)`

See `docs/plugin-system.md` for detailed migration guide.

### Breaking Changes

None. The plugin system is fully backward compatible with the existing plugin system.

---

## Previous Versions

For previous version history, please refer to the git commit history.
