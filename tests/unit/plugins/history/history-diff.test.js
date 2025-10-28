/**
 * Unit tests for history-diff.js
 */

import { flatten, diff } from '../../../../src/plugins/history/history-diff.js';

describe('history-diff', () => {
    // Test fixtures
    const simpleTree = {
        meta: { name: 'test', author: 'test', version: '1.0' },
        format: 'node_tree',
        data: {
            id: 'root',
            topic: 'Root',
            data: { note: 'root note' },
            children: [
                {
                    id: 'node1',
                    topic: 'Node 1',
                    data: { note: 'note 1' },
                    children: [
                        { id: 'node1-1', topic: 'Node 1-1', data: {} },
                        { id: 'node1-2', topic: 'Node 1-2', data: {} },
                    ],
                },
                { id: 'node2', topic: 'Node 2', data: {} },
            ],
        },
    };

    const modifiedTree = {
        meta: { name: 'test', author: 'test', version: '1.0' },
        format: 'node_tree',
        data: {
            id: 'root',
            topic: 'Root Modified',
            data: { note: 'root note modified' },
            children: [
                {
                    id: 'node1',
                    topic: 'Node 1 Modified',
                    data: { note: 'note 1 modified' },
                    children: [
                        { id: 'node1-1', topic: 'Node 1-1', data: {} },
                        { id: 'node1-2', topic: 'Node 1-2 Modified', data: {} },
                    ],
                },
                { id: 'node2', topic: 'Node 2', data: {} },
                { id: 'node3', topic: 'Node 3', data: {} }, // New node
            ],
        },
    };

    const movedTree = {
        meta: { name: 'test', author: 'test', version: '1.0' },
        format: 'node_tree',
        data: {
            id: 'root',
            topic: 'Root',
            data: { note: 'root note' },
            children: [
                {
                    id: 'node1',
                    topic: 'Node 1',
                    data: { note: 'note 1' },
                    children: [
                        { id: 'node1-2', topic: 'Node 1-2', data: {} }, // Moved from position 1 to 0
                        { id: 'node1-1', topic: 'Node 1-1', data: {} },
                    ],
                },
                {
                    id: 'node2',
                    topic: 'Node 2',
                    data: {},
                    children: [
                        { id: 'node1-1-moved', topic: 'Moved Node', data: {} }, // Moved from node1 to node2
                    ],
                },
            ],
        },
    };

    describe('flatten()', () => {
        it('should return a Map', () => {
            const result = flatten(simpleTree);
            expect(result).toBeInstanceOf(Map);
        });

        it('should use default fields [topic, data, id] when fields not specified', () => {
            const result = flatten(simpleTree);
            const rootNode = result.get('root');
            expect(rootNode).toHaveProperty('id');
            expect(rootNode).toHaveProperty('topic');
            expect(rootNode).toHaveProperty('data');
            expect(rootNode).toHaveProperty('parentid');
            expect(rootNode).toHaveProperty('index');
        });

        it('should respect custom fields option', () => {
            const result = flatten(simpleTree, { fields: ['id', 'topic'] });
            const rootNode = result.get('root');
            expect(rootNode).toHaveProperty('id');
            expect(rootNode).toHaveProperty('topic');
            expect(rootNode).not.toHaveProperty('data');
        });

        it('should include structure fields when includeStructure is true', () => {
            const result = flatten(simpleTree, { includeStructure: true });
            const node1 = result.get('node1');
            expect(node1).toHaveProperty('parentid', 'root');
            expect(node1).toHaveProperty('index');
        });

        it('should exclude structure fields when includeStructure is false', () => {
            const result = flatten(simpleTree, { includeStructure: false });
            const node1 = result.get('node1');
            expect(node1).not.toHaveProperty('parentid');
            expect(node1).not.toHaveProperty('index');
        });

        it('should flatten all nodes in the tree', () => {
            const result = flatten(simpleTree);
            expect(result.size).toBe(5); // root, node1, node1-1, node1-2, node2
            expect(result.has('root')).toBe(true);
            expect(result.has('node1')).toBe(true);
            expect(result.has('node1-1')).toBe(true);
            expect(result.has('node1-2')).toBe(true);
            expect(result.has('node2')).toBe(true);
        });
    });

    describe('diff()', () => {
        it('should detect created nodes', () => {
            const result = diff(simpleTree, modifiedTree);
            expect(result.created).toHaveLength(1);
            expect(result.created[0].id).toBe('node3');
        });

        it('should detect deleted nodes', () => {
            const result = diff(modifiedTree, simpleTree);
            expect(result.deleted).toHaveLength(1);
            expect(result.deleted[0].id).toBe('node3');
        });

        it('should detect updated nodes', () => {
            const result = diff(simpleTree, modifiedTree);
            expect(result.updated.length).toBeGreaterThan(0);
            const rootUpdate = result.updated.find(u => u.id === 'root');
            expect(rootUpdate).toBeDefined();
            expect(rootUpdate.changes).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ key: 'topic' }),
                    expect.objectContaining({ key: 'data' }),
                ])
            );
        });

        it('should include change details in updated nodes', () => {
            const result = diff(simpleTree, modifiedTree);
            const rootUpdate = result.updated.find(u => u.id === 'root');
            const topicChange = rootUpdate.changes.find(c => c.key === 'topic');
            expect(topicChange.before).toBe('Root');
            expect(topicChange.after).toBe('Root Modified');
        });

        it('should respect maxSize option', () => {
            const result = diff(simpleTree, modifiedTree, { maxSize: 2 });
            const total = result.created.length + result.updated.length + result.deleted.length;
            expect(total).toBeLessThanOrEqual(2);
            expect(result.truncated).toBe(true);
        });

        it('should not truncate when under maxSize', () => {
            const result = diff(simpleTree, modifiedTree, { maxSize: 100 });
            expect(result.truncated).toBe(false);
        });

        it('should use default fields when not specified', () => {
            const result = diff(simpleTree, modifiedTree);
            expect(result.updated.length).toBeGreaterThan(0);
        });

        it('should respect custom fields option', () => {
            const result = diff(simpleTree, modifiedTree, { fields: ['id', 'topic'] });
            const rootUpdate = result.updated.find(u => u.id === 'root');
            if (rootUpdate) {
                const hasDataChange = rootUpdate.changes.some(c => c.key === 'data');
                expect(hasDataChange).toBe(false);
            }
        });
    });

    describe('diff() with categorize option', () => {
        it('should not categorize by default', () => {
            const result = diff(simpleTree, modifiedTree);
            expect(result.moved).toBeUndefined();
            expect(result.modified).toBeUndefined();
            expect(result.movedAndModified).toBeUndefined();
        });

        it('should categorize when categorize=true', () => {
            const result = diff(simpleTree, modifiedTree, { categorize: true });
            expect(result.moved).toBeDefined();
            expect(result.modified).toBeDefined();
            expect(result.movedAndModified).toBeDefined();
        });

        it('should detect moved nodes', () => {
            const treeWithMove = {
                ...simpleTree,
                data: {
                    ...simpleTree.data,
                    children: [
                        {
                            id: 'node1',
                            topic: 'Node 1',
                            data: { note: 'note 1' },
                            children: [],
                        },
                        {
                            id: 'node2',
                            topic: 'Node 2',
                            data: {},
                            children: [
                                { id: 'node1-1', topic: 'Node 1-1', data: {} }, // Moved from node1 to node2
                            ],
                        },
                    ],
                },
            };

            const result = diff(simpleTree, treeWithMove, { categorize: true });
            expect(result.moved.length).toBeGreaterThan(0);
            const movedNode = result.moved.find(m => m.id === 'node1-1');
            expect(movedNode).toBeDefined();
            expect(movedNode.moveInfo.parentChanged).toBe(true);
        });

        it('should detect modified nodes (no movement)', () => {
            const result = diff(simpleTree, modifiedTree, { categorize: true });
            expect(result.modified.length).toBeGreaterThan(0);
        });

        it('should detect movedAndModified nodes', () => {
            const treeWithMoveAndModify = {
                ...simpleTree,
                data: {
                    ...simpleTree.data,
                    children: [
                        {
                            id: 'node1',
                            topic: 'Node 1',
                            data: { note: 'note 1' },
                            children: [],
                        },
                        {
                            id: 'node2',
                            topic: 'Node 2',
                            data: {},
                            children: [
                                { id: 'node1-1', topic: 'Node 1-1 Modified', data: {} }, // Moved and modified
                            ],
                        },
                    ],
                },
            };

            const result = diff(simpleTree, treeWithMoveAndModify, { categorize: true });
            expect(result.movedAndModified.length).toBeGreaterThan(0);
            const movedAndModified = result.movedAndModified.find(m => m.id === 'node1-1');
            expect(movedAndModified).toBeDefined();
            expect(movedAndModified.moveInfo.parentChanged).toBe(true);
            expect(movedAndModified.changes.length).toBeGreaterThan(0);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty trees', () => {
            const emptyTree = {
                meta: {},
                format: 'node_tree',
                data: { id: 'root', topic: 'Root', data: {} },
            };
            const result = diff(emptyTree, emptyTree);
            expect(result.created).toHaveLength(0);
            expect(result.updated).toHaveLength(0);
            expect(result.deleted).toHaveLength(0);
        });

        it('should handle identical trees', () => {
            const result = diff(simpleTree, simpleTree);
            expect(result.created).toHaveLength(0);
            expect(result.updated).toHaveLength(0);
            expect(result.deleted).toHaveLength(0);
        });

        it('should handle tree with only root node', () => {
            const rootOnly = {
                format: 'node_tree',
                data: { id: 'root', topic: 'Root', data: {} },
            };
            const result = diff(rootOnly, rootOnly);
            expect(result.created).toHaveLength(0);
            expect(result.updated).toHaveLength(0);
            expect(result.deleted).toHaveLength(0);
        });

        it('should handle deep nested trees', () => {
            const deepTree = {
                format: 'node_tree',
                data: {
                    id: 'root',
                    topic: 'Root',
                    children: [
                        {
                            id: 'level1',
                            topic: 'Level 1',
                            children: [
                                {
                                    id: 'level2',
                                    topic: 'Level 2',
                                    children: [{ id: 'level3', topic: 'Level 3' }],
                                },
                            ],
                        },
                    ],
                },
            };
            const flatMap = flatten(deepTree);
            expect(flatMap.size).toBe(4); // root + 3 levels
            expect(flatMap.get('level3').parentid).toBe('level2');
        });

        it('should handle nodes with missing optional fields', () => {
            const sparseTree = {
                format: 'node_tree',
                data: {
                    id: 'root',
                    topic: 'Root',
                    children: [
                        { id: 'node1', topic: 'Node 1' }, // No data field
                        { id: 'node2' }, // No topic field
                    ],
                },
            };
            const flatMap = flatten(sparseTree);
            expect(flatMap.size).toBe(3);
            expect(flatMap.get('node1').data).toBeUndefined();
            expect(flatMap.get('node2').topic).toBeUndefined();
        });

        it('should handle complex data objects', () => {
            const complexTree = {
                format: 'node_tree',
                data: {
                    id: 'root',
                    topic: 'Root',
                    data: {
                        nested: { deep: { value: 123 } },
                        array: [1, 2, 3],
                        null: null,
                        boolean: true,
                    },
                },
            };
            const flatMap = flatten(complexTree);
            const rootNode = flatMap.get('root');
            expect(rootNode.data.nested.deep.value).toBe(123);
            expect(rootNode.data.array).toEqual([1, 2, 3]);
        });
    });

    describe('Real-world scenarios', () => {
        it('should detect drag and drop to different parent', () => {
            const before = {
                format: 'node_tree',
                data: {
                    id: 'root',
                    topic: 'Root',
                    children: [
                        {
                            id: 'parent1',
                            topic: 'Parent 1',
                            children: [{ id: 'child', topic: 'Child' }],
                        },
                        { id: 'parent2', topic: 'Parent 2', children: [] },
                    ],
                },
            };

            const after = {
                format: 'node_tree',
                data: {
                    id: 'root',
                    topic: 'Root',
                    children: [
                        { id: 'parent1', topic: 'Parent 1', children: [] },
                        {
                            id: 'parent2',
                            topic: 'Parent 2',
                            children: [{ id: 'child', topic: 'Child' }],
                        },
                    ],
                },
            };

            const result = diff(before, after, { categorize: true });
            expect(result.moved).toHaveLength(1);
            expect(result.moved[0].id).toBe('child');
            expect(result.moved[0].moveInfo.fromParent).toBe('parent1');
            expect(result.moved[0].moveInfo.toParent).toBe('parent2');
            expect(result.moved[0].moveInfo.parentChanged).toBe(true);
        });

        it('should detect reordering within same parent', () => {
            const before = {
                format: 'node_tree',
                data: {
                    id: 'root',
                    topic: 'Root',
                    children: [
                        { id: 'node1', topic: 'Node 1' },
                        { id: 'node2', topic: 'Node 2' },
                        { id: 'node3', topic: 'Node 3' },
                    ],
                },
            };

            const after = {
                format: 'node_tree',
                data: {
                    id: 'root',
                    topic: 'Root',
                    children: [
                        { id: 'node3', topic: 'Node 3' },
                        { id: 'node1', topic: 'Node 1' },
                        { id: 'node2', topic: 'Node 2' },
                    ],
                },
            };

            const result = diff(before, after, { categorize: true });
            expect(result.moved.length).toBeGreaterThan(0);
            const node3 = result.moved.find(n => n.id === 'node3');
            expect(node3.moveInfo.orderChanged).toBe(true);
        });
    });
});
