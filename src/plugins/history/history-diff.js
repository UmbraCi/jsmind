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
 * @property {'cross-parent'|'reorder'} moveType - Type of move: 'cross-parent' for different parent, 'reorder' for same parent
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
 *                                  Note: When using jm.history.diff(), this is automatically handled.
 * @property {string} [idKey] - The field name to use as the node ID. Defaults to 'id'.
 *                               Note: When using jm.history.diff(), this is automatically handled.
 * @property {string} [childrenKey] - The field name to use for children array. Defaults to 'children'.
 *                                     Note: When using jm.history.diff(), this is automatically handled.
 * @property {boolean} [includeStructure] - Whether to include parentid and index in comparison. Defaults to true
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

// ============================================================================
// LIS (Longest Increasing Subsequence) Algorithm - Based on Vue 3 implementation
// Used to precisely detect which nodes were actively moved vs passively shifted
// ============================================================================

/**
 * Compute the Longest Increasing Subsequence of an array.
 * Returns an array of indices that form the LIS.
 * Based on Vue 3's renderer.ts implementation.
 *
 * @param {number[]} arr - Array of numbers (typically new indices)
 * @returns {number[]} - Array of indices in arr that form the LIS
 *
 * @example
 * // Before: [A, B, C, D, E] (indices 0,1,2,3,4)
 * // After:  [A, D, B, C, E] (D moved to position 1)
 * // newIndexSequence for common nodes: [0, 2, 3, 4] (A->0, B->2, C->3, E->4, D is at 1 but was after in before)
 * // LIS: [0, 2, 3, 4] means A, B, C, E don't need to move
 * // D is not in LIS, so it's the one that moved
 */
function getSequence(arr) {
    const p = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;

    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        // Skip 0 values (which represent new nodes in Vue's implementation)
        // In our case, we filter them out before calling this function
        if (arrI !== 0 || i === 0) {
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            // Binary search for the first element >= arrI
            while (u < v) {
                c = (u + v) >> 1;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                } else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }

    // Backtrack to build the LIS
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}

/**
 * Group nodes by their parent ID
 * @param {Map<string, any>} nodeMap - Flattened node map
 * @returns {Map<string|null, Array<{id: string, index: number}>>} - Map of parentId -> children array
 */
function groupByParent(nodeMap) {
    const groups = new Map();
    for (const [id, node] of nodeMap) {
        const parentId = node.parentid;
        if (!groups.has(parentId)) {
            groups.set(parentId, []);
        }
        groups.get(parentId).push({ id, index: node.index });
    }
    // Sort each group by index
    for (const children of groups.values()) {
        children.sort((a, b) => a.index - b.index);
    }
    return groups;
}

/**
 * Use LIS algorithm to detect which nodes were truly moved within the same parent.
 * Nodes in the LIS are "stable" (didn't move), nodes outside LIS are "moved".
 *
 * @param {Array<{id: string, index: number}>} beforeChildren - Children before change (sorted by index)
 * @param {Array<{id: string, index: number}>} afterChildren - Children after change (sorted by index)
 * @param {Map<string, any>} afterMap - Full after map to check existence
 * @returns {Set<string>} - Set of node IDs that were truly moved (not in LIS)
 */
function detectRealMovesWithLIS(beforeChildren, afterChildren, afterMap) {
    const movedIds = new Set();

    // Filter to only common nodes (exist in both before and after)
    const afterIdToIndex = new Map();
    afterChildren.forEach((c, i) => afterIdToIndex.set(c.id, i));

    // Build the sequence of new indices for common nodes (in before order)
    const commonNodes = [];
    const newIndexSequence = [];

    for (const beforeChild of beforeChildren) {
        if (afterIdToIndex.has(beforeChild.id)) {
            commonNodes.push(beforeChild.id);
            newIndexSequence.push(afterIdToIndex.get(beforeChild.id));
        }
    }

    if (commonNodes.length <= 1) {
        // 0 or 1 common node - no reordering possible
        return movedIds;
    }

    // Compute LIS
    const lisIndices = getSequence(newIndexSequence);
    const lisSet = new Set(lisIndices);

    // Nodes NOT in LIS are the ones that truly moved
    commonNodes.forEach((id, i) => {
        if (!lisSet.has(i)) {
            movedIds.add(id);
        }
    });

    return movedIds;
}

