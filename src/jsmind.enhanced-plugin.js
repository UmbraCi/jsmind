/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import { logger } from './jsmind.common.js';

/**
 * Enhanced Plugin Manager
 * Manages the lifecycle of enhanced plugins with synchronous initialization,
 * preload support, and lifecycle hooks.
 */
export class EnhancedPluginManager {
    /**
     * @param {import('./jsmind.js').default} jm - jsMind instance
     */
    constructor(jm) {
        this.jm = jm;
        /** @type {Map<string, EnhancedPlugin>} */
        this.plugins = new Map();
    }

    /**
     * Initialize preload plugins (before core modules)
     */
    initPreloadPlugins() {
        const preloadPlugins = this.jm.constructor.enhancedPluginList.filter(d => d.preload);
        logger.info('Initializing ' + preloadPlugins.length + ' preload plugins');
        preloadPlugins.forEach(descriptor => {
            this._initPlugin(descriptor);
        });
    }

    /**
     * Initialize normal plugins (after core modules)
     */
    initNormalPlugins() {
        const normalPlugins = this.jm.constructor.enhancedPluginList.filter(d => !d.preload);
        logger.info('Initializing ' + normalPlugins.length + ' normal plugins');
        normalPlugins.forEach(descriptor => {
            this._initPlugin(descriptor);
        });
    }

    /**
     * Internal method: Initialize a single plugin
     * @param {PluginDescriptor} descriptor
     * @private
     */
    _initPlugin(descriptor) {
        try {
            const { PluginClass, pluginOpt } = descriptor;

            // Check instanceName
            if (!PluginClass.instanceName) {
                throw new Error('Plugin ' + PluginClass.name + ' must define static instanceName');
            }

            // Check naming conflict
            if (this.plugins.has(PluginClass.instanceName)) {
                logger.warn(
                    'Plugin ' + PluginClass.instanceName + ' already exists, will be replaced'
                );
            }

            // Instantiate plugin
            const instance = new PluginClass({
                jm: this.jm,
                pluginOpt: pluginOpt || {},
            });

            // Save instance
            this.plugins.set(PluginClass.instanceName, instance);
            this.jm[PluginClass.instanceName] = instance;
            descriptor.instance = instance;

            logger.info('Enhanced plugin ' + PluginClass.instanceName + ' initialized');
        } catch (error) {
            logger.error('Failed to initialize plugin ' + descriptor.PluginClass.name + ':', error);
        }
    }

    /**
     * Remove a plugin
     * @param {typeof EnhancedPlugin} PluginClass
     */
    removePlugin(PluginClass) {
        const instanceName = PluginClass.instanceName;
        if (!instanceName) {
            return;
        }

        const instance = this.plugins.get(instanceName);
        if (!instance) {
            return;
        }

        try {
            // Call lifecycle hook
            if (typeof instance.beforePluginRemove === 'function') {
                instance.beforePluginRemove();
            }

            // Remove from Map
            this.plugins.delete(instanceName);

            // Remove from jsMind instance
            delete this.jm[instanceName];

            // Remove from plugin list
            const list = this.jm.constructor.enhancedPluginList;
            const index = list.findIndex(d => d.PluginClass === PluginClass);
            if (index !== -1) {
                list.splice(index, 1);
            }

            logger.info('Enhanced plugin ' + instanceName + ' removed');
        } catch (error) {
            logger.error('Failed to remove plugin ' + instanceName + ':', error);
        }
    }

    /**
     * Destroy all plugins
     */
    destroyAllPlugins() {
        this.plugins.forEach((instance, instanceName) => {
            try {
                // Call lifecycle hook
                if (typeof instance.beforePluginDestroy === 'function') {
                    instance.beforePluginDestroy();
                }
            } catch (error) {
                logger.error('Failed to destroy plugin ' + instanceName + ':', error);
            }
        });

        this.plugins.clear();
    }

    /**
     * Get plugin instance by name
     * @param {string} instanceName
     * @returns {EnhancedPlugin | undefined}
     */
    getPlugin(instanceName) {
        return this.plugins.get(instanceName);
    }
}

/**
 * Enhanced Plugin Base Class
 * Provides standard interface for enhanced plugins
 */
export class EnhancedPlugin {
    /**
     * Plugin instance name (must be defined by subclass)
     * @type {string}
     */
    static instanceName = '';

    /**
     * Whether to initialize before core modules
     * @type {boolean}
     */
    static preload = false;

    /**
     * @param {{ jm: import('./jsmind.js').default, pluginOpt: object }} params
     */
    constructor({ jm, pluginOpt }) {
        this.jm = jm;
        this.options = pluginOpt || {};
    }

    /**
     * Called before plugin is removed
     * Override this method to clean up resources
     */
    beforePluginRemove() {
        // Default implementation: do nothing
    }

    /**
     * Called before jsMind instance is destroyed
     * Override this method to clean up resources
     */
    beforePluginDestroy() {
        // Default implementation: call beforePluginRemove
        this.beforePluginRemove();
    }
}

/**
 * Plugin descriptor
 * @typedef {object} PluginDescriptor
 * @property {typeof EnhancedPlugin} PluginClass - Plugin class
 * @property {string} instanceName - Plugin instance name
 * @property {boolean} preload - Whether to preload
 * @property {object} pluginOpt - Plugin options
 * @property {EnhancedPlugin | null} instance - Plugin instance (after initialization)
 */
