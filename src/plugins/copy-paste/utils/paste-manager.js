/**
 * @license BSD-3-Clause
 * @copyright 2014-2025 hizzgdev@163.com
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */

import { logger } from '../../../jsmind.common.js';
import { util } from '../../../jsmind.util.js';

/**
 * 粘贴管理器类
 * 处理节点粘贴逻辑和数据后处理
 */
export class PasteManager {
    constructor(jsMind, options = {}) {
        this.jsMind = jsMind;
        this.options = {
            // 粘贴位置策略
            position: 'last_child', // 'last_child', 'first_child', 'after', 'before'
            // 是否保持原始方向
            keepDirection: false,
            // 是否允许粘贴到根节点
            allowRootPaste: false,
            // 是否验证粘贴数据
            validateData: true,
            // 是否清理粘贴数据
            cleanupData: true,
            // 最大粘贴深度
            maxDepth: 50,
            // 最大粘贴节点数
            maxNodes: 500,
            // 是否触发节点编辑
            enableEdit: false,
            // 是否选中粘贴的节点
            selectPasted: true,
            // 是否处理ID冲突
            resolveIdConflicts: true,
            // ID前缀
            idPrefix: 'pasted_',
            ...options
        };

        this.logger = logger;
        this.pasteOperations = [];
        this.pastedNodes = new Map();
    }

