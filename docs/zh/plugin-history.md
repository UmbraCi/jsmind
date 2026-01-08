[目录](index.md)

* [基本用法](1.usage.md)
* [选项](2.options.md)
* [界面操控](3.operation.md)
* [实验性功能 *](experimental-features.md)
  * [截图 (导出图片)](plugin-screenshot.md)
  * [历史记录 (撤销/重做) *](plugin-history.md)
* [参与贡献](4.contribution.md)
* [贡献代码指南](5.development.md)

历史记录 (撤销/重做) <sup>[实验性](experimental-features.md)</sup>
===

> 强烈建议你先阅读 [实验性功能](experimental-features.md), 充分了解风险后再使用此功能。

此功能提供了完整的撤销/重做功能，支持历史记录管理和快照对比。

## 基本用法

```html
<!-- style -->
<link type="text/css" rel="stylesheet" href="https://unpkg.com/@umbraci/jsmind/style/jsmind.css" />

<!-- jsMind -->
<script type="text/javascript" src="https://unpkg.com/@umbraci/jsmind/es/jsmind.js"></script>

<!-- history plugin -->
<script type="text/javascript" src="https://unpkg.com/@umbraci/jsmind/es/jsmind.history.js"></script>

<script>
    var options = {
        container: 'jsmind_container',
        editable: true,
        theme: 'primary',
        plugins: [
            {
                name: 'history',
                options: {
                    enabled: true,
                    maxHistory: 500,
                    throttleMs: 100
                }
            }
        ]
    };
    
    var jm = new jsMind(options);
    jm.show(mind_data);
    
    // 撤销
    jm.history.back();
    
    // 重做
    jm.history.forward();
    
    // 检查是否可以撤销/重做
    if (jm.history.canBack()) {
        jm.history.back();
    }
    
    if (jm.history.canForward()) {
        jm.history.forward();
    }
</script>
```

## NPM 使用

如果使用 npm，则需要安装 jsmind

```bash
npm install @umbraci/jsmind
```

然后在页面里使用

```javascript
import jsMind from '@umbraci/jsmind';
import '@umbraci/jsmind/history';
import '@umbraci/jsmind/style/jsmind.css';

const options = {
    container: 'jsmind_container',
    editable: true,
    theme: 'primary',
    plugins: [
        {
            name: 'history',
            options: {
                enabled: true,
                maxHistory: 500,
                throttleMs: 100
            }
        }
    ]
};

const jm = new jsMind(options);
jm.show(mind_data);

// 使用历史记录功能
jm.history.back();
jm.history.forward();
```

## 配置选项

### enabled
- 类型: `boolean`
- 默认值: `true`
- 说明: 是否启用历史记录功能

### maxHistory
- 类型: `number`
- 默认值: `500`
- 说明: 最大历史记录数量，超过此数量会自动删除最早的记录

### throttleMs
- 类型: `number`
- 默认值: `100`
- 说明: 节流时间（毫秒），在此时间内的多次操作会被合并为一次历史记录

### storageMode
- 类型: `'object' | 'string'`
- 默认值: `'object'`
- 说明: 快照存储模式
  - `'object'`: 存储为对象（更快，但占用更多内存）
  - `'string'`: 存储为 JSON 字符串（更省内存，但稍慢）

### autoSwitchThreshold
- 类型: `number`
- 默认值: `0`
- 说明: 自动切换存储模式的阈值（节点数量）
  - `0`: 禁用自动切换
  - `> 0`: 当节点数量超过此值时，自动切换到 `'string'` 模式

### keymap
- 类型: `{ enabled: boolean, redoUsesY: boolean }`
- 默认值: `{ enabled: false, redoUsesY: false }`
- 说明: 键盘快捷键配置
  - `enabled`: 是否启用快捷键
  - `redoUsesY`: 重做是否使用 Ctrl+Y（默认使用 Ctrl+Shift+Z）

### diff
- 类型: `{ flat: boolean, fields?: string[], maxSize: number }`
- 默认值: `{ flat: true, fields: undefined, maxSize: 5000 }`
- 说明: 快照对比配置
  - `flat`: 是否使用扁平化对比
  - `fields`: 要对比的字段列表（默认为 `['topic', 'data', 'id']`）
  - `maxSize`: 最大对比结果数量

