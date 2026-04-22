# UPSTREAM_SYNC

> 用途：记录每次上游同步窗口、引入范围、冲突处理与回归结论，降低长期 fork 维护风险。
>
>
> 1. **upstream-master**：只镜像上游 **origin/master**，禁止直接开发。
> 2. **fork-main**：你的稳定发布线（当前 scoped 包 **latest** 来源）。
> 3. **fork-next**：你的重大重构线（可能不被上游接受，走 **next** 渠道）。
> 4. **feat-***：短生命周期功能分支，合并到 **fork-main** 或 **fork-next**。

## 1. 同步节奏建议

- 常规：每 2~4 周同步一次
- 触发式：上游出现安全修复/关键 bug 时立即同步

## 2. 单次同步执行步骤（模板）

1. 更新远端引用：`git fetch origin --prune && git fetch fork --prune`
2. 更新镜像线：在 `upstream-master` 快进到 `origin/master`
3. 切到集成分支：`fork-main`
4. 执行合并：`git merge upstream-master`（或按需 cherry-pick）
5. 解决冲突并补测试
6. 记录结果到本文件

## 3. 同步记录

---

### Sync #<编号> - `<YYYY-MM-DD>`

#### 基本信息

- 执行人：
- 来源分支：`upstream-master`（对应 `origin/master` 的 commit: `<hash>`）
- 目标分支：`fork-main`
- 同步方式：`merge | cherry-pick`

#### 引入内容（摘要）

- 新增：
- 修复：
- 重构：
- 安全相关：

#### 冲突与处理

- 冲突文件：
- 处理策略：
- 为什么这样处理：

#### 回归验证

- 测试范围：
- 结果：
- 风险点：

#### 后续动作

- [ ] 是否回传上游（PR）
- [ ] 是否需要同步到 `fork-next`
- [ ] 是否需要发布 npm 包

---

## 4. 例外策略（模板）

### 明确不引入的上游改动

- 改动/PR：
- 不引入原因：
- 替代方案：
- 复评时间：

### 临时保留的 fork-only 补丁

- 补丁标识：
- 背景：
- 移除条件：
