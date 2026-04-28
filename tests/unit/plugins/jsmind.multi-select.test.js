import { expect, jest, test } from '@jest/globals';
import { MultiSelectPlugin } from '../../../src/plugins/multi-select/jsmind.multi-select.js';
import { EventType } from '../../../src/jsmind.common.js';

function makeMouseEvent(type, init = {}) {
    const evt = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: init.clientX || 0,
        clientY: init.clientY || 0,
        ctrlKey: !!init.ctrlKey,
        metaKey: !!init.metaKey,
        shiftKey: !!init.shiftKey,
        button: typeof init.button === 'number' ? init.button : 0,
    });
    Object.defineProperty(evt, 'which', {
        value: typeof init.which === 'number' ? init.which : 1,
        configurable: true,
    });
    return evt;
}

function createNode(id, rect) {
    const element = document.createElement('jmnode');
    element.setAttribute('nodeid', id);
    element.getBoundingClientRect = jest.fn(() => ({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
    }));
    return {
        id,
        _data: { view: { element } },
    };
}

function createJmMock() {
    const e_panel = document.createElement('div');
    const e_nodes = document.createElement('jmnodes');
    e_panel.appendChild(e_nodes);
    document.body.appendChild(e_panel);

    const nodeA = createNode('a', { left: 10, top: 10, right: 40, bottom: 40 });
    const nodeB = createNode('b', { left: 60, top: 10, right: 90, bottom: 40 });
    const nodeC = createNode('c', { left: 200, top: 200, right: 240, bottom: 240 });
    e_nodes.appendChild(nodeA._data.view.element);
    e_nodes.appendChild(nodeB._data.view.element);
    e_nodes.appendChild(nodeC._data.view.element);

    const jm = {
        mind: {
            selected: null,
            selected_nodes: new Set(),
            nodes: {
                a: nodeA,
                b: nodeB,
                c: nodeC,
            },
        },
        view: {
            selected_node: null,
            e_nodes,
            e_panel,
            get_binded_nodeid(element) {
                if (!element) return null;
                const tag = element.tagName ? element.tagName.toLowerCase() : '';
                if (tag === 'jmnode' || tag === 'jmexpander') {
                    return element.getAttribute('nodeid');
                }
                if (tag === 'jmnodes' || tag === 'body' || tag === 'html' || tag === 'div') {
                    return null;
                }
                return this.get_binded_nodeid(element.parentElement);
            },
            is_node(element) {
                return !!element && element.tagName && element.tagName.toLowerCase() === 'jmnode';
            },
        },
        layout: {
            is_visible: jest.fn(() => true),
        },
        get_node(id) {
            return this.mind.nodes[id] || null;
        },
        invoke_event_handle: jest.fn(),
        event_handles: [],
        add_event_listener(fn) {
            this.event_handles.push(fn);
        },
        options: {
            default_event_handle: {
                enable_mousedown_handle: true,
            },
        },
        disable_event_handle: jest.fn(function (name) {
            this.options.default_event_handle['enable_' + name + '_handle'] = false;
        }),
        enable_event_handle: jest.fn(function (name) {
            this.options.default_event_handle['enable_' + name + '_handle'] = true;
        }),
    };

    return { jm, nodes: { nodeA, nodeB, nodeC }, e_nodes, e_panel };
}

test('Ctrl/Cmd + click toggles node selection', () => {
    const { jm, nodes } = createJmMock();
    new MultiSelectPlugin({ jm, pluginOpt: { enable_multi_select: true } });

    nodes.nodeA._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );
    expect(jm.multiSelect.get_selected_nodes()).toEqual(['a']);

    nodes.nodeA._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );
    expect(jm.multiSelect.get_selected_nodes()).toEqual([]);
});

test('normal click replaces selection and blank click clears selection', () => {
    const { jm, nodes, e_nodes } = createJmMock();
    new MultiSelectPlugin({ jm, pluginOpt: { enable_multi_select: true } });

    nodes.nodeA._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );
    nodes.nodeB._data.view.element.dispatchEvent(makeMouseEvent('mousedown', { which: 1 }));

    expect(jm.multiSelect.get_selected_nodes()).toEqual(['b']);

    e_nodes.dispatchEvent(makeMouseEvent('mousedown', { which: 1 }));
    expect(jm.multiSelect.get_selected_nodes()).toEqual([]);
});

