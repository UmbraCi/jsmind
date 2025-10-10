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
    PluginClass: typeof EnhancedPlugin;
    /** Plugin instance name */
    instanceName: string;
    /** Whether to preload */
    preload: boolean;
    /** Plugin options */
    pluginOpt: Record<string, any>;
    /** Plugin instance (after initialization) */
    instance: EnhancedPlugin | null;
}

/**
 * Enhanced Plugin Manager
 * Manages the lifecycle of enhanced plugins with synchronous initialization,
 * preload support, and lifecycle hooks.
 */
export class EnhancedPluginManager {
    /** jsMind instance */
    jm: jsMind;
    /** Plugin instances map */
    plugins: Map<string, EnhancedPlugin>;

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
    removePlugin(PluginClass: typeof EnhancedPlugin): void;

    /**
     * Destroy all plugins
     */
    destroyAllPlugins(): void;

    /**
     * Get plugin instance by name
     * @param instanceName - Plugin instance name
     * @returns Plugin instance or undefined
     */
    getPlugin(instanceName: string): EnhancedPlugin | undefined;
}

/**
 * Enhanced Plugin Base Class
 * Provides standard interface for enhanced plugins
 */
export class EnhancedPlugin {
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
 * Extend jsMind with enhanced plugin system
 */
declare module './jsmind.js' {
    export default interface jsMind {
        /** Enhanced plugin manager */
        enhancedPluginManager: EnhancedPluginManager;

        /**
         * Remove an enhanced plugin
         * @param PluginClass - Plugin class
         */
        removePlugin(PluginClass: typeof EnhancedPlugin): void;

        /**
         * Get an enhanced plugin instance
         * @param instanceName - Plugin instance name
         * @returns Plugin instance or undefined
         */
        getPlugin(instanceName: string): EnhancedPlugin | undefined;

        /**
         * Destroy the jsMind instance and clean up resources
         */
        destroy(): void;
    }

    namespace jsMind {
        /** Enhanced plugin base class */
        export const enhanced_plugin: typeof EnhancedPlugin;

        /** Enhanced plugin list */
        export const enhancedPluginList: PluginDescriptor[];

        /**
         * Register an enhanced plugin
         * @param PluginClass - Plugin class
         * @param options - Plugin options
         * @returns jsMind class for chaining
         */
        export function usePlugin(
            PluginClass: typeof EnhancedPlugin,
            options?: Record<string, any>
        ): typeof jsMind;

        /**
         * Check if an enhanced plugin is registered
         * @param PluginClass - Plugin class
         * @returns True if registered
         */
        export function hasEnhancedPlugin(PluginClass: typeof EnhancedPlugin): boolean;
    }
}

