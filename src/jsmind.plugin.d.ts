/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import type jsMind from './jsmind.js';

/**
 * Plugin descriptor
 */
export interface PluginDescriptor {
    /** Plugin class */
    PluginClass: typeof Plugin;
    /** Plugin instance name */
    instanceName: string;
    /** Whether to preload */
    preload: boolean;
    /** Plugin options */
    pluginOpt: Record<string, any>;
    /** Plugin instance (after initialization) */
    instance: Plugin | null;
}

/**
 * Plugin Manager
 * Manages plugin lifecycle with synchronous initialization,
 * preload support, and lifecycle hooks.
 */
export class PluginManager {
    /** jsMind instance */
    jm: jsMind;
    /** Plugin instances map */
    plugins: Map<string, Plugin>;

    /**
     * Create plugin manager
     * @param jm - jsMind instance
     */
    constructor(jm: jsMind);

    /**
     * Initialize preload plugins (before core modules)
     */
    initPreloadPlugins(): void;

    /**
     * Initialize normal plugins (after core modules)
     */
    initNormalPlugins(): void;

    /**
     * Remove a plugin
     * @param PluginClass - Plugin class
     */
    removePlugin(PluginClass: typeof Plugin): void;

    /**
     * Destroy all plugins
     */
    destroyAllPlugins(): void;

    /**
     * Get plugin instance by name
     * @param instanceName - Plugin instance name
     * @returns Plugin instance or undefined
     */
    getPlugin(instanceName: string): Plugin | undefined;
}

/**
 * Plugin Base Class
 * Provides standard plugin interface.
 */
export class Plugin {
    /**
     * Plugin instance name (must be defined by subclass)
     */
    static instanceName: string;

    /**
     * Whether to initialize before core modules
     */
    static preload: boolean;

    /** jsMind instance */
    jm: jsMind;
    /** Plugin options */
    options: Record<string, any>;

    /**
     * Create plugin instance
     * @param params - Plugin parameters
     * @param params.jm - jsMind instance
     * @param params.pluginOpt - Plugin options
     */
    constructor(params: { jm: jsMind; pluginOpt?: Record<string, any> });

    /**
     * Called before plugin is removed
     * Override this method to clean up resources
     */
    beforePluginRemove(): void;

    /**
     * Called before jsMind instance is destroyed
     * Override this method to clean up resources
     */
    beforePluginDestroy(): void;
}

/**
 * Extend jsMind with plugin system
 */
declare module './jsmind.js' {
    export default interface jsMind {
        /** Plugin manager */
        pluginManager: PluginManager;

        /**
         * Remove a plugin
         * @param PluginClass - Plugin class
         */
        removePlugin(PluginClass: typeof Plugin): void;

        /**
         * Get a plugin instance
         * @param instanceName - Plugin instance name
         * @returns Plugin instance or undefined
         */
        getPlugin(instanceName: string): Plugin | undefined;

        /**
         * Destroy the jsMind instance and clean up resources
         */
        destroy(): void;
    }

    namespace jsMind {
        /** Plugin base class */
        export const plugin_base: typeof Plugin;

        /** Plugin list */
        export const pluginList: PluginDescriptor[];

        /**
         * Register a plugin
         * @param PluginClass - Plugin class
         * @param options - Plugin options
         * @returns jsMind class for chaining
         */
        export function usePlugin(
            PluginClass: typeof Plugin,
            options?: Record<string, any>
        ): typeof jsMind;

        /**
         * Check whether a plugin is registered.
         * @param PluginClass - Plugin class
         * @returns True if registered
         */
        export function hasPlugin(PluginClass: typeof Plugin): boolean;
    }
}