/**
 * Categorize updated nodes into moved, modified, or movedAndModified.
 * Uses LIS algorithm for precise move detection.
 *
 * @param {{ id: string, before: any, after: any, changes: { key: string, before: any, after: any }[] }[]} updates
 * @param {Map<string, any>} beforeMap - Flattened map before changes
 * @param {Map<string, any>} afterMap - Flattened map after changes
 * @returns {{
 *   moved: { id: string, before: any, after: any, moveInfo: MoveInfo }[],
 *   modified: { id: string, before: any, after: any, changes: { key: string, before: any, after: any }[] }[],
 *   movedAndModified: { id: string, before: any, after: any, changes: { key: string, before: any, after: any }[], moveInfo: MoveInfo }[]
 * }}
 */
function categorizeUpdates(updates, beforeMap, afterMap) {
    const moved = [];
    const modified = [];
    const movedAndModified = [];

    // Pre-compute real moves using LIS algorithm
    const realMoveIds = new Set();
    const beforeByParent = groupByParent(beforeMap);
    const afterByParent = groupByParent(afterMap);

    // For each parent in after, detect real moves among common nodes
    for (const [parentId, afterChildren] of afterByParent) {
        const beforeChildren = beforeByParent.get(parentId) || [];
        const parentRealMoves = detectRealMovesWithLIS(beforeChildren, afterChildren, afterMap);
        for (const id of parentRealMoves) {
            realMoveIds.add(id);
        }
    }

    for (const update of updates) {
        const { id, before, after, changes } = update;
        const moveDetection = detectMove(changes);

        // Cross-parent move is always a "real" move
        const isCrossParentMove = moveDetection.parentChanged;

        // For same-parent index changes, use LIS to determine if it's a real move
        const isRealReorderMove =
            !isCrossParentMove && moveDetection.orderChanged && realMoveIds.has(id);

        const isRealMove = isCrossParentMove || isRealReorderMove;

        if (isRealMove) {
            // Build moveInfo with moveType
            const moveInfo = {
                moveType: isCrossParentMove ? 'cross-parent' : 'reorder',
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
        } else if (moveDetection.orderChanged) {
            // Index changed but it's a passive shift (in LIS) - treat as unmodified if no content changes
            const contentChanges = changes.filter(c => c.key !== 'parentid' && c.key !== 'index');
            if (contentChanges.length > 0) {
                modified.push({ id, before, after, changes: contentChanges });
            }
            // If only index changed and it's passive, we skip this node entirely
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
 * // With categorization (uses LIS algorithm by default for precise move detection)
 * const result = diff(snapshot1, snapshot2, { categorize: true });
 * console.log(result.moved); // Nodes that were only moved (cross-parent or reordered)
 * console.log(result.modified); // Nodes that were only modified
 * console.log(result.movedAndModified); // Nodes that were both moved and modified
 *
 * // Check move type
 * result.moved.forEach(node => {
 *   if (node.moveInfo.moveType === 'cross-parent') {
 *     console.log(`${node.id} moved from ${node.moveInfo.fromParent} to ${node.moveInfo.toParent}`);
 *   } else if (node.moveInfo.moveType === 'reorder') {
 *     console.log(`${node.id} reordered from index ${node.moveInfo.fromOrder} to ${node.moveInfo.toOrder}`);
 *   }
 * });
 *
 * @example
 * // Disable LIS algorithm (fall back to legacy behavior where any index change = move)
 * const result = diff(snapshot1, snapshot2, { categorize: true, useLIS: false });
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
 * const result = jm.history.diff(before, after, { categorize: true });
 * // fieldNames are automatically applied, LIS algorithm is used for precise move detection
 */
export function diff(a, b, opts = {}) {
    const {
        fields,
        idKey,
        childrenKey,
        includeStructure = true,
        maxSize = 5000,
        categorize = false,
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

    // Categorize updates if requested (uses LIS algorithm for precise move detection)
    if (categorize && includeStructure) {
        const categorized = categorizeUpdates(updated, A, B);
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