## API 方法

### 控制与栈管理

#### add(reason?, meta?)
手动添加一个历史记录快照
- `reason`: 可选，添加原因
- `meta`: 可选，元数据

```javascript
jm.history.add('manual', { user: 'admin' });
```

#### pause()
暂停历史记录

```javascript
jm.history.pause();
// 执行一些不需要记录的操作
jm.history.resume();
```

#### resume(flush?)
恢复历史记录
- `flush`: 可选，是否立即刷新待处理的记录

```javascript
jm.history.resume(true);
```

#### clear()
清空所有历史记录

```javascript
jm.history.clear();
```

### 导航

#### canBack()
检查是否可以撤销

```javascript
if (jm.history.canBack()) {
    jm.history.back();
}
```

#### canForward()
检查是否可以重做

```javascript
if (jm.history.canForward()) {
    jm.history.forward();
}
```

#### back(steps?)
撤销操作
- `steps`: 可选，撤销步数（默认为 1）

```javascript
jm.history.back();     // 撤销 1 步
jm.history.back(3);    // 撤销 3 步
```

#### forward(steps?)
重做操作
- `steps`: 可选，重做步数（默认为 1）

```javascript
jm.history.forward();  // 重做 1 步
jm.history.forward(3); // 重做 3 步
```

### 信息与配置

#### length()
获取历史记录总数

```javascript
const total = jm.history.length();
console.log(`共有 ${total} 条历史记录`);
```

#### index()
获取当前历史记录索引

```javascript
const current = jm.history.index();
console.log(`当前在第 ${current + 1} 条记录`);
```

#### setMax(count)
设置最大历史记录数量

```javascript
jm.history.setMax(1000);
```

#### setThrottle(ms)
设置节流时间

```javascript
jm.history.setThrottle(200);
```

### 快照管理

#### exportSnapshot()
导出当前快照

```javascript
const snapshot = jm.history.exportSnapshot();
console.log(snapshot);
```

#### importSnapshot(data, opts?)
导入快照
- `data`: 快照数据
- `opts`: 可选，导入选项

```javascript
jm.history.importSnapshot(snapshot);
```

#### getStack()
获取历史记录栈信息

```javascript
const stack = jm.history.getStack();
console.log('历史记录:', stack.items);
console.log('当前索引:', stack.index);
```

### 快照对比

#### diff(snapshotA, snapshotB, options?)
对比两个快照，返回差异信息

**参数:**
- `snapshotA`: 第一个快照(变化前)
- `snapshotB`: 第二个快照(变化后)
- `options`: 可选配置
  - `fields`: 要对比的字段数组(默认 `['topic', 'data', 'id']`)
  - `includeStructure`: 是否包含结构信息(默认 `true`)
  - `maxSize`: 最大结果数量(默认 `5000`)

**返回值:**
```typescript
{
    created: Array,              // 新增的节点
    deleted: Array,              // 删除的节点
    truncated: boolean,          // 是否被截断
    moved: Array,                // 仅移动的节点
    modified: Array,             // 仅修改的节点
    movedAndModified: Array      // 既移动又修改的节点
}
```

**示例:**

```javascript
// 基本用法
const snapshot1 = jm.history.exportSnapshot();
// ... 进行一些修改 ...
const snapshot2 = jm.history.exportSnapshot();

const diff = jm.history.diff(snapshot1, snapshot2);
console.log('新增节点:', diff.created);
console.log('移动节点:', diff.moved);
console.log('修改节点:', diff.modified);
console.log('删除节点:', diff.deleted);

// 自定义对比字段
const diffCustom = jm.history.diff(snapshot1, snapshot2, { 
    fields: ['id', 'topic']  // 只对比 id 和 topic
});
```

版权声明
===

禁止转载、禁止演绎。

jsMind 项目仍在不断升级变化,版本更新时会同时更新对应的文档。为避免给使用者带来困惑,在没有得到书面许可前,禁止转载本文档,同时禁止对本文档进行任何形式的更改。

