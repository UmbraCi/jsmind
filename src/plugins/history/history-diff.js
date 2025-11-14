import { deepEqual } from 'fast-equals';

/**
 * HistoryDiff utilities
 * Provide flatten() and diff() for NodeTreeFormat snapshots.
 */

/**
 * @typedef {{ meta?: any, format?: 'node_tree', data: NodeTreeData }} NodeTreeFormat
 * @typedef {{ id?: string, topic?: string, expanded?: boolean, direction?: 'left'|'right', data?: Record<string, any>, children?: NodeTreeData[], [key: string]: any }} NodeTreeData
 */

/**
 * @typedef {Object} FlatNode
 * @property {string} id - Node ID
 * @property {string} [topic] - Node topic/title
 * @property {Record<string, any>} [data] - Node data
 * @property {string|null} [parentid] - Parent node ID (structure field)
 * @property {number} [index] - Node order in parent's children (structure field)
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
 * @property {string[]} [fields] - Array of field names to include. Defaults to ['topic', 'data', 'id'].
 *                                  When using custom fieldNames (e.g., { id: 'key', topic: 'name' }), this should be
 *                                  ['name', 'data', 'key'] to match the actual field names in the data.
 * @property {string} [idKey] - The field name to use as the node ID. Defaults to 'id'.
 *                               When using custom fieldNames (e.g., { id: 'key' }), this should be 'key'.
 * @property {string} [childrenKey] - The field name to use for children array. Defaults to 'children'.
 *                                     When using custom fieldNames (e.g., { children: 'items' }), this should be 'items'.
 * @property {boolean} [includeStructure] - Whether to include parentid and index. Defaults to true
 */

/**
 * @typedef {Object} DiffOptions
 * @property {string[]} [fields] - Array of field names to compare. Defaults to ['topic', 'data', 'id'].
 *                                  When using custom fieldNames (e.g., { id: 'key', topic: 'name' }), this should be
 *                                  ['name', 'data', 'key'] to match the actual field names in the data.
 *                                  Note: When using jm.history.diff(), this is automatically handled based
 *                                  on the configured fieldNames, so you don't need to specify it manually.
 * @property {string} [idKey] - The field name to use as the node ID. Defaults to 'id'.
 *                               When using custom fieldNames (e.g., { id: 'key' }), this should be 'key'.
 *                               Note: When using jm.history.diff(), this is automatically handled.
 * @property {string} [childrenKey] - The field name to use for children array. Defaults to 'children'.
 *                                     When using custom fieldNames (e.g., { children: 'items' }), this should be 'items'.
 *                                     Note: When using jm.history.diff(), this is automatically handled.
 * @property {boolean} [includeStructure] - Whether to include parentid and index in comparison. Defaults to true
 * @property {number} [maxSize] - Maximum number of diff results. Defaults to 5000
 * @property {boolean} [categorize] - Whether to categorize updates into moved/modified/movedAndModified. Defaults to false
 * @property {boolean} [ignoreDeletionShift] - Whether to ignore index changes caused by preceding node deletions. When true, nodes that only change index due to deletion of previous siblings won't be marked as moved. Defaults to false
 */

function isFormat(obj) {
    return obj && typeof obj === 'object' && 'data' in obj;
}
function getRootData(tree) {
    return isFormat(tree) ? tree.data : tree;
}

/**
 * Flatten a tree into a Map of nodes keyed by id.
 *
 * Note: When using custom fieldNames, make sure to pass the correct field names in opts.fields.
 * For example, if you configured fieldNames: { topic: 'name' }, you should pass fields: ['name', 'data', 'id'].
 *
 * @param {NodeTreeFormat|NodeTreeData} tree - The tree to flatten
 * @param {FlattenOptions} [opts] - Flatten options
 * @returns {Map<string, FlatNode>} Map of node id -> flattened node object
 *
 * @example
 * // With default fieldNames
 * const tree = { data: { id: 'root', topic: 'Root', children: [...] } };
 * const flatMap = flatten(tree);
 * const rootNode = flatMap.get('root'); // { id: 'root', topic: 'Root', data: {...}, parentid: null, index: 0 }
 *
 * @example
 * // With custom fieldNames: { topic: 'name' }
 * const tree = { data: { id: 'root', name: 'Root', children: [...] } };
 * const flatMap = flatten(tree, { fields: ['name', 'data', 'id'] });
 * const rootNode = flatMap.get('root'); // { id: 'root', name: 'Root', data: {...}, parentid: null, index: 0 }
 */
