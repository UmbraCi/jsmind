import { deepEqual } from 'fast-equals';

/**
 * HistoryDiff utilities
 * Provide flatten() and diff() for NodeTreeFormat snapshots.
 */

/**
 * @typedef {{ meta?: any, format?: 'node_tree', data: NodeTreeData }} NodeTreeFormat
 * @typedef {{ id: string, topic?: string, expanded?: boolean, direction?: 'left'|'right', data?: Record<string, any>, children?: NodeTreeData[] }} NodeTreeData
 */

/**
 * @typedef {Object} FlatNode
 * @property {string} id - Node ID
 * @property {string} [topic] - Node topic/title
 * @property {Record<string, any>} [data] - Node data
 * @property {string|null} [_parentid] - Parent node ID (structure field)
 * @property {number} [_order] - Node order in parent's children (structure field)
 */

/**
 * @typedef {Object} ChangeDetail
 * @property {string} key - The field name that changed
 * @property {any} before - Value before change
 * @property {any} after - Value after change
 */

/**
 * @typedef {Object} UpdatedNode
 * @property {string} id - Node ID
 * @property {FlatNode} before - Node state before change
 * @property {FlatNode} after - Node state after change
 * @property {ChangeDetail[]} changes - Array of field changes
 */

/**
 * @typedef {Object} MoveInfo
 * @property {boolean} parentChanged - Whether parent changed
 * @property {boolean} orderChanged - Whether order changed
 * @property {string|null} fromParent - Original parent ID
 * @property {string|null} toParent - New parent ID
 * @property {number} fromOrder - Original order
 * @property {number} toOrder - New order
 */

/**
 * @typedef {Object} MovedNode
 * @property {string} id - Node ID
 * @property {FlatNode} before - Node state before move
 * @property {FlatNode} after - Node state after move
 * @property {MoveInfo} moveInfo - Movement details
 */

/**
 * @typedef {Object} ModifiedNode
 * @property {string} id - Node ID
 * @property {FlatNode} before - Node state before modification
 * @property {FlatNode} after - Node state after modification
 * @property {ChangeDetail[]} changes - Array of field changes (excluding structure fields)
 */

/**
 * @typedef {Object} MovedAndModifiedNode
 * @property {string} id - Node ID
 * @property {FlatNode} before - Node state before change
 * @property {FlatNode} after - Node state after change
 * @property {ChangeDetail[]} changes - Array of field changes (excluding structure fields)
 * @property {MoveInfo} moveInfo - Movement details
 */

/**
 * @typedef {Object} DiffResult
 * @property {FlatNode[]} created - Newly created nodes
 * @property {UpdatedNode[]} updated - Updated nodes (all changes)
 * @property {FlatNode[]} deleted - Deleted nodes
 * @property {boolean} truncated - Whether results were truncated due to maxSize
 * @property {MovedNode[]} [moved] - Nodes that were only moved (when categorize=true)
 * @property {ModifiedNode[]} [modified] - Nodes that were only modified (when categorize=true)
 * @property {MovedAndModifiedNode[]} [movedAndModified] - Nodes that were both moved and modified (when categorize=true)
 */

/**
 * @typedef {Object} FlattenOptions
 * @property {string[]} [fields] - Array of field names to include. Defaults to ['topic', 'data', 'id']
 * @property {boolean} [includeStructure] - Whether to include _parentid and _order. Defaults to true
 */

/**
 * @typedef {Object} DiffOptions
 * @property {string[]} [fields] - Array of field names to compare. Defaults to ['topic', 'data', 'id']
 * @property {boolean} [includeStructure] - Whether to include _parentid and _order in comparison. Defaults to true
 * @property {number} [maxSize] - Maximum number of diff results. Defaults to 5000
 * @property {boolean} [categorize] - Whether to categorize updates into moved/modified/movedAndModified. Defaults to false
 */

function isFormat(obj) {
    return obj && typeof obj === 'object' && 'data' in obj;
}
function getRootData(tree) {
    return isFormat(tree) ? tree.data : tree;
}

/**
 * Flatten a tree into a Map of nodes keyed by id.
 * @param {NodeTreeFormat|NodeTreeData} tree - The tree to flatten
 * @param {FlattenOptions} [opts] - Flatten options
 * @returns {Map<string, FlatNode>} Map of node id -> flattened node object
 * @example
 * const tree = { data: { id: 'root', topic: 'Root', children: [...] } };
 * const flatMap = flatten(tree);
 * const rootNode = flatMap.get('root'); // { id: 'root', topic: 'Root', data: {...}, _parentid: null, _order: 0 }
 */
export function flatten(tree, opts) {
    const root = getRootData(tree);
    // Default fields: ['topic', 'data', 'id'] when not specified
    const fields = opts && Array.isArray(opts.fields) ? opts.fields : ['topic', 'data', 'id'];
    const includeStructure = !opts || opts.includeStructure !== false;
    /** @type {Map<string, any>} */
    const map = new Map();

    function pick(node) {
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
        map.set(n.id, item);
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
            if (!deepEqual(va, vb)) return false;
            continue;
        }
        if (va !== vb) return false;
    }
    return true;
}

/**
 * Compute changed top-level keys between two flattened node items.
 * For object values (e.g., data), uses deep-equal; reports the key as a whole.
 * Note: 'id' key会被忽略，因为它与 map key 相同且不应作为差异。
 * @param {Record<string, any>} a
 * @param {Record<string, any>} b
 * @returns {{ key: string, before: any, after: any }[]}
 */
