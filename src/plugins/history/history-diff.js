import equal from 'fast-deep-equal';

/**
 * HistoryDiff utilities
 * Provide flatten() and diff() for NodeTreeFormat snapshots.
 */

/**
 * @typedef {{ meta?: any, format?: 'node_tree', data: NodeTreeData }} NodeTreeFormat
 * @typedef {{ id: string, topic?: string, expanded?: boolean, direction?: 'left'|'right', data?: Record<string, any>, children?: NodeTreeData[] }} NodeTreeData
 */

function isFormat(obj) {
    return obj && typeof obj === 'object' && 'data' in obj;
}
function getRootData(tree) {
    return isFormat(tree) ? tree.data : tree;
}

/**
 * Flatten a NodeTreeFormat/NodeTreeData by id
 * @param {NodeTreeFormat|NodeTreeData} tree
 * @param {{ fields?: string[], includeStructure?: boolean }=} opts
 * @returns {Record<string, any>}
 */
export function flatten(tree, opts) {
    const root = getRootData(tree);
    const fields = opts && Array.isArray(opts.fields) ? opts.fields : null;
    const includeStructure = !opts || opts.includeStructure !== false;
    /** @type {Record<string, any>} */
    const map = {};

    function pick(node) {
        if (!fields) {
            // Default: shallow copy excluding children
            const { children, ...rest } = node;
            return rest;
        }
        const out = { id: node.id };
        for (const k of fields) {
            if (k in node) out[k] = node[k];
        }
        return out;
    }

    function walk(n, parentId, index) {
        const item = pick(n);
        if (includeStructure) {
            item._parentid = parentId || null;
            item._order = typeof index === 'number' ? index : 0;
        }
        map[n.id] = item;
        if (n.children && Array.isArray(n.children)) n.children.forEach((c, i) => walk(c, n.id, i));
    }

    if (root && root.id) walk(root, null, 0);
    return map;
}

function shallowEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
        const va = a[k];
        const vb = b[k];
        if (va === vb) continue;
        const isObj = va && vb && typeof va === 'object' && typeof vb === 'object';
        if (isObj) {
            if (!equal(va, vb)) return false;
            continue;
        }
        if (va !== vb) return false;
    }
    return true;
}

/**
 * Compute diff between two snapshots
 * @param {NodeTreeFormat|NodeTreeData} a
 * @param {NodeTreeFormat|NodeTreeData} b
 * @param {{ fields?: string[], includeStructure?: boolean, maxSize?: number }=} opts
 * @returns {{ created: any[], updated: { id:string, before:any, after:any }[], deleted: any[], truncated: boolean }}
 */
export function diff(a, b, opts) {
    const fields = opts && opts.fields;
    const includeStructure = !opts || opts.includeStructure !== false;
    const maxSize = opts && typeof opts.maxSize === 'number' ? opts.maxSize : 5000;
    const A = flatten(a, { fields, includeStructure });
    const B = flatten(b, { fields, includeStructure });
    /** @type {any[]} */ const created = [];
    /** @type {{id:string,before:any,after:any}[]} */ const updated = [];
    /** @type {any[]} */ const deleted = [];

    // created / updated
    for (const id in B) {
        if (!(id in A)) {
            created.push(B[id]);
            continue;
        }
        if (!shallowEqual(A[id], B[id])) updated.push({ id, before: A[id], after: B[id] });
    }
    // deleted
    for (const id in A) {
        if (!(id in B)) deleted.push(A[id]);
    }

    let truncated = false;
    const total = created.length + updated.length + deleted.length;
    if (total > maxSize) {
        truncated = true;
        const limit = Math.max(0, maxSize);
        // proportional slice
        const c = Math.min(created.length, Math.floor(limit * (created.length / total)));
        const u = Math.min(updated.length, Math.floor(limit * (updated.length / total)));
        const d = Math.min(deleted.length, Math.max(0, limit - c - u));
        created.length = c;
        updated.length = u;
        deleted.length = d;
    }

    return { created, updated, deleted, truncated };
}