export function flatten(tree, opts) {
    const root = getRootData(tree);
    // Default fields: ['topic', 'data', 'id'] when not specified
    const fields = opts && Array.isArray(opts.fields) ? opts.fields : ['topic', 'data', 'id'];
    const idKey = opts && opts.idKey ? opts.idKey : 'id';
    const childrenKey = opts && opts.childrenKey ? opts.childrenKey : 'children';
    const includeStructure = !opts || opts.includeStructure !== false;
    /** @type {Map<string, any>} */
    const map = new Map();

    function pick(node) {
        const out = {};
        // Always include the id field (using custom key name if provided)
        if (idKey in node) {
            out[idKey] = node[idKey];
        }

        // Define standard fields that should not be collected into 'data'
        const standardFields = new Set([
            idKey,
            childrenKey,
            'direction',
            'expanded',
            'parentid',
            'index',
            'isroot',
        ]);

        // Check if 'data' field is requested
        const includeData = fields.includes('data');

        // Include other specified fields
        for (const k of fields) {
            if (k === 'data') {
                // Special handling for 'data' field:
                // Collect all non-standard fields into a data object
                const dataObj = {};
                let hasData = false;
                for (const nodeKey in node) {
                    if (!standardFields.has(nodeKey) && !fields.includes(nodeKey)) {
                        dataObj[nodeKey] = node[nodeKey];
                        hasData = true;
                    }
                }
                if (hasData) {
                    out.data = dataObj;
                }
            } else if (k in node && k !== idKey) {
                // Avoid duplicating id field
                out[k] = node[k];
            }
        }
        return out;
    }

    function walk(n, parentId, index) {
        const item = pick(n);
        const nodeId = n[idKey]; // Use custom idKey to get node ID
        if (includeStructure) {
            item.parentid = parentId || null;
            item.index = typeof index === 'number' ? index : 0;
        }
        map.set(nodeId, item);
        const children = n[childrenKey]; // Use custom childrenKey to get children array
        if (children && Array.isArray(children)) children.forEach((c, i) => walk(c, nodeId, i));
    }

    if (root && root[idKey]) walk(root, null, 0);
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

    // Check if parentid or index are in the changes array
    for (const change of changes) {
        if (change.key === 'parentid') {
            parentChanged = true;
        }
        if (change.key === 'index') {
            orderChanged = true;
        }
    }

    const moved = parentChanged || orderChanged;
    return { moved, parentChanged, orderChanged };
}

/**
 * Check if index change is caused by deletion of preceding siblings
 * @param {Map<string, any>} beforeMap - Flattened map before changes
 * @param {Map<string, any>} afterMap - Flattened map after changes
 * @param {string} nodeId - Node ID to check
 * @param {string} parentId - Parent node ID
 * @param {number} fromIndex - Original index
 * @param {number} toIndex - New index
 * @returns {boolean} - True if index change is caused by preceding sibling deletions
 */