function computeChanges(a, b) {
    /** @type {{ key:string, before:any, after:any }[]} */
    const changes = [];
    if (!a || !b) return changes;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.delete('id');
    for (const k of keys) {
        const va = a[k];
        const vb = b[k];
        if (va === vb) continue;
        const bothObj = va && vb && typeof va === 'object' && typeof vb === 'object';
        const different = bothObj ? !deepEqual(va, vb) : va !== vb;
        if (different) changes.push({ key: k, before: va, after: vb });
    }
    return changes;
}

/**
 * Detect if a node has been moved (parent or order changed)
 * @param {{ key: string, before: any, after: any }[]} changes - Array of changes from computeChanges()
 * @returns {{ moved: boolean, parentChanged: boolean, orderChanged: boolean }}
 */
function detectMove(changes) {
    let parentChanged = false;
    let orderChanged = false;

    // Check if _parentid or _order are in the changes array
    for (const change of changes) {
        if (change.key === '_parentid') {
            parentChanged = true;
        }
        if (change.key === '_order') {
            orderChanged = true;
        }
    }

    const moved = parentChanged || orderChanged;
    return { moved, parentChanged, orderChanged };
}

/**
 * Categorize updated nodes into moved, modified, or movedAndModified
 * @param {{ id: string, before: any, after: any, changes: { key: string, before: any, after: any }[] }[]} updates
 * @returns {{
 *   moved: { id: string, before: any, after: any, moveInfo: { parentChanged: boolean, orderChanged: boolean, fromParent: any, toParent: any, fromOrder: any, toOrder: any } }[],
 *   modified: { id: string, before: any, after: any, changes: { key: string, before: any, after: any }[] }[],
 *   movedAndModified: { id: string, before: any, after: any, changes: { key: string, before: any, after: any }[], moveInfo: { parentChanged: boolean, orderChanged: boolean, fromParent: any, toParent: any, fromOrder: any, toOrder: any } }[]
 * }}
 */
function categorizeUpdates(updates) {
    const moved = [];
    const modified = [];
    const movedAndModified = [];

    for (const update of updates) {
        const { id, before, after, changes } = update;
        const moveDetection = detectMove(changes);

        if (moveDetection.moved) {
            // Build moveInfo
            const moveInfo = {
                parentChanged: moveDetection.parentChanged,
                orderChanged: moveDetection.orderChanged,
                fromParent: before._parentid,
                toParent: after._parentid,
                fromOrder: before._order,
                toOrder: after._order,
            };

            // Filter out structure-only changes (_parentid, _order)
            const contentChanges = changes.filter(c => c.key !== '_parentid' && c.key !== '_order');

            if (contentChanges.length > 0) {
                // Both moved and modified
                movedAndModified.push({ id, before, after, changes: contentChanges, moveInfo });
            } else {
                // Only moved
                moved.push({ id, before, after, moveInfo });
            }
        } else {
            // Only modified (no movement)
            modified.push({ id, before, after, changes });
        }
    }

    return { moved, modified, movedAndModified };
}

/**
 * Compute diff between two snapshots
 * @param {NodeTreeFormat|NodeTreeData} a - First snapshot (before)
 * @param {NodeTreeFormat|NodeTreeData} b - Second snapshot (after)
 * @param {DiffOptions} [opts] - Diff options
 * @returns {DiffResult} Diff result with created, updated, deleted nodes, and optionally categorized updates
 * @example
 * // Basic usage
 * const result = diff(snapshot1, snapshot2);
 * console.log(result.created); // Newly created nodes
 * console.log(result.updated); // Updated nodes with changes
 * console.log(result.deleted); // Deleted nodes
 *
 * @example
 * // With categorization
 * const result = diff(snapshot1, snapshot2, { categorize: true });
 * console.log(result.moved); // Nodes that were only moved
 * console.log(result.modified); // Nodes that were only modified
 * console.log(result.movedAndModified); // Nodes that were both moved and modified
 *
 * @example
 * // Custom fields
 * const result = diff(snapshot1, snapshot2, { fields: ['id', 'topic'] });
 */
export function diff(a, b, opts) {
    const fields = opts && opts.fields;
    const includeStructure = !opts || opts.includeStructure !== false;
    const maxSize = opts && typeof opts.maxSize === 'number' ? opts.maxSize : 5000;
    const categorize = opts && opts.categorize === true;
    const A = flatten(a, { fields, includeStructure });
    const B = flatten(b, { fields, includeStructure });
    /** @type {any[]} */ const created = [];
    /** @type {{id:string,before:any,after:any,changes:{key:string,before:any,after:any}[]}[]} */ const updated =
        [];
    /** @type {any[]} */ const deleted = [];

    // created / updated
    for (const [id, nodeB] of B) {
        if (!A.has(id)) {
            created.push(nodeB);
            continue;
        }
        const nodeA = A.get(id);
        if (!shallowEqual(nodeA, nodeB)) {
            const changes = computeChanges(nodeA, nodeB);
            updated.push({ id, before: nodeA, after: nodeB, changes });
        }
    }
    // deleted
    for (const [id, nodeA] of A) {
        if (!B.has(id)) deleted.push(nodeA);
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

    // Categorize updates if requested
    if (categorize && includeStructure) {
        const categorized = categorizeUpdates(updated);
        return {
            created,
            updated,
            deleted,
            truncated,
            moved: categorized.moved,
            modified: categorized.modified,
            movedAndModified: categorized.movedAndModified,
        };
    }

    return { created, updated, deleted, truncated };
}
