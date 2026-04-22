# FORK_POLICY

> 目标：在保持与上游仓库可同步的前提下，支持个人业务需求和 scoped npm 包长期发布。

## 1. 仓库角色与分支职责

### 核心分支

| 分支 | 角色 | 来源/上游 | 是否直接开发 |
| --- | --- | --- | --- |
| `upstream-master` | 上游镜像线（只读） | `origin/master` | 否 |
| `fork-master` | fork 基线（只读/低频） | `fork/master` | 否 |
| `fork-main` | 稳定发布线（`latest`） | 基于 `fork-master` 演进 | 是 |
| `fork-next` | 重构/实验线（`next`） | 基于 `fork-main` 演进 | 是 |

### 临时分支

- `feat-*`：功能开发分支，完成后合并到 `fork-main` 或 `fork-next`
- `fix-*`：修复分支，优先合并到 `fork-main`
- `chore-*`：工程化分支，按影响范围选择目标分支

## 2. 改动分类与去向

### A 类：上游已接受或可接受的改动

- 策略：优先通过同步上游引入，避免长期维护重复补丁
- 去向：`upstream-master -> fork-main`

### B 类：业务必须但上游拒绝/暂不接受

- 策略：保留为 `fork-only` 改动，最小范围实现并补测试
- 去向：`fork-main`
- 要求：commit message 建议前缀 `fork-only:`

### C 类：重大重构（预期不被上游接受）

- 策略：隔离到独立主线，避免影响稳定发布
- 去向：`fork-next`
- 要求：通过预发布版本验证后再决定是否并回 `fork-main`

## 3. npm 发布策略

### 包名与渠道

- 包名：`@umbraci/jsmind`（scoped）
- 发布渠道：
  - `fork-main` -> `latest`
  - `fork-next` -> `next`

### 版本建议

- 与上游兼容的小改动：`patch/minor`
- `fork-only` 非破坏改动：`minor`，并在 changelog 标注 `fork-only`
- 破坏性重构：`major` 或 `next` 预发布（如 `1.0.0-next.1`）

## 4. 合并与冲突处理

### 默认优先级

1. 安全修复与关键 bug
2. 与当前业务高度相关能力
3. 可降低 fork 维护成本的上游变更

### 冲突处理原则

- 不为“追上游”而牺牲业务正确性
- 冲突优先保留当前发布线行为，再评估重构
- 每次复杂冲突必须在 `UPSTREAM_SYNC.md` 记录决策依据

## 5. 工程质量门禁

- `fork-main`：严格门禁（测试、类型检查、关键场景回归）
- `fork-next`：允许实验，但发版前必须补齐门禁
- 严禁在未验证状态直接发布 `latest`

## 6. 发布前检查清单（模板）

- [ ] 当前分支正确（`fork-main` 或 `fork-next`）
- [ ] 工作区干净（无非预期改动）
- [ ] 版本号已按策略更新
- [ ] 核心测试通过
- [ ] CHANGELOG/发布说明已更新
- [ ] npm tag 正确（`latest`/`next`）

## 7. 决策记录（模板）

### [YYYY-MM-DD] 决策标题

- 背景：
- 选项：
- 决策：
- 原因：
- 风险：
- 回滚方案：