test('box selection selects multiple nodes', () => {
    const { jm, e_nodes } = createJmMock();
    new MultiSelectPlugin({ jm, pluginOpt: { enable_multi_select: true } });

    e_nodes.dispatchEvent(
        makeMouseEvent('mousedown', {
            ctrlKey: true,
            which: 3,
            button: 2,
            clientX: 0,
            clientY: 0,
        })
    );
    document.dispatchEvent(makeMouseEvent('mousemove', { clientX: 100, clientY: 50 }));
    document.dispatchEvent(makeMouseEvent('mouseup', { clientX: 100, clientY: 50 }));

    expect(new Set(jm.multiSelect.get_selected_nodes())).toEqual(new Set(['a', 'b']));
    expect(jm.multiSelect.get_selection_mode()).toBe('multi');
});

test('box selection appends to previous selection when modifier is pressed', () => {
    const { jm, nodes, e_nodes } = createJmMock();
    new MultiSelectPlugin({ jm, pluginOpt: { enable_multi_select: true } });

    nodes.nodeC._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );
    expect(jm.multiSelect.get_selected_nodes()).toEqual(['c']);

    e_nodes.dispatchEvent(
        makeMouseEvent('mousedown', {
            ctrlKey: true,
            which: 3,
            button: 2,
            clientX: 0,
            clientY: 0,
        })
    );
    document.dispatchEvent(makeMouseEvent('mousemove', { clientX: 100, clientY: 50 }));
    document.dispatchEvent(makeMouseEvent('mouseup', { clientX: 100, clientY: 50 }));

    expect(new Set(jm.multiSelect.get_selected_nodes())).toEqual(new Set(['a', 'b', 'c']));
});

test('box selection replaces previous selection in left-drag mode without modifier', () => {
    const { jm, nodes, e_nodes } = createJmMock();
    new MultiSelectPlugin({
        jm,
        pluginOpt: {
            enable_multi_select: true,
            use_left_key_selection_right_key_drag: true,
        },
    });

    nodes.nodeC._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );
    expect(jm.multiSelect.get_selected_nodes()).toEqual(['c']);

    e_nodes.dispatchEvent(
        makeMouseEvent('mousedown', {
            which: 1,
            button: 0,
            clientX: 0,
            clientY: 0,
        })
    );
    document.dispatchEvent(makeMouseEvent('mousemove', { clientX: 100, clientY: 50 }));
    document.dispatchEvent(makeMouseEvent('mouseup', { clientX: 100, clientY: 50 }));

    expect(new Set(jm.multiSelect.get_selected_nodes())).toEqual(new Set(['a', 'b']));
});

test('disable does not intercept selection and enable restores interception', () => {
    const { jm, nodes } = createJmMock();
    new MultiSelectPlugin({ jm, pluginOpt: { enable_multi_select: true } });

    jm.multiSelect.disable();
    nodes.nodeA._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );
    expect(jm.multiSelect.get_selected_nodes()).toEqual([]);

    jm.multiSelect.enable();
    nodes.nodeA._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );
    expect(jm.multiSelect.get_selected_nodes()).toEqual(['a']);
});

test('beforePluginRemove unbinds listeners and removes API', () => {
    const { jm, nodes } = createJmMock();
    const plugin = new MultiSelectPlugin({ jm, pluginOpt: { enable_multi_select: true } });

    plugin.beforePluginRemove();
    nodes.nodeA._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );

    expect(jm.multiSelect).toBeUndefined();
    expect(jm.options.default_event_handle.enable_mousedown_handle).toBe(true);
});

test('edit remove_node event prunes removed selected nodes', () => {
    const { jm, nodes } = createJmMock();
    const plugin = new MultiSelectPlugin({ jm, pluginOpt: { enable_multi_select: true } });

    nodes.nodeA._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );
    nodes.nodeB._data.view.element.dispatchEvent(
        makeMouseEvent('mousedown', { ctrlKey: true, which: 1 })
    );

    plugin._listener(EventType.edit, { evt: 'remove_node', data: ['a'] });
    expect(jm.multiSelect.get_selected_nodes()).toEqual(['b']);
});
