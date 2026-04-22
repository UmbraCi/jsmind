import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pluginManifest, nonCoreStaticExports } from '../.config/plugins.manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');

function createTypesVersions(manifest) {
    const sorted = [...manifest].sort((a, b) => a.subpath.localeCompare(b.subpath));
    const mappings = {};
    for (const item of sorted) {
        if (!item.types) {
            continue;
        }
        mappings[item.subpath] = [item.types.replace(/^\.\//, '')];
    }
    return { '*': mappings };
}

function createExplicitRuntimeExports(manifest) {
    const sorted = [...manifest].sort((a, b) => a.subpath.localeCompare(b.subpath));
    const result = {};
    for (const item of sorted) {
        if (!item.runtimeExport) {
            continue;
        }
        result[`./${item.runtimeExport.subpath}`] = {
            import: item.runtimeExport.import,
            require: item.runtimeExport.require,
        };
    }
    return result;
}

async function main() {
    const raw = await fs.readFile(packageJsonPath, 'utf8');
    const pkg = JSON.parse(raw);
    const currentExports = pkg.exports || {};
    const explicitRuntimeExports = createExplicitRuntimeExports(pluginManifest);
    const typesVersions = createTypesVersions(pluginManifest);

    const nextExports = {};
    if (Object.prototype.hasOwnProperty.call(currentExports, '.')) {
        nextExports['.'] = currentExports['.'];
    }

    // All non-core exports are generated from manifest.
    Object.assign(nextExports, nonCoreStaticExports, explicitRuntimeExports);

    pkg.exports = nextExports;
    pkg.typesVersions = typesVersions;
    await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 4)}\n`, 'utf8');
}

main().catch(error => {
    console.error('[sync-plugins] failed:', error);
    process.exitCode = 1;
});
