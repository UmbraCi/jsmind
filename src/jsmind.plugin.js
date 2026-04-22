/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import { logger } from './jsmind.common.js';

/**
 * Plugin Manager
 * Manages plugin lifecycle with synchronous initialization,
 * preload support, and lifecycle hooks.
 */
export class PluginManager {
    /**
     * @param {import('./jsmind.js').default} jm - jsMind instance
     */
    constructor(jm) {
        this.jm = jm;
        /** @type {Map<string, Plugin>} */
        this.plugins = new Map();
    }

    /**
     * Initialize preload plugins (before core modules)
     */
    initPreloadPlugins() {
        const preloadPlugins = this.jm.constructor.pluginList.filter(d => d.preload);
        logger.info('Initializing ' + preloadPlugins.length + ' preload plugins');
        preloadPlugins.forEach(descriptor => {
            this._initPlugin(descriptor);
        });
    }

    /**
     * Initialize normal plugins (after core modules)
     */
    initNormalPlugins() {
        const normalPlugins = this.jm.constructor.pluginList.filter(d => !d.preload);
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

            if (!PluginClass.instanceName) {
                throw new Error('Plugin ' + PluginClass.name + ' must define static instanceName');
            }
            if (this.plugins.has(PluginClass.instanceName)) {
                logger.warn(
                    'Plugin ' + PluginClass.instanceName + ' already exists, will be replaced'
                );
            }

            const instance = new PluginClass({
                jm: this.jm,
                pluginOpt: pluginOpt || {},
            });

            this.plugins.set(PluginClass.instanceName, instance);
            this.jm[PluginClass.instanceName] = instance;
            descriptor.instance = instance;

            logger.info('Plugin ' + PluginClass.instanceName + ' initialized');
        } catch (error) {
            logger.error('Failed to initialize plugin ' + descriptor.PluginClass.name + ':', error);
        }
    }

    /**
     * Remove a plugin
     * @param {typeof Plugin} PluginClass
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
            if (typeof instance.beforePluginRemove === 'function') {
                instance.beforePluginRemove();
            }

            this.plugins.delete(instanceName);
            delete this.jm[instanceName];

            const list = this.jm.constructor.pluginList;
            const index = list.findIndex(d => d.PluginClass === PluginClass);
            if (index !== -1) {
                list.splice(index, 1);
            }

            logger.info('Plugin ' + instanceName + ' removed');
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
     * @returns {Plugin | undefined}
     */
    getPlugin(instanceName) {
        return this.plugins.get(instanceName);
    }
}

/**
 * Plugin Base Class
 * Provides standard plugin interface.
 */
export class Plugin {
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
     */
    beforePluginRemove() {}

    /**
     * Called before jsMind instance is destroyed
     */
    beforePluginDestroy() {
        this.beforePluginRemove();
    }
}

/**
 * Plugin descriptor
 * @typedef {object} PluginDescriptor
 * @property {typeof Plugin} PluginClass - Plugin class
 * @property {string} instanceName - Plugin instance name
 * @property {boolean} preload - Whether to preload
 * @property {object} pluginOpt - Plugin options
 * @property {Plugin | null} instance - Plugin instance (after initialization)
 */
