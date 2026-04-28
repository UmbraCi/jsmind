# Multi-Select Plugin

## Usage

```javascript
import jsMind from './jsmind.js';
import { MultiSelectPlugin } from './plugins/jsmind.multi-select.js';

jsMind.usePlugin(MultiSelectPlugin, {
    enable_multi_select: true,
    enable_ctrl_key_node_selection: true,
    enable_box_selection: true,
    use_left_key_selection_right_key_drag: false,
});

const jm = new jsMind({
    container: 'jsmind_container',
    editable: true,
});

jm.multiSelect.get_selected_nodes();
jm.multiSelect.toggle_node_selection('node-id');
jm.multiSelect.select_clear();
```

## Default Interactions

- `Ctrl/Cmd + Click`: toggle node selection
- Click node: single selection
- Click blank area: clear selection
- `Ctrl/Cmd + Right-Drag` blank area: box selection

Set `use_left_key_selection_right_key_drag: true` to use left-drag box selection.
