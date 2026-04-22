import { expect, test, jest } from '@jest/globals';
import jsMind from '../../src/jsmind.js';
import { Plugin, PluginManager } from '../../src/jsmind.plugin.js';

class TestPlugin extends Plugin {
    static instanceName = 'testPlugin';
    static preload = false;

    constructor({ jm, pluginOpt }) {
        super({ jm, pluginOpt });
        this.jmRef = jm;
        this.options = pluginOpt;
    }
}

test('register plugin via usePlugin', () => {
    const initial = jsMind.pluginList.length;
    jsMind.usePlugin(TestPlugin, { flag: true });
    expect(jsMind.pluginList.length).toBe(initial + 1);
    expect(jsMind.hasPlugin(TestPlugin)).toBe(true);
});

test('avoid duplicate plugin registration', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const before = jsMind.pluginList.length;
    jsMind.usePlugin(TestPlugin, { flag: true });
    expect(jsMind.pluginList.length).toBe(before);
    warn.mockRestore();
});

test('plugin manager initializes and removes plugin instance', () => {
    const localList = [
        {
            PluginClass: TestPlugin,
            instanceName: TestPlugin.instanceName,
            preload: false,
            pluginOpt: { flag: true },
            instance: null,
        },
    ];
    const jm = {
        constructor: { pluginList: localList },
    };
    const manager = new PluginManager(jm);
    manager.initNormalPlugins();
    expect(manager.getPlugin(TestPlugin.instanceName)).toBeDefined();
    manager.removePlugin(TestPlugin);
    expect(manager.getPlugin(TestPlugin.instanceName)).toBeUndefined();
});
