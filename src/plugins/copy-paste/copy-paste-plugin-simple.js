/**
 * @license BSD-3-Clause
 * @copyright 2014-2025 hizzgdev@163.com
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */

import { Plugin } from '../../jsmind.plugin.js';
import { util } from '../../jsmind.util.js';
import jsMind from '@umbraci/jsmind';

/**
 * 简化版复制粘贴插件
 */

class CopyPasteHandler {
    constructor(jm, options = {}) {
        this.jsMind = jm;
        this.options = {
            enabled: true,
            shortcuts: {
                copy: 'meta+c',
                paste: 'meta+v',
                cut: 'meta+x'
            },
            ...options
        };
        this.clipboardData = null;

        this.logger = {
            info: (msg) => console.info('[CopyPaste]', msg),
            warn: (msg) => console.warn('[CopyPaste]', msg),
            error: (msg) => console.error('[CopyPaste]', msg),
            debug: (msg) => console.debug('[CopyPaste]', msg)
        };

        this.init();
    }

    init() {
        this.logger.info('CopyPaste plugin initialized');
        return true;
    }

    handleCopy(event) {
        if (!this.options.enabled) return;

        const selectedNode = this.jsMind.get_selected_node();
        if (!selectedNode) {
            this.logger.warn('No node selected for copying');
            return;
        }

        try {
            event.preventDefault();

            // 复制节点数据
            this.clipboardData = {
                id: selectedNode.id,
                topic: selectedNode.topic,
                data: selectedNode.data || {},
                direction: selectedNode.direction,
                expanded: selectedNode.expanded,
                children: this.copyChildren(selectedNode)
            };

            this.logger.info('Node copied:', selectedNode.topic);

            // 显示成功消息
            this.showMessage('节点已复制');

        } catch (error) {
            this.logger.error('Copy failed:', error);
            this.showMessage('复制失败', 'error');
        }
    }

    handlePaste(event) {
        if (!this.options.enabled) return;
        if (!this.clipboardData) {
            this.logger.warn('No data in clipboard');
            this.showMessage('剪贴板为空，请先复制节点', 'warning');
            return;
        }

        const targetNode = this.jsMind.get_selected_node();
        if (!targetNode) {
            this.logger.warn('No target node selected for pasting');
            this.showMessage('请选择目标节点', 'warning');
            return;
        }

        try {
            event.preventDefault();

            // 准备批量数据（包含所有子节点）
            const batchData = this.prepareBatchData(this.clipboardData);

            // 使用 add_nodes 批量创建节点
            const createdNodes = this.jsMind.add_nodes(targetNode, [batchData]);

            if (createdNodes && createdNodes.length > 0) {
                this.logger.info('Nodes pasted successfully:', this.clipboardData.topic);
                this.showMessage('粘贴成功');
            }

        } catch (error) {
            this.logger.error('Paste failed:', error);
            this.showMessage('粘贴失败', 'error');
        }
    }

    handleCut(event) {
        if (!this.options.enabled) return;

        const selectedNode = this.jsMind.get_selected_node();
        if (!selectedNode) {
            this.logger.warn('No node selected for cutting');
            return;
        }

        if (selectedNode.isroot) {
            this.logger.warn('Cannot cut root node');
            this.showMessage('不能剪切根节点', 'warning');
            return;
        }

        try {
            event.preventDefault();

            // 先复制到剪贴板
            this.clipboardData = {
                id: selectedNode.id,
                topic: selectedNode.topic,
                data: selectedNode.data || {},
                direction: selectedNode.direction,
                expanded: selectedNode.expanded,
                children: this.copyChildren(selectedNode)
            };

            // 删除原节点
            const removed = this.jsMind.remove_node(selectedNode);

            if (removed) {
                this.logger.info('Node cut:', selectedNode.topic);
                this.showMessage('节点已剪切');
            }

        } catch (error) {
            this.logger.error('Cut failed:', error);
            this.showMessage('剪切失败', 'error');
        }
    }

    copyChildren(node) {
        if (!node.children || node.children.length === 0) {
            return [];
        }

        return node.children.map(child => ({
            id: child.id,
            topic: child.topic,
            data: child.data || {},
            direction: child.direction,
            expanded: child.expanded,
            children: this.copyChildren(child)
        }));
    }

    /**
     * 准备批量数据，将节点数据转换为 add_nodes 所需的格式
     * @param {Object} nodeData - 节点数据
     * @returns {Object} - 格式化后的批量数据
     */
    prepareBatchData(nodeData) {
        return {
            id: util.uuid.newid(),
            topic: nodeData.topic,
            data: nodeData.data || {},
            children: nodeData.children && nodeData.children.length > 0
                ? nodeData.children.map(child => this.prepareBatchData(child))
                : undefined
        };
    }

    pasteChildren(parentNode, children) {
        // 保留此方法以备兼容性，但新的实现不再使用递归方式
        if (!children || children.length === 0) return [];

        const batchData = children.map(child => this.prepareBatchData(child));
        return this.jsMind.add_nodes(parentNode, batchData);
    }

    showMessage(message, type = 'info') {
        // 简单的消息显示
        console.log(`[CopyPaste ${type.toUpperCase()}]: ${message}`);
    }

    clear() {
        this.clipboardData = null;
        this.logger.info('Clipboard cleared');
    }

    getStatus() {
        return {
            hasData: !!this.clipboardData,
            data: this.clipboardData
        };
    }
}

/**
 * 复制粘贴插件注册
 */
export const copy_paste_plugin = new jsMind.plugin('copy-paste', function (jm, options) {
    // 确保options存在且包含shortcuts
    var pluginOptions = options || {};
    pluginOptions.shortcuts = pluginOptions.shortcuts || {
        copy: 'meta+c',
        paste: 'meta+v',
        cut: 'meta+x'
    };

    var handler = new CopyPasteHandler(jm, pluginOptions);

    // 直接注册键盘事件监听器，而不是使用不存在的add_shortcut方法
    if (jm.view && jm.view.e_panel) {
        jm.view.e_panel.addEventListener('keydown', function(event) {
            // 检查是否按下了复制快捷键
            if ((event.metaKey || event.ctrlKey) && event.key === 'c' && !event.shiftKey && !event.altKey) {
                handler.handleCopy(event);
            }
            // 检查是否按下了粘贴快捷键
            else if ((event.metaKey || event.ctrlKey) && event.key === 'v' && !event.shiftKey && !event.altKey) {
                handler.handlePaste(event);
            }
            // 检查是否按下了剪切快捷键
            else if ((event.metaKey || event.ctrlKey) && event.key === 'x' && !event.shiftKey && !event.altKey) {
                handler.handleCut(event);
            }
        });
    }

    // 将处理器实例附加到jm对象，方便外部调用
    jm.copy_paste_handler = handler;
});

// 注册插件
jsMind.register_plugin(copy_paste_plugin);

export default CopyPasteHandler;