# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

#### Enhanced Plugin System

- **New Plugin Architecture**: Introduced enhanced plugin system with synchronous initialization, preload support, and lifecycle management
  - `EnhancedPluginManager` class for managing plugin lifecycle
  - `EnhancedPlugin` base class for creating plugins
  - Static method `jsMind.usePlugin(PluginClass, options)` for registering plugins
  - Static method `jsMind.hasEnhancedPlugin(PluginClass)` for checking plugin registration
  - Instance method `jm.removePlugin(PluginClass)` for removing plugins
  - Instance method `jm.getPlugin(instanceName)` for getting plugin instances
  - Instance method `jm.destroy()` for destroying jsMind instance and cleaning up plugins

- **Plugin Features**:
  - Synchronous initialization: Plugins initialize before rendering
  - Preload support: Control initialization order with `static preload = true/false`
  - Lifecycle hooks: `beforePluginRemove()` and `beforePluginDestroy()`
  - Dynamic plugin management: Add/remove plugins at runtime
  - Full backward compatibility with existing plugin system

- **MultilineTextV2 Plugin**: New multiline text plugin using enhanced plugin system
  - Displays multiline text correctly on initial render (no re-render needed)
  - Textarea-based editor for editing multiline text
  - Auto-resize support
  - Proper cleanup with lifecycle hooks

- **Documentation**:
  - Comprehensive plugin development guide: `docs/enhanced-plugin-system.md`
  - API reference with examples
  - Migration guide from old plugin system
  - TypeScript type definitions: `src/jsmind.enhanced-plugin.d.ts`

- **Examples**:
  - Complete demo page: `example/multiline-text-v2-demo.html`
  - Shows plugin registration, usage, and dynamic management

### Changed

- **Build Configuration**: Updated Rollup config to build enhanced plugin system and MultilineTextV2 plugin
- **Core Initialization**: Modified jsMind initialization to support enhanced plugins
  - Preload plugins initialize before core modules
  - Normal plugins initialize after core modules
  - Old plugins continue to initialize asynchronously (backward compatible)

### Technical Details

#### Initialization Order

```
1. jsMind instance created
2. Enhanced plugin manager initialized
3. Preload plugins initialized (preload: true)
4. Core modules initialized (data, layout, view, shortcut)
5. Normal plugins initialized (preload: false)
6. 'plugins_initialized' event emitted
7. Old plugins initialized (asynchronously)
```

#### Files Added

- `src/jsmind.enhanced-plugin.js` - Enhanced plugin system
- `src/jsmind.enhanced-plugin.d.ts` - TypeScript type definitions
- `src/plugins/jsmind.multiline-text-v2.js` - MultilineTextV2 plugin
- `src/plugins/jsmind.multiline-text-v2.d.ts` - TypeScript type definitions
- `example/multiline-text-v2-demo.html` - Demo page
- `docs/enhanced-plugin-system.md` - Documentation

#### Files Modified

- `src/jsmind.js` - Added enhanced plugin system support
- `.config/rollup.config.js` - Added build configuration for new modules
- `README.md` - Added enhanced plugin system introduction

### Upgrade Guide

#### For Plugin Users

If you're using the old plugin system, no changes are required. The old plugin system continues to work as before.

To use the new enhanced plugin system:

```javascript
// Old way (still works)
const jm = new jsMind({
    container: 'jsmind_container',
    plugin: {
        multiline_text: { /* options */ }
    }
});

// New way
import MultilineTextV2 from './plugins/jsmind.multiline-text-v2.js';

jsMind.usePlugin(MultilineTextV2, { /* options */ });

const jm = new jsMind({
    container: 'jsmind_container'
});
```

#### For Plugin Developers

To migrate your plugin to the enhanced system:

1. Extend `EnhancedPlugin` base class
2. Define `static instanceName`
3. Implement constructor with `{ jm, pluginOpt }` parameters
4. Implement lifecycle hooks: `beforePluginRemove()`, `beforePluginDestroy()`
5. Register with `jsMind.usePlugin(YourPlugin, options)`

See `docs/enhanced-plugin-system.md` for detailed migration guide.

### Breaking Changes

None. The enhanced plugin system is fully backward compatible with the existing plugin system.

---

## Previous Versions

For previous version history, please refer to the git commit history.

