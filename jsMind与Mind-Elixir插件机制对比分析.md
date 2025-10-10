# jsMind、Mind-Elixir-Core 与 Simple-Mind-Map 插件机制对比分析

## 目录

1. [概述](#概述)
2. [jsMind 插件机制](#jsmind-插件机制)
3. [Mind-Elixir-Core 插件机制](#mind-elixir-core-插件机制)
4. [Simple-Mind-Map 插件机制](#simple-mind-map-插件机制)
5. [三者详细对比](#三者详细对比)
6. [优劣势分析](#优劣势分析)
7. [实践建议](#实践建议)

---

## 概述

jsMind、Mind-Elixir-Core 和 Simple-Mind-Map 是三个流行的思维导图库，它们采用了不同的插件机制来扩展功能。本文档详细对比三者的插件机制实现，分析各自的优劣势，并提供实践建议。

### 核心差异

| 特性               | jsMind             | Mind-Elixir-Core    | Simple-Mind-Map    |
| ------------------ | ------------------ | ------------------- | ------------------ |
| **设计模式**       | 类 + 注册机制      | 函数式              | 类 + 静态属性      |
| **初始化时机**     | 异步（setTimeout） | 同步（init 方法内） | 同步（构造函数内） |
| **生命周期管理**   | 无统一管理         | disposable 数组     | 生命周期钩子       |
| **第三方插件支持** | ✅ 支持            | ❌ 不支持           | ✅ 支持            |
| **配置方式**       | plugin 配置对象    | Options 配置项      | 构造函数传入       |
| **插件移除**       | ❌ 不支持          | ✅ 支持             | ✅ 支持            |

---

## jsMind 插件机制

### 1. 插件定义

jsMind 的插件是一个**类**，需要实现特定的接口：

```javascript
// src/plugins/jsmind.multiline-text.js
export class MultilineText {
    constructor(jm, options) {
        this.jm = jm; // jsMind 实例
        this.options = options; // 插件配置
        this.editing_node = null;
        this.multiline_editor = null;
    }

    init() {
        // 插件初始化逻辑
        const view = this.jm.view;

        // 覆盖编辑方法
        view.edit_node_begin = this.edit_node_begin.bind(this);
        view.edit_node_end = this.edit_node_end.bind(this);

        // 重新渲染所有节点
        this._rerender_all_nodes();
    }

    edit_node_begin(node) {
        // 编辑开始逻辑
    }

    edit_node_end() {
        // 编辑结束逻辑
    }
}
```

### 2. 插件注册

使用 `jsMind.plugin` 类创建插件实例，然后通过 `register_plugin()` 注册：

```javascript
// 创建插件实例
export const multiline_text_plugin = new jsMind.plugin(
    'multiline_text', // 插件名称
    function (jm, options) {
        const mt = new MultilineText(jm, options);
        mt.init();
        jm.multiline_text = mt; // 将插件实例挂载到 jsMind 实例上
    }
);

// 注册插件
jsMind.register_plugin(multiline_text_plugin);
```

### 3. 插件初始化

插件在 `jsmind.plugin.js` 中**异步**初始化：

```javascript
// src/jsmind.plugin.js
export function apply(jm, options) {
    $.w.setTimeout(function () {
        _apply(jm, options);
    }, 0); // ← 异步初始化
}

function _apply(jm, options) {
    w.plugins.forEach(plugin => plugin.fn_init(jm, options[plugin.name]));
}
```

**时序**：

```
1. jsMind 实例创建
2. 调用 show() 方法
3. 数据加载、布局计算、节点渲染
4. 异步调用插件初始化（setTimeout）
5. 插件初始化完成
```

### 4. 插件配置

通过 `plugin` 配置对象传递插件选项：

```javascript
const jm = new jsMind({
    container: 'jsmind_container',
    editable: true,
    plugin: {
        multiline_text: {
            text_width: 200,
            editor_border_color: '#4CAF50',
            auto_resize: true,
        },
    },
});
```

### 5. 插件架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        jsMind Instance                       │
├─────────────────────────────────────────────────────────────┤
│  - mind: Mind                                               │
│  - view: ViewProvider                                       │
│  - layout: Layout                                           │
│  - data: Data                                               │
│  - multiline_text: MultilineText  ← 插件实例挂载在这里      │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │ 异步初始化（setTimeout）
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Plugin System                          │
├─────────────────────────────────────────────────────────────┤
│  plugins: [                                                 │
│    {                                                        │
│      name: 'multiline_text',                               │
│      fn_init: function(jm, options) {                      │
│        const mt = new MultilineText(jm, options);          │
│        mt.init();                                          │
│        jm.multiline_text = mt;                             │
│      }                                                     │
│    }                                                       │
│  ]                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Mind-Elixir-Core 插件机制

### 1. 插件定义

Mind-Elixir-Core 的插件是一个**函数**，返回清理函数：

```typescript
// src/plugin/nodeDraggable.ts
export default function (mind: MindElixirInstance) {
    // 1. 插件状态（闭包）
    let insertTpye: InsertType = null;
    let meet: Topic | null = null;
    const ghost = createGhost(mind);
    const edgeMoveController = new EdgeMoveController(mind);

    // 2. 事件处理函数
    const handleDragStart = (e: DragEvent) => {
        mind.selection.cancel();
        const target = e.target as Topic;
        // ... 拖拽开始逻辑
    };

    const handleDragEnd = (e: DragEvent) => {
        // ... 拖拽结束逻辑
    };

    const handleDragOver = (e: DragEvent) => {
        // ... 拖拽过程逻辑
    };

    // 3. 注册事件监听
    const off = on([
        { dom: mind.map, evt: 'dragstart', func: handleDragStart },
        { dom: mind.map, evt: 'dragend', func: handleDragEnd },
        { dom: mind.map, evt: 'dragover', func: handleDragOver },
    ]);

    // 4. 返回清理函数
    return off;
}
```

### 2. 插件导入

直接在 `methods.ts` 中导入插件：

```typescript
// src/methods.ts
import contextMenu from './plugin/contextMenu';
import keypressInit from './plugin/keypress';
import nodeDraggable from './plugin/nodeDraggable';
import operationHistory from './plugin/operationHistory';
import toolBar from './plugin/toolBar';
import selection from './plugin/selection';
```

### 3. 插件初始化

插件在 `init()` 方法中**同步**调用：

```typescript
// src/methods.ts
export default {
    init(this: MindElixirInstance, data: MindElixirData) {
        // 数据初始化
        this.nodeData = data.nodeData;
        fillParent(this.nodeData);

        // 插件初始化（同步）
        this.toolBar && toolBar(this);

        if (import.meta.env.MODE !== 'lite') {
            this.keypress && keypressInit(this, this.keypress);

            if (this.editable) {
                selection(this);
            }

            if (this.contextMenu) {
                this.disposable.push(contextMenu(this, this.contextMenu));
            }

            this.draggable && this.disposable.push(nodeDraggable(this));
            this.allowUndo && this.disposable.push(operationHistory(this));
        }

        // 布局和渲染
        this.layout();
        this.linkDiv();
        this.toCenter();
    },
};
```

**时序**：

```
1. MindElixir 实例创建
2. 调用 init() 方法
3. 数据加载
4. 同步调用插件初始化
5. 布局计算、节点渲染
```

### 4. 插件清理

在 `destroy()` 方法中调用所有清理函数：

```typescript
// src/methods.ts
destroy(this: Partial<MindElixirInstance>) {
    // 调用所有清理函数
    this.disposable!.forEach(fn => fn());

    // 清理实例属性
    if (this.el) this.el.innerHTML = '';
    this.el = undefined;
    this.nodeData = undefined;
    // ...
}
```

### 5. 插件配置

通过 `Options` 配置项启用插件：

```typescript
const mind = new MindElixir({
    el: '#map',
    draggable: true, // 启用拖拽插件
    contextMenu: true, // 启用右键菜单插件
    keypress: true, // 启用键盘插件
    editable: true, // 启用编辑功能（selection 插件）
    allowUndo: true, // 启用撤销/重做插件
});
```

### 6. 插件架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    MindElixir Instance                       │
├─────────────────────────────────────────────────────────────┤
│  - nodeData: NodeObj                                        │
│  - container: HTMLElement                                   │
│  - map: HTMLElement                                         │
│  - disposable: Array<() => void>  ← 清理函数数组            │
│  - selection: SelectionArea                                 │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │ 同步初始化（init 方法内）
                            │
┌─────────────────────────────────────────────────────────────┐
│                         Plugins                             │
├─────────────────────────────────────────────────────────────┤
│  nodeDraggable(mind) → () => void                           │
│  contextMenu(mind, options) → () => void                    │
│  operationHistory(mind) → () => void                        │
│  selection(mind) → void                                     │
│  toolBar(mind) → void                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Simple-Mind-Map 插件机制

### 1. 插件定义

Simple-Mind-Map 的插件是一个**类**，需要实现特定的接口和静态属性：

```javascript
// 插件类定义
class YourPlugin {
    constructor({ mindMap }) {
        this.mindMap = mindMap; // 保存思维导图实例
    }

    // 插件被移除前的生命周期钩子
    beforePluginRemove() {
        // 清理插件资源
    }

    // 插件被销毁前的生命周期钩子
    beforePluginDestroy() {
        // 清理插件资源
    }
}

// 静态属性：插件实例名称
YourPlugin.instanceName = 'yourPlugin';

// 静态属性：是否在核心类实例化前加载（v0.14.0+）
YourPlugin.preload = true; // 默认为 false
```

### 2. 插件注册

Simple-Mind-Map 使用**构造函数传入**的方式注册插件：

```javascript
import MindMap from 'simple-mind-map';
import YourPlugin from './YourPlugin';

const mindMap = new MindMap({
    el: document.getElementById('mindMapContainer'),
    data: {
        data: { text: '根节点' },
        children: [],
    },
    // 传入插件类
    plugins: [YourPlugin],
});
```

### 3. 插件初始化

插件在 MindMap 构造函数中**同步**初始化：

```javascript
// simple-mind-map/src/MindMap.js (简化版)
class MindMap {
    constructor(opt) {
        // 1. 初始化核心模块
        this.event = new Event();
        this.keyCommand = new KeyCommand(this);
        this.command = new Command(this);
        this.renderer = new Renderer(this);

        // 2. 初始化插件
        if (opt.plugins && opt.plugins.length > 0) {
            opt.plugins.forEach(plugin => {
                // 检查是否需要预加载
                if (plugin.preload) {
                    // 预加载插件在核心模块之前初始化
                }

                // 实例化插件
                const instance = new plugin({ mindMap: this });

                // 通过静态属性 instanceName 挂载到实例上
                this[plugin.instanceName] = instance;
            });
        }

        // 3. 渲染思维导图
        this.render();
    }
}
```

**时序**：

```
1. MindMap 实例创建
2. 核心模块初始化（Event、KeyCommand、Command、Renderer）
3. 同步初始化插件（遍历 plugins 数组）
4. 渲染思维导图
```

### 4. 插件移除

Simple-Mind-Map 支持动态移除插件：

```javascript
// 移除插件
mindMap.removePlugin(YourPlugin);

// 内部实现
removePlugin(plugin) {
    const instance = this[plugin.instanceName];
    if (instance) {
        // 调用生命周期钩子
        if (instance.beforePluginRemove) {
            instance.beforePluginRemove();
        }
        // 从实例上移除
        delete this[plugin.instanceName];
    }
}
```

### 5. 插件销毁

在销毁思维导图时，会调用所有插件的销毁钩子：

```javascript
// 销毁思维导图
mindMap.destroy();

// 内部实现
destroy() {
    // 调用所有插件的销毁钩子
    Object.keys(this).forEach(key => {
        const instance = this[key];
        if (instance && instance.beforePluginDestroy) {
            instance.beforePluginDestroy();
        }
    });

    // 清理其他资源
    this.renderer.destroy();
    this.event.destroy();
    // ...
}
```

### 6. 插件继承

Simple-Mind-Map 支持插件继承：

```javascript
import ScrollbarPlugin from 'simple-mind-map/src/plugins/Scrollbar.js';

class YourPlugin extends ScrollbarPlugin {
    constructor(opt) {
        super(opt);
        // 扩展功能
    }

    // 重写方法
    someMethod() {
        super.someMethod();
        // 添加额外逻辑
    }
}

YourPlugin.instanceName = 'yourPlugin';
```

### 7. 插件架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      MindMap Instance                        │
├─────────────────────────────────────────────────────────────┤
│  - event: Event                                             │
│  - keyCommand: KeyCommand                                   │
│  - command: Command                                         │
│  - renderer: Renderer                                       │
│  - yourPlugin: YourPlugin  ← 插件实例挂载在这里             │
│  - scrollbar: Scrollbar                                     │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │ 同步初始化（构造函数内）
                            │
┌─────────────────────────────────────────────────────────────┐
│                         Plugins                             │
├─────────────────────────────────────────────────────────────┤
│  class YourPlugin {                                         │
│    static instanceName = 'yourPlugin'                       │
│    static preload = false                                   │
│    constructor({ mindMap }) { ... }                         │
│    beforePluginRemove() { ... }                             │
│    beforePluginDestroy() { ... }                            │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

### 8. 第三方插件发布

Simple-Mind-Map 鼓励开发者发布第三方插件到 npm：

**插件包命名规范**：

```
simple-mind-map-plugin-xxx
```

**package.json 示例**：

```json
{
    "name": "simple-mind-map-plugin-xxx",
    "version": "1.0.0",
    "description": "插件的描述",
    "module": "index.js",
    "main": "./dist/xxx.esm.min.js",
    "scripts": {
        "build": "esbuild ./index.js --bundle --minify --external:buffer --format=esm --outfile=./dist/xxx.esm.min.js && esbuild ./index.js --bundle --minify --external:buffer --format=cjs --outfile=./dist/xxx.cjs.min.js"
    },
    "author": "作者名字",
    "license": "MIT",
    "dependencies": {
        "esbuild": "^0.17.15"
    }
}
```

**插件包目录结构**：

```
simple-mind-map-plugin-xxx/
├── dist/
│   ├── xxx.esm.min.js
│   └── xxx.cjs.min.js
├── index.js
└── package.json
```

---

## 三者详细对比

### 1. 插件定义方式

| 特性         | jsMind      | Mind-Elixir-Core | Simple-Mind-Map |
| ------------ | ----------- | ---------------- | --------------- |
| **形式**     | 类（Class） | 函数（Function） | 类（Class）     |
| **状态管理** | 实例属性    | 闭包变量         | 实例属性        |
| **方法定义** | 类方法      | 闭包函数         | 类方法          |
| **清理机制** | 无          | 返回清理函数     | 生命周期钩子    |

**示例对比**：

```javascript
// jsMind: 类
class MultilineText {
    constructor(jm, options) {
        this.jm = jm;
        this.editing_node = null;  // 实例属性
    }

    init() {
        // 初始化逻辑
    }

    edit_node_begin(node) {
        // 方法
    }
}

// Mind-Elixir-Core: 函数
function nodeDraggable(mind) {
    let insertType = null;  // 闭包变量

    const handleDragStart = (e) => {
        // 闭包函数
    };

    const off = on([...]);
    return off;  // 返回清理函数
}

// Simple-Mind-Map: 类 + 静态属性
class YourPlugin {
    constructor({ mindMap }) {
        this.mindMap = mindMap;
        this.state = null;  // 实例属性
    }

    someMethod() {
        // 类方法
    }

    beforePluginRemove() {
        // 生命周期钩子
    }
}
YourPlugin.instanceName = 'yourPlugin';
```

### 2. 插件注册方式

| 特性           | jsMind              | Mind-Elixir-Core |
| -------------- | ------------------- | ---------------- |
| **注册方式**   | `register_plugin()` | 直接导入         |
| **动态注册**   | ✅ 支持             | ❌ 不支持        |
| **第三方插件** | ✅ 支持             | ❌ 不支持        |

**示例对比**：

```javascript
// jsMind: 注册机制
const plugin = new jsMind.plugin('name', fn);
jsMind.register_plugin(plugin);

// Mind-Elixir-Core: 直接导入
import nodeDraggable from './plugin/nodeDraggable';
// 在 init() 中直接调用
this.draggable && this.disposable.push(nodeDraggable(this));
```

### 3. 初始化时机

| 特性             | jsMind             | Mind-Elixir-Core    |
| ---------------- | ------------------ | ------------------- |
| **时机**         | 异步（setTimeout） | 同步（init 方法内） |
| **顺序**         | 渲染后             | 渲染前              |
| **影响初始渲染** | ❌ 不能            | ✅ 可以             |

**时序对比**：

```
jsMind:
1. 实例创建
2. show() → 数据加载 → 布局 → 渲染
3. setTimeout → 插件初始化
4. 插件需要重新渲染才能生效

Mind-Elixir-Core:
1. 实例创建
2. init() → 数据加载 → 插件初始化 → 布局 → 渲染
3. 插件直接影响初始渲染
```

### 4. 生命周期管理

| 特性             | jsMind | Mind-Elixir-Core |
| ---------------- | ------ | ---------------- |
| **清理机制**     | 无     | disposable 数组  |
| **资源管理**     | 手动   | 自动             |
| **内存泄漏风险** | 高     | 低               |

**示例对比**：

```javascript
// jsMind: 无统一清理机制
// 插件需要自己管理资源清理

// Mind-Elixir-Core: 统一清理机制
this.disposable.push(nodeDraggable(this));
// 在 destroy() 中自动调用所有清理函数
this.disposable.forEach(fn => fn());
```

### 5. 配置方式

| 特性         | jsMind       | Mind-Elixir-Core |
| ------------ | ------------ | ---------------- |
| **配置位置** | plugin 对象  | Options 根级     |
| **配置类型** | 对象         | 布尔值或对象     |
| **启用控制** | 通过配置对象 | 通过布尔值       |

**示例对比**：

```javascript
// jsMind
new jsMind({
    plugin: {
        multiline_text: {
            text_width: 200,
        },
    },
});

// Mind-Elixir-Core
new MindElixir({
    draggable: true,
    contextMenu: {
        // 配置项
    },
});
```

---

## 优劣势分析

### jsMind 插件机制

#### 优势

1. **第三方插件支持** ✅

    - 通过 `register_plugin()` 可以动态注册第三方插件
    - 插件可以独立开发和分发
    - 支持插件生态系统

2. **插件隔离** ✅

    - 每个插件是独立的类实例
    - 插件之间不会相互影响
    - 命名空间清晰（挂载到 jsMind 实例上）

3. **灵活性** ✅
    - 可以在运行时动态加载插件
    - 可以根据需要启用/禁用插件
    - 插件可以访问 jsMind 的所有 API

#### 劣势

1. **异步初始化问题** ❌

    - 插件在渲染后才初始化
    - 无法直接影响初始渲染
    - 需要重新渲染才能生效（性能开销）

2. **无生命周期管理** ❌

    - 没有统一的清理机制
    - 容易造成内存泄漏
    - 插件需要自己管理资源

3. **模块作用域问题** ❌
    - UMD 模块的作用域隔离
    - 插件无法直接访问内部类（如 ViewProvider）
    - 需要通过实例的 `constructor` 获取类

### Mind-Elixir-Core 插件机制

#### 优势

1. **同步初始化** ✅

    - 插件在渲染前初始化
    - 可以直接影响初始渲染
    - 无异步延迟

2. **统一生命周期管理** ✅

    - 通过 `disposable` 数组统一管理
    - 自动清理资源
    - 避免内存泄漏

3. **简洁性** ✅

    - 函数式设计，简单直观
    - 无需注册，直接导入
    - 无需类，避免复杂性

4. **类型安全** ✅
    - TypeScript 提供完整的类型检查
    - 编译时发现错误
    - IDE 智能提示

#### 劣势

1. **不支持第三方插件** ❌

    - 所有插件都是内置的
    - 无法动态添加第三方插件
    - 需要修改源码才能添加新插件

2. **编译时确定** ❌

    - 插件在编译时就确定了
    - 无法运行时动态加载
    - 不利于插件生态系统

3. **缺乏隔离** ❌
    - 插件可以直接修改实例的任何属性
    - 插件之间可能存在命名冲突
    - 缺乏命名空间

---

## 实践建议

### 选择 jsMind 插件机制的场景

1. **需要支持第三方插件**

    - 开源项目，希望社区贡献插件
    - 需要插件生态系统
    - 需要动态加载插件

2. **需要插件隔离**

    - 多个插件可能存在命名冲突
    - 需要独立开发和测试插件
    - 需要插件版本管理

3. **需要运行时控制**
    - 需要根据用户配置动态启用/禁用插件
    - 需要在运行时加载插件
    - 需要插件热更新

### 选择 Mind-Elixir-Core 插件机制的场景

1. **内置插件为主**

    - 所有插件都是内置的
    - 不需要第三方插件支持
    - 追求简洁性和性能

2. **需要严格控制插件质量**

    - 所有插件都经过严格测试
    - 需要统一的代码风格
    - 需要类型安全

3. **需要同步初始化**
    - 插件需要影响初始渲染
    - 不能接受异步延迟
    - 需要最佳性能

### 混合方案

对于 jsMind 的多行文本插件，我们采用了混合方案：

1. **配置式插件**（类似 Mind-Elixir-Core）

    - 通过 `custom_node_render` 配置项扩展功能
    - 避免异步初始化的时序问题

2. **重新渲染**

    - 插件初始化后重新渲染所有节点
    - 确保插件生效

3. **批量更新**
    - 避免多次触发重排重绘
    - 提升性能

**代码示例**：

```javascript
// 配置式插件
init() {
    const view = this.jm.view;

    // 创建支持多行的 custom_node_render
    const multilineRender = createMultilineNodeRender(view.opts.custom_node_render);

    // 更新配置
    view.opts.custom_node_render = multilineRender;
    view.render_node = view._custom_node_render;

    // 重新渲染所有节点
    this._rerender_all_nodes();
}
```

---

## 总结

| 特性             | jsMind    | Mind-Elixir-Core | 推荐场景                       |
| ---------------- | --------- | ---------------- | ------------------------------ |
| **设计模式**     | 类 + 注册 | 函数式           | 根据项目需求                   |
| **第三方插件**   | ✅        | ❌               | 需要插件生态选 jsMind          |
| **初始化时机**   | 异步      | 同步             | 需要影响初始渲染选 Mind-Elixir |
| **生命周期管理** | ❌        | ✅               | 需要资源管理选 Mind-Elixir     |
| **简洁性**       | 中        | 高               | 追求简洁选 Mind-Elixir         |
| **灵活性**       | 高        | 中               | 需要灵活性选 jsMind            |

**最终建议**：

-   如果需要支持第三方插件和插件生态系统，选择 **jsMind** 的插件机制
-   如果追求简洁性、性能和类型安全，选择 **Mind-Elixir-Core** 的插件机制
-   如果需要两者的优点，可以采用**混合方案**（配置式插件 + 重新渲染）