    /**
     * 粘贴节点
     * @param {Object} targetNode - 目标节点
     * @param {Object} clipboardData - 剪贴板数据
     * @param {Object} options - 粘贴选项
     * @returns {Object} 粘贴结果
     */
    pasteNodes(targetNode, clipboardData, options = {}) {
        try {
            const pasteOptions = {
                ...this.options,
                ...options
            };

            // 验证目标节点
            const targetValidation = this.validateTargetNode(targetNode, pasteOptions);
            if (!targetValidation.valid) {
                return {
                    success: false,
                    error: targetValidation.error,
                    data: null
                };
            }

            // 验证剪贴板数据
            if (pasteOptions.validateData) {
                const dataValidation = this.validateClipboardData(clipboardData, pasteOptions);
                if (!dataValidation.valid) {
                    return {
                        success: false,
                        error: dataValidation.error,
                        data: null
                    };
                }
            }

            // 记录粘贴操作
            const operationId = this.startPasteOperation(targetNode, clipboardData);

            // 执行粘贴
            const result = this.performPaste(targetNode, clipboardData, pasteOptions);

            // 完成粘贴操作
            this.finishPasteOperation(operationId, result);

            this.logger.info('Paste operation completed', {
                targetNode: targetNode.id,
                operationId: operationId,
                success: result.success
            });

            return result;
        } catch (error) {
            this.logger.error('Paste operation failed:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 验证目标节点
     * @param {Object} targetNode - 目标节点
     * @param {Object} options - 验证选项
     * @returns {Object} 验证结果
     */
    validateTargetNode(targetNode, options) {
        if (!targetNode) {
            return {
                valid: false,
                error: '目标节点无效'
            };
        }

        if (!targetNode.id) {
            return {
                valid: false,
                error: '目标节点缺少ID'
            };
        }

        // 检查是否允许粘贴到根节点
        if (!options.allowRootPaste && targetNode.isroot) {
            return {
                valid: false,
                error: '不允许粘贴到根节点'
            };
        }

        return {
            valid: true,
            error: null
        };
    }

    /**
     * 验证剪贴板数据
     * @param {Object} clipboardData - 剪贴板数据
     * @param {Object} options - 验证选项
     * @returns {Object} 验证结果
     */
    validateClipboardData(clipboardData, options) {
        if (!clipboardData) {
            return {
                valid: false,
                error: '剪贴板数据为空'
            };
        }

        // 检查数据结构
        if (!clipboardData.id || !clipboardData.topic) {
            return {
                valid: false,
                error: '剪贴板数据格式不正确'
            };
        }

        // 检查节点数量限制
        const totalNodes = this.countTotalNodes(clipboardData);
        if (totalNodes > options.maxNodes) {
            return {
                valid: false,
                error: `粘贴节点数量超过限制 (${options.maxNodes})`
            };
        }

        // 检查节点深度限制
        const maxDepth = this.getNodeDepth(clipboardData);
        if (maxDepth > options.maxDepth) {
            return {
                valid: false,
                error: `粘贴节点深度超过限制 (${options.maxDepth})`
            };
        }

        return {
            valid: true,
            error: null
        };
    }

    /**
     * 执行粘贴
     * @param {Object} targetNode - 目标节点
     * @param {Object} clipboardData - 剪贴板数据
     * @param {Object} options - 粘贴选项
     * @returns {Object} 粘贴结果
     */
    performPaste(targetNode, clipboardData, options) {
        try {
            // 准备粘贴数据
            const preparedData = this.preparePasteData(clipboardData, options);

            // 执行实际的粘贴操作
            const createdNodes = this.createNodes(targetNode, preparedData, options);

            // 后处理
            this.postProcessNodes(createdNodes, options);

            return {
                success: true,
                error: null,
                data: {
                    createdNodes: createdNodes,
                    nodeCount: createdNodes.length,
                    targetNode: targetNode.id,
                    timestamp: Date.now()
                }
            };
        } catch (error) {
            this.logger.error('Perform paste failed:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 准备粘贴数据
     * @param {Object} clipboardData - 剪贴板数据
     * @param {Object} options - 准备选项
     * @returns {Object} 准备好的数据
     */
    preparePasteData(clipboardData, options) {
        let preparedData = JSON.parse(JSON.stringify(clipboardData)); // 深拷贝

        // 处理ID冲突
        if (options.resolveIdConflicts) {
            preparedData = this.resolveNodeIdConflicts(preparedData, options);
        }

        // 清理数据
        if (options.cleanupData) {
            preparedData = this.cleanupPasteData(preparedData);
        }

        // 调整方向
        if (!options.keepDirection) {
            preparedData = this.adjustNodeDirection(preparedData);
        }

        // 移除复制元数据
        preparedData = this.removeCopyMetadata(preparedData);

        return preparedData;
    }

    /**
     * 解决节点ID冲突
     * @param {Object} nodeData - 节点数据
     * @param {Object} options - 解决选项
     * @returns {Object} 处理后的数据
     */
    resolveNodeIdConflicts(nodeData, options) {
        const resolveConflicts = (node) => {
            const resolvedNode = { ...node };

            // 生成新的节点ID
            if (this.jsMind.get_node(node.id)) {
                resolvedNode.id = this.generateNewNodeId(node.id);
            }

            // 递归处理子节点
            if (node.children && node.children.length > 0) {
                resolvedNode.children = node.children.map(child => resolveConflicts(child));
            }

            return resolvedNode;
        };

        return resolveConflicts(nodeData);
    }

    /**
     * 清理粘贴数据
     * @param {Object} nodeData - 节点数据
     * @returns {Object} 清理后的数据
     */
    cleanupPasteData(nodeData) {
        const cleanupNode = (node) => {
            const cleanedNode = { ...node };

            // 确保主题不为空
            if (!cleanedNode.topic || cleanedNode.topic.trim() === '') {
                cleanedNode.topic = '新节点';
            }

            // 清理数据字段
            if (cleanedNode.data) {
                const cleanedData = { ...cleanedNode.data };
                // 移除可能的临时字段
                delete cleanedData._copyMetadata;
                delete cleanedData._temporaryData;

                // 移除空值字段
                for (const [key, value] of Object.entries(cleanedData)) {
                    if (value === null || value === undefined || value === '') {
                        delete cleanedData[key];
                    }
                }

                cleanedNode.data = cleanedData;
            } else {
                cleanedNode.data = {};
            }

            // 递归清理子节点
            if (cleanedNode.children && cleanedNode.children.length > 0) {
                cleanedNode.children = cleanedNode.children.map(child => cleanupNode(child));
            }

            return cleanedNode;
        };

        return cleanupNode(nodeData);
    }

    /**
     * 调整节点方向
     * @param {Object} nodeData - 节点数据
     * @returns {Object} 调整后的数据
     */
    adjustNodeDirection(nodeData) {
        const adjustDirection = (node) => {
            const adjustedNode = { ...node };

            // 移除方向信息，让jsMind自动计算
            delete adjustedNode.direction;

            // 递归调整子节点
            if (adjustedNode.children && adjustedNode.children.length > 0) {
                adjustedNode.children = adjustedNode.children.map(child => adjustDirection(child));
            }

            return adjustedNode;
        };

        return adjustDirection(nodeData);
    }

    /**
     * 移除复制元数据
     * @param {Object} nodeData - 节点数据
     * @returns {Object} 处理后的数据
     */
    removeCopyMetadata(nodeData) {
        const removeMetadata = (node) => {
            const cleanedNode = { ...node };

            if (cleanedNode.data && cleanedNode.data._copyMetadata) {
                const { _copyMetadata, ...restData } = cleanedNode.data;
                cleanedNode.data = restData;
            }

            // 递归处理子节点
            if (cleanedNode.children && cleanedNode.children.length > 0) {
                cleanedNode.children = cleanedNode.children.map(child => removeMetadata(child));
            }

            return cleanedNode;
        };

        return removeMetadata(nodeData);
    }

    /**
     * 创建节点
     * @param {Object} targetNode - 目标节点
     * @param {Object} nodeData - 节点数据
     * @param {Object} options - 创建选项
     * @returns {Array} 创建的节点数组
     */
    createNodes(targetNode, nodeData, options) {
        const createdNodes = [];

        const createNodeRecursive = (data, parent) => {
            try {
                // 确定节点方向
                let direction = null;
                if (options.keepDirection && data.direction !== undefined) {
                    direction = data.direction;
                }

                // 创建节点
                const newNode = this.jsMind.add_node(
                    parent,
                    direction,
                    data.topic,
                    data.data || {}
                );

                if (newNode) {
                    createdNodes.push(newNode);

                    // 记录粘贴关系
                    this.pastedNodes.set(newNode.id, {
                        originalId: data.id,
                        pastedData: data
                    });

                    // 递归创建子节点
                    if (data.children && data.children.length > 0) {
                        data.children.forEach(childData => {
                            createNodeRecursive(childData, newNode);
                        });
                    }

                    // 设置节点属性
                    if (data.expanded !== undefined) {
                        if (data.expanded) {
                            this.jsMind.expand_node(newNode);
                        } else {
                            this.jsMind.collapse_node(newNode);
                        }
                    }
                }

                return newNode;
            } catch (error) {
                this.logger.error('Failed to create node:', error);
                return null;
            }
        };

        // 检查是否是虚拟根节点（多节点复制的情况）
        if (nodeData.data && nodeData.data.copyOperation) {
            // 处理多个节点
            if (nodeData.children && nodeData.children.length > 0) {
                nodeData.children.forEach(childData => {
                    // 根据位置策略调整粘贴位置
                    const adjustedChild = this.adjustForPosition(childData, targetNode, options);
                    createNodeRecursive(adjustedChild, targetNode);
                });
            }
        } else {
            // 处理单个节点
            const adjustedData = this.adjustForPosition(nodeData, targetNode, options);
            createNodeRecursive(adjustedData, targetNode);
        }

        return createdNodes;
    }

    /**
     * 根据位置策略调整数据
     * @param {Object} nodeData - 节点数据
     * @param {Object} targetNode - 目标节点
     * @param {Object} options - 选项
     * @returns {Object} 调整后的数据
     */
    adjustForPosition(nodeData, targetNode, options) {
        // 这里可以根据不同的位置策略进行调整
        // 目前jsMind的add_node API会自动处理位置，所以暂时返回原数据
        return nodeData;
    }

    /**
     * 后处理节点
     * @param {Array} createdNodes - 创建的节点数组
     * @param {Object} options - 后处理选项
     */
    postProcessNodes(createdNodes, options) {
        // 选中粘贴的节点
        if (options.selectPasted && createdNodes.length > 0) {
            this.jsMind.select_node(createdNodes[0]);
        }

        // 启用编辑
        if (options.enableEdit && createdNodes.length === 1) {
            // 延迟执行编辑，确保节点已完全创建
            setTimeout(() => {
                try {
                    this.jsMind.begin_edit(createdNodes[0]);
                } catch (error) {
                    this.logger.warn('Failed to start editing:', error);
                }
            }, 100);
        }

        // 滚动到第一个创建的节点
        if (createdNodes.length > 0) {
            setTimeout(() => {
                try {
                    this.jsMind.view_node(createdNodes[0]);
                } catch (error) {
                    this.logger.warn('Failed to view node:', error);
                }
            }, 200);
        }
    }

    /**
     * 计算总节点数
     * @param {Object} nodeData - 节点数据
     * @returns {number} 总节点数
     */
    countTotalNodes(nodeData) {
        let count = 0;

        const countNode = (node) => {
            count++;
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => countNode(child));
            }
        };

        countNode(nodeData);
        return count;
    }

    /**
     * 获取节点深度
     * @param {Object} nodeData - 节点数据
     * @returns {number} 节点深度
     */
    getNodeDepth(nodeData) {
        let maxDepth = 0;

        const getDepth = (node, currentDepth = 0) => {
            maxDepth = Math.max(maxDepth, currentDepth);

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => getDepth(child, currentDepth + 1));
            }
        };

        getDepth(nodeData);
        return maxDepth;
    }

    /**
     * 生成新的节点ID
     * @param {string} originalId - 原始ID
     * @returns {string} 新ID
     */
    generateNewNodeId(originalId = '') {
        if (originalId) {
            return this.options.idPrefix + originalId + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        } else {
            return util.uuid.newid();
        }
    }

    /**
     * 开始粘贴操作
     * @param {Object} targetNode - 目标节点
     * @param {Object} clipboardData - 剪贴板数据
     * @returns {string} 操作ID
     */
    startPasteOperation(targetNode, clipboardData) {
        const operationId = 'paste_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

        this.pasteOperations.push({
            id: operationId,
            startTime: Date.now(),
            targetNode: targetNode.id,
            clipboardData: clipboardData,
            status: 'in_progress'
        });

        return operationId;
    }

    /**
     * 完成粘贴操作
     * @param {string} operationId - 操作ID
     * @param {Object} result - 粘贴结果
     */
    finishPasteOperation(operationId, result) {
        const operation = this.pasteOperations.find(op => op.id === operationId);
        if (operation) {
            operation.endTime = Date.now();
            operation.duration = operation.endTime - operation.startTime;
            operation.status = result.success ? 'completed' : 'failed';
            operation.result = result;
        }
    }

    /**
     * 获取粘贴历史
     * @returns {Array} 粘贴操作历史
     */
    getPasteHistory() {
        return [...this.pasteOperations];
    }

    /**
     * 清理粘贴历史
     */
    clearPasteHistory() {
        this.pasteOperations = [];
        this.pastedNodes.clear();
        this.logger.debug('Paste history cleared');
    }

    /**
     * 获取粘贴的节点映射
     * @returns {Map} 节点映射
     */
    getPastedNodesMap() {
        return new Map(this.pastedNodes);
    }

    /**
     * 更新配置
     * @param {Object} newOptions - 新配置
     */
    updateOptions(newOptions) {
        this.options = {
            ...this.options,
            ...newOptions
        };

        this.logger.info('PasteManager options updated');
    }

    /**
     * 获取粘贴统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            totalOperations: this.pasteOperations.length,
            completedOperations: this.pasteOperations.filter(op => op.status === 'completed').length,
            failedOperations: this.pasteOperations.filter(op => op.status === 'failed').length,
            pastedNodesCount: this.pastedNodes.size,
            averageDuration: this.calculateAverageDuration()
        };
    }

    /**
     * 计算平均操作时间
     * @returns {number} 平均时间（毫秒）
     */
    calculateAverageDuration() {
        const completedOperations = this.pasteOperations.filter(op => op.duration);
        if (completedOperations.length === 0) {
            return 0;
        }

        const totalDuration = completedOperations.reduce((sum, op) => sum + op.duration, 0);
        return Math.round(totalDuration / completedOperations.length);
    }
}