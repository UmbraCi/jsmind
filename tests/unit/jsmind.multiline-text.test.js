import { expect, jest, test } from '@jest/globals';

const mockedJsMind = {
    $: {
        c: tag => document.createElement(tag),
        on: (el, event, fn) => el.addEventListener(event, fn),
        h: (el, html) => {
            el.innerHTML = html;
        },
        t: (el, text) => {
            el.textContent = text;
        },
        d: document,
        w: window,
    },
    util: {
        text: {
            is_empty: value => !value || !String(value).trim(),
        },
    },
    usePlugin: jest.fn(),
};

await jest.unstable_mockModule('@umbraci/jsmind', () => ({
    default: mockedJsMind,
}));

const { MultilineTextPlugin, createMultilineRender } = await import(
    '../../src/plugins/jsmind.multiline-text.js'
);

function createJmMock() {
    const originalRender = jest.fn(() => false);
    const view = {
        opts: { custom_node_render: originalRender },
        _custom_node_render: jest.fn(function (element, node) {
            return this.opts.custom_node_render(this.jmRef, element, node);
        }),
        _default_node_render: jest.fn(),
        edit_node_begin: jest.fn(),
        edit_node_end: jest.fn(),
        render_node: jest.fn(),
        show: jest.fn(),
        e_panel: { focus: jest.fn() },
        editing_node: null,
    };

    const jm = {
        options: { support_html: false, view: { custom_node_render: originalRender } },
        view,
        mind: { root: { id: 'root' }, nodes: {} },
        layout: { is_visible: jest.fn(() => false), layout: jest.fn() },
        update_node: jest.fn(),
    };
    view.jmRef = jm;

    return { jm, view, originalRender };
}

test('createMultilineRender only handles multiline content', () => {
    const render = createMultilineRender({ text_width: 260 });
    const element = document.createElement('div');

    expect(render({}, element, { topic: 'line1\nline2' })).toBe(true);
    expect(element.style.whiteSpace).toBe('pre-wrap');
    expect(element.style.maxWidth).toBe('260px');
    expect(element.textContent).toBe('line1\nline2');

    expect(render({}, element, { topic: 'single line' })).toBe(false);
});

test('plugin merges options and handles Enter/Escape edit flow', () => {
    const { jm, view } = createJmMock();
    const plugin = new MultilineTextPlugin({
        jm,
        pluginOpt: {
            min_height: 48,
            editor_border_color: '#123456',
            editor_border_width: '3px',
            auto_resize: true,
        },
    });

    const element = document.createElement('div');
    element.style.paddingLeft = '2px';
    element.style.paddingRight = '2px';
    Object.defineProperty(element, 'clientWidth', { value: 100, configurable: true });

    const node = { id: 'n1', topic: 'old', _data: { view: { element } } };

    plugin.edit_node_begin(node);
    let editor = element.querySelector('.jsmind-multiline-editor');
    expect(editor).not.toBeNull();
    expect(editor.style.minHeight).toBe('48px');
    expect(editor.style.border).toContain('#123456');

    editor.textContent = 'new value';
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(jm.update_node).toHaveBeenCalledWith('n1', 'new value');

    plugin.edit_node_begin(node);
    editor = element.querySelector('.jsmind-multiline-editor');
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view._custom_node_render).toHaveBeenCalledWith(node._data.view.element, node);
});

test('beforePluginRemove restores render and edit handlers', () => {
    const { jm, view, originalRender } = createJmMock();
    const originalBegin = view.edit_node_begin;
    const originalEnd = view.edit_node_end;

    const plugin = new MultilineTextPlugin({ jm, pluginOpt: {} });
    expect(view.opts.custom_node_render).not.toBe(originalRender);
    expect(view.edit_node_begin).not.toBe(originalBegin);
    expect(view.edit_node_end).not.toBe(originalEnd);

    plugin.beforePluginRemove();

    expect(view.opts.custom_node_render).toBe(originalRender);
    expect(jm.options.view.custom_node_render).toBe(originalRender);
    view.edit_node_begin({ topic: 'noop' });
    view.edit_node_end();
    expect(originalBegin).toHaveBeenCalled();
    expect(originalEnd).toHaveBeenCalled();
    expect(view.render_node).toBe(view._default_node_render);
});
