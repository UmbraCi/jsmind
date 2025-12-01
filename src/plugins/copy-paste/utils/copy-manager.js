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
 * 复制管理器类
 * 处理节点复制逻辑和数据预处理
 */
export class CopyManager {
    constructor(jsMind, options = {}) {
        this.jsMind = jsMind;
        this.options = {
            // 是否复制子节点
            includeChildren: true,
            // 是否复制节点样式
            includeStyles: true,
            // 是否复制节点数据
            includeData: true,
            // 最大复制深度
            maxDepth: 100,
            // 最大复制节点数
            maxNodes: 1000,
            // 是否处理ID冲突
            resolveIdConflicts: true,
            // ID前缀
            idPrefix: 'copied_',
            // 过滤空节点
            filterEmptyNodes: true,
            // 是否保留原始方向
            keepDirection: true,
            ...options
        };

        this.logger = logger;
        this.copiedNodes = new Map();
        this.copyOperations = [];
    }

    /**
     * 复制节点
     * @param {Array|Object} nodes - 要复制的节点
     * @param {Object} options - 复制选项
     * @returns {Object} 复制结果
     */
    copyNodes(nodes, options = {}) {
        try {
            const copyOptions = {
                ...this.options,
                ...options
            };

            // 标准化输入
            const nodeList = Array.isArray(nodes) ? nodes : [nodes];

            // 验证节点
            const validationResult = this.validateNodes(nodeList, copyOptions);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: validationResult.error,
                    data: null
                };
            }

            // 记录复制操作
            const operationId = this.startCopyOperation(nodeList);

            // 执行复制
            const result = this.performCopy(nodeList, copyOptions);

            // 完成复制操作
            this.finishCopyOperation(operationId, result);

            this.logger.info('Copy operation completed', {
                nodeCount: nodeList.length,
                operationId: operationId,
                success: result.success
            });

