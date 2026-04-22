/**
 * @typedef {Object} PluginManifestItem
 * @property {string} subpath
 * @property {string} entry
 * @property {string} umdName
 * @property {string[]} [external]
 * @property {Record<string, string>} [globals]
 * @property {string} [types]
 * @property {Array<'resolve'|'commonjs'|'terser'|'cleanup'>} [extraRollupPlugins]
 * @property {{ subpath: string, import: string, require: string }} [runtimeExport]
 */

/** @type {PluginManifestItem[]} */
export const pluginManifest = [
    {
        subpath: 'draggable-node',
        entry: 'src/plugins/jsmind.draggable-node.js',
        umdName: 'jsMindDraggableNode',
        external: ['@umbraci/jsmind'],
        globals: { '@umbraci/jsmind': 'jsMind' },
        types: './types/generated/plugins/jsmind.draggable-node.d.ts',
    },
    {
        subpath: 'history',
        entry: 'src/plugins/history/jsmind.history.js',
        umdName: 'jsMindHistory',
        external: ['@umbraci/jsmind'],
        globals: { '@umbraci/jsmind': 'jsMind' },
        types: './types/generated/plugins/history/jsmind.history.d.ts',
        extraRollupPlugins: ['resolve'],
    },
    {
        subpath: 'multi-select',
        entry: 'src/plugins/jsmind.multi-select.js',
        umdName: 'jsMindMultiSelect',
        external: ['@umbraci/jsmind'],
        globals: { '@umbraci/jsmind': 'jsMind' },
        types: './types/generated/plugins/jsmind.multi-select.d.ts',
    },
    {
        subpath: 'multiline-text',
        entry: 'src/plugins/jsmind.multiline-text.js',
        umdName: 'jsMindMultilineText',
        external: ['@umbraci/jsmind'],
        globals: { '@umbraci/jsmind': 'jsMind' },
        types: './types/generated/plugins/jsmind.multiline-text.d.ts',
    },
    {
        subpath: 'screenshot',
        entry: 'src/plugins/jsmind.screenshot.js',
        umdName: 'jsMindScreenshot',
        external: ['@umbraci/jsmind', 'dom-to-image'],
        globals: { '@umbraci/jsmind': 'jsMind', 'dom-to-image': 'domtoimage' },
        types: './types/generated/plugins/jsmind.screenshot.d.ts',
    },
];

/**
 * Non-core static exports managed by sync script.
 * Keep core export "." in package.json manually maintained.
 */
export const nonCoreStaticExports = {
    './*': {
        import: './es/jsmind.*.js',
        require: './lib/jsmind.*.js',
    },
    './style/jsmind.css': './style/jsmind.css',
};