function isIndexChangeCausedByDeletion(beforeMap, afterMap, nodeId, parentId, fromIndex, toIndex) {
    if (fromIndex <= toIndex) return false; // Only consider index decrease

    // Count children before and after for the same parent
    const beforeChildren = [];
    const afterChildren = [];

    for (const [id, node] of beforeMap) {
        if (node.parentid === parentId) {
            beforeChildren.push({ id, index: node.index });
        }
    }

    for (const [id, node] of afterMap) {
        if (node.parentid === parentId) {
            afterChildren.push({ id, index: node.index });
        }
    }

    // Sort by index
    beforeChildren.sort((a, b) => a.index - b.index);
    afterChildren.sort((a, b) => a.index - b.index);

    // Count how many preceding siblings were deleted
    let deletedPrecedingCount = 0;
    for (const beforeChild of beforeChildren) {
        if (beforeChild.index < fromIndex) {
            // Check if this child still exists in after map
            const stillExists = afterChildren.some(afterChild => afterChild.id === beforeChild.id);
            if (!stillExists) {
                deletedPrecedingCount++;
            }
        }
    }

    // If the index shift equals the number of deleted preceding siblings,
    // then the change is caused by deletion
    return fromIndex - toIndex === deletedPrecedingCount;
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
                fromParent: before.parentid,
                toParent: after.parentid,
                fromOrder: before.index,
                toOrder: after.index,
            };

            // Filter out structure-only changes (parentid, index)
            const contentChanges = changes.filter(c => c.key !== 'parentid' && c.key !== 'index');

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
 * Compute diff between two snapshots.
 *
 * Note: When using custom fieldNames, make sure to pass the correct field names in opts.fields.
 * For example, if you configured fieldNames: { topic: 'name' }, you should pass fields: ['name', 'data', 'id'].
 * When using jm.history.diff(), this is automatically handled for you.
 *
 * @param {NodeTreeFormat|NodeTreeData} a - First snapshot (before)
 * @param {NodeTreeFormat|NodeTreeData} b - Second snapshot (after)
 * @param {DiffOptions} [opts] - Diff options
 * @returns {DiffResult} Diff result with created, updated, deleted nodes, and optionally categorized updates
 *
 * @example
 * // Basic usage with default fieldNames
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
 * // With custom fieldNames: { topic: 'name' }
 * const result = diff(snapshot1, snapshot2, { fields: ['name', 'data', 'id'] });
 * // Now the diff will correctly detect changes in the 'name' field
 *
 * @example
 * // Using jm.history.diff() (recommended - automatically handles fieldNames)
 * const before = jm.get_data('node_tree');
 * // ... make changes ...
 * const after = jm.get_data('node_tree');
 * const result = jm.history.diff(before, after);
 * // fieldNames are automatically applied, no need to specify fields manually
 *
 * @example
 * // Ignore index changes caused by preceding node deletions
 * const result = jm.history.diff(before, after, { ignoreDeletionShift: true });
 * // Now nodes that only change index due to deletion of previous siblings won't be marked as moved
 */
export function diff(a, b, opts = {}) {
    const {
        fields,
        idKey,
        childrenKey,
        includeStructure = true,
        maxSize = 5000,
        categorize = false,
        ignoreDeletionShift = false,
    } = opts;

    const A = flatten(a, { fields, idKey, childrenKey, includeStructure });
    const B = flatten(b, { fields, idKey, childrenKey, includeStructure });
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

            // Apply ignoreDeletionShift filter
            if (ignoreDeletionShift && !changes.some(c => c.key === 'parentid')) {
                const hasIndexChange = changes.some(c => c.key === 'index');

                if (hasIndexChange) {
                    // Check if this index change is caused by deletion of preceding siblings
                    const indexChange = changes.find(c => c.key === 'index');
                    const causedByDeletion = isIndexChangeCausedByDeletion(
                        A,
                        B,
                        id,
                        nodeA.parentid,
                        indexChange.before,
                        indexChange.after
                    );

                    if (causedByDeletion) {
                        // Remove index change from the changes array
                        const filteredChanges = changes.filter(c => c.key !== 'index');

                        // If there are no other changes, skip this update entirely
                        if (filteredChanges.length === 0) {
                            continue;
                        }

                        // Otherwise, update with the filtered changes
                        changes.length = 0;
                        changes.push(...filteredChanges);
                    }
                }
            }

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