            return result;
        } catch (error) {
            this.logger.error('Copy operation failed:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 验证节点
     * @param {Array} nodes - 节点列表
     * @param {Object} options - 验证选项
     * @returns {Object} 验证结果
     */
    validateNodes(nodes, options) {
        // 检查节点数量
        if (nodes.length === 0) {
            return {
                valid: false,
                error: '没有选择要复制的节点'
            };
        }

        // 检查最大节点数限制
        const totalNodes = this.countTotalNodes(nodes);
        if (totalNodes > options.maxNodes) {
            return {
                valid: false,
                error: `复制节点数量超过限制 (${options.maxNodes})`
            };
        }

        // 检查节点深度
        const maxDepth = this.getMaxNodeDepth(nodes);
        if (maxDepth > options.maxDepth) {
            return {
                valid: false,
                error: `节点深度超过限制 (${options.maxDepth})`
            };
        }

        // 检查节点是否有效
        for (const node of nodes) {
            if (!node || !node.id) {
                return {
                    valid: false,
                    error: '包含无效节点'
                };
            }
        }

        return {
            valid: true,
            error: null
        };
    }

    /**
     * 执行复制
     * @param {Array} nodes - 节点列表
     * @param {Object} options - 复制选项
     * @returns {Object} 复制结果
     */
    performCopy(nodes, options) {
        try {
            let copiedData;

            if (nodes.length === 1) {
                // 单节点复制
                copiedData = this.copySingleNode(nodes[0], options);
            } else {
                // 多节点复制
                copiedData = this.copyMultipleNodes(nodes, options);
            }

            // 后处理复制的数据
            const processedData = this.postProcessData(copiedData, options);

            return {
                success: true,
                error: null,
                data: {
                    copiedData: processedData,
                    originalNodes: nodes.map(node => node.id),
                    nodeCount: nodes.length,
                    totalNodes: this.countTotalNodes(nodes),
                    timestamp: Date.now()
                }
            };
        } catch (error) {
            this.logger.error('Perform copy failed:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 复制单个节点
     * @param {Object} node - 节点对象
     * @param {Object} options - 复制选项
     * @returns {Object} 复制的节点数据
     */
    copySingleNode(node, options) {
        const copiedNode = {
            id: options.resolveIdConflicts ? this.generateNodeId(node.id) : node.id,
            topic: node.topic || '',
            data: options.includeData ? { ...node.data } : {}
        };

        // 复制样式
        if (options.includeStyles && node.style) {
            copiedNode.style = { ...node.style };
        }

        // 复制方向
        if (options.keepDirection && node.direction !== undefined) {
            copiedNode.direction = node.direction;
        }

        // 复制展开状态
        if (node.expanded !== undefined) {
            copiedNode.expanded = node.expanded;
        }

        // 复制子节点
        if (options.includeChildren && node.children && node.children.length > 0) {
            copiedNode.children = node.children.map(child =>
                this.copySingleNode(child, options)
            );
        }

        // 记录复制关系
        this.copiedNodes.set(copiedNode.id, {
            originalId: node.id,
            copiedData: copiedNode
        });

        return copiedNode;
    }

    /**
     * 复制多个节点
     * @param {Array} nodes - 节点列表
     * @param {Object} options - 复制选项
     * @returns {Object} 复制的节点数据
     */
    copyMultipleNodes(nodes, options) {
        // 创建虚拟根节点
        const virtualRoot = {
            id: this.generateNodeId('virtual_root'),
            topic: '复制的节点',
            data: {
                copyOperation: true,
                originalNodeCount: nodes.length,
                timestamp: Date.now()
            },
            children: []
        };

        // 复制每个节点作为虚拟根的子节点
        for (const node of nodes) {
            const copiedNode = this.copySingleNode(node, options);
            virtualRoot.children.push(copiedNode);
        }

        return virtualRoot;
    }

    /**
     * 后处理复制的数据
     * @param {Object} data - 复制的数据
     * @param {Object} options - 处理选项
     * @returns {Object} 处理后的数据
     */
    postProcessData(data, options) {
        let processedData = data;

        // 过滤空节点
        if (options.filterEmptyNodes) {
            processedData = this.filterEmptyNodes(processedData);
        }

        // 验证数据完整性
        processedData = this.validateDataIntegrity(processedData);

        // 添加复制元数据
        processedData = this.addCopyMetadata(processedData);

        return processedData;
    }

    /**
     * 过滤空节点
     * @param {Object} node - 节点数据
     * @returns {Object} 过滤后的节点数据
     */
    filterEmptyNodes(node) {
        const filterNode = (n) => {
            // 检查节点是否为空
            if (!n.topic || n.topic.trim() === '') {
                return null;
            }

            const filteredNode = { ...n };

            // 递归过滤子节点
            if (n.children && n.children.length > 0) {
                const filteredChildren = n.children
                    .map(child => filterNode(child))
                    .filter(child => child !== null);

                if (filteredChildren.length > 0) {
                    filteredNode.children = filteredChildren;
                } else {
                    delete filteredNode.children;
                }
            }

            return filteredNode;
        };

        return filterNode(node);
    }

    /**
     * 验证数据完整性
     * @param {Object} data - 数据
     * @returns {Object} 验证后的数据
     */
    validateDataIntegrity(data) {
        const validateNode = (node) => {
            const validNode = { ...node };

            // 确保有ID
            if (!validNode.id) {
                validNode.id = this.generateNodeId();
            }

            // 确保有主题
            if (!validNode.topic) {
                validNode.topic = '未命名节点';
            }

            // 确保数据对象存在
            if (!validNode.data) {
                validNode.data = {};
            }

            // 递归验证子节点
            if (validNode.children && validNode.children.length > 0) {
                validNode.children = validNode.children.map(child => validateNode(child));
            }

            return validNode;
        };

        return validateNode(data);
    }

    /**
     * 添加复制元数据
     * @param {Object} data - 数据
     * @returns {Object} 添加元数据后的数据
     */
    addCopyMetadata(data) {
        const addMetadata = (node) => {
            const nodeWithMetadata = { ...node };

            // 添加复制元数据到节点数据中
            nodeWithMetadata.data = {
                ...nodeWithMetadata.data,
                _copyMetadata: {
                    copiedAt: Date.now(),
                    copySource: 'jsmind-copy-paste-plugin',
                    originalId: this.copiedNodes.get(node.id)?.originalId || null
                }
            };

            // 递归处理子节点
            if (nodeWithMetadata.children && nodeWithMetadata.children.length > 0) {
                nodeWithMetadata.children = nodeWithMetadata.children.map(child => addMetadata(child));
            }

            return nodeWithMetadata;
        };

        return addMetadata(data);
    }

    /**
     * 计算总节点数
     * @param {Array} nodes - 节点列表
     * @returns {number} 总节点数
     */
    countTotalNodes(nodes) {
        let count = 0;

        const countNode = (node) => {
            count++;
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => countNode(child));
            }
        };

        nodes.forEach(node => countNode(node));
        return count;
    }

    /**
     * 获取最大节点深度
     * @param {Array} nodes - 节点列表
     * @returns {number} 最大深度
     */
    getMaxNodeDepth(nodes) {
        let maxDepth = 0;

        const getDepth = (node, currentDepth = 0) => {
            maxDepth = Math.max(maxDepth, currentDepth);

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => getDepth(child, currentDepth + 1));
            }
        };

        nodes.forEach(node => getDepth(node));
        return maxDepth;
    }

    /**
     * 生成新节点ID
     * @param {string} originalId - 原始ID
     * @returns {string} 新ID
     */
    generateNodeId(originalId = '') {
        if (originalId && this.options.resolveIdConflicts) {
            return this.options.idPrefix + originalId + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        } else {
            return util.uuid.newid();
        }
    }

    /**
     * 开始复制操作
     * @param {Array} nodes - 节点列表
     * @returns {string} 操作ID
     */
    startCopyOperation(nodes) {
        const operationId = 'copy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

        this.copyOperations.push({
            id: operationId,
            startTime: Date.now(),
            nodes: nodes.map(node => node.id),
            status: 'in_progress'
        });

        return operationId;
    }

    /**
     * 完成复制操作
     * @param {string} operationId - 操作ID
     * @param {Object} result - 复制结果
     */
    finishCopyOperation(operationId, result) {
        const operation = this.copyOperations.find(op => op.id === operationId);
        if (operation) {
            operation.endTime = Date.now();
            operation.duration = operation.endTime - operation.startTime;
            operation.status = result.success ? 'completed' : 'failed';
            operation.result = result;
        }
    }

    /**
     * 获取复制历史
     * @returns {Array} 复制操作历史
     */
    getCopyHistory() {
        return [...this.copyOperations];
    }

    /**
     * 清理复制历史
     */
    clearCopyHistory() {
        this.copyOperations = [];
        this.copiedNodes.clear();
        this.logger.debug('Copy history cleared');
    }

    /**
     * 获取复制的节点映射
     * @returns {Map} 节点映射
     */
    getCopiedNodesMap() {
        return new Map(this.copiedNodes);
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

        this.logger.info('CopyManager options updated');
    }

    /**
     * 获取复制统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            totalOperations: this.copyOperations.length,
            completedOperations: this.copyOperations.filter(op => op.status === 'completed').length,
            failedOperations: this.copyOperations.filter(op => op.status === 'failed').length,
            copiedNodesCount: this.copiedNodes.size,
            averageDuration: this.calculateAverageDuration()
        };
    }

    /**
     * 计算平均操作时间
     * @returns {number} 平均时间（毫秒）
     */
    calculateAverageDuration() {
        const completedOperations = this.copyOperations.filter(op => op.duration);
        if (completedOperations.length === 0) {
            return 0;
        }

        const totalDuration = completedOperations.reduce((sum, op) => sum + op.duration, 0);
        return Math.round(totalDuration / completedOperations.length);
    }
}