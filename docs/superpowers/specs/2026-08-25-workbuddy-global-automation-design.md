# WorkBuddy 全局自动化设计

## 目标

将现有两段式流程连接为一个可恢复、可验证的端到端自动化：WorkBuddy 每周生成新能源周报后，自动把网站所需数据安全推送到 GitHub；GitHub Actions 完成 Supabase 入库、静态快照生成和回写，随后由 Vercel 的 Git 集成自动部署。

完成标准：当 `E:\workbuddy\space` 出现新的有效周报 CSV 后，无需人工复制、提交或触发工作流，Vercel 网站最终展示该周数据；重复执行不会产生重复提交或重复数据。

## 范围

本次包含：

- WorkBuddy 侧的发布入口与接入说明。
- 从 WorkBuddy 数据目录向 `nev_web/data` 同步网站数据。
- 安全的 Git 拉取、提交与推送。
- GitHub Actions 的数据变更触发、定时补偿、Supabase 入库、预渲染和快照回写。
- 数据新鲜度、幂等性、并发和失败行为验证。
- 将当前缺失的 W34 CSV 纳入网站数据链路。

本次不包含：

- 改造周报调研、IMA 上传或微信推送逻辑。
- 使用 self-hosted GitHub runner。
- 让浏览器直接查询 Supabase。
- 新增数据库表、付费服务或第三方队列。
- 自动提交周报 Markdown 和深度分析文件；网站管道只消费 CSV 与 `brand_colors.json`。

## 架构

```text
WorkBuddy weekly-new-nev-investigation
  -> 生成并校验周报 CSV
  -> 调用 nev_web 发布命令
  -> 同步 data/ 并安全推送 GitHub
  -> GitHub Actions（push / schedule / manual）
  -> 测试
  -> ingest Supabase
  -> prerender 4 个静态 JSON
  -> 校验快照含最新周次
  -> 回写 frontend/public/data
  -> Vercel Git 集成自动部署
```

职责边界：

- WorkBuddy 是原始周报产物的生成者。
- Git 仓库 `data/` 是云端管道可访问、可审计的输入快照。
- Supabase 是归一化结构化数据的事实源。
- `frontend/public/data` 是公开站点的只读发布快照。
- Vercel 只构建和托管，不承担数据编排。

## WorkBuddy 发布入口

仓库新增一个面向 Windows/WorkBuddy 的单命令入口。它调用可测试的 Node.js 发布模块，使用以下环境或默认值：

- 源目录：`NEV_DATA_DIR`，默认 `E:\workbuddy\space`。
- 远端地址：从脚本所在仓库的 `origin` 读取，也允许 `NEV_GIT_REMOTE` 显式覆盖。
- 分支：`NEV_GIT_BRANCH`，默认 `main`。

发布步骤：

1. 扫描源目录下符合 `NEV_weekly_report_YYYYMMDD_YYYYMMDD.csv` 或 `_fixed.csv` 的文件，并要求存在 `brand_colors.json`。
2. 对同一周期优先选择 `_fixed.csv`，与 ingest 规则保持一致。
3. 校验至少存在一份周报，并检查文件非空、文件名日期范围合法。
4. 在系统临时目录创建干净的单分支 clone，绝不修改调用者当前工作树。
5. 复制所有匹配文件到临时 clone 的 `data/`；内容相同不重写。
6. 仅暂存 `data/` 下允许的 CSV 和 `brand_colors.json`。
7. 若无变化，以成功状态退出，不触发空提交。
8. 使用固定机器人身份提交，提交信息包含最新数据周期。
9. 执行普通 `git push origin <branch>`，绝不 force push。
10. 如果远端竞争导致非快进拒绝，删除临时 clone 后从最新远端重新执行一次；再次失败则明确报错。
11. 无论成功失败都清理临时 clone，不遗留含仓库内容的临时目录。

发布脚本不得读取、记录或输出 Supabase、IMA、GitHub token。GitHub 身份认证复用本机已配置的 Git credential。

如果 WorkBuddy 当前的自动化定义无法从项目目录直接编辑，则交付一个稳定的单命令调用契约，并把它写入自动化接入文档；实际调度定义只需要在既有任务的三个产物及 IMA 上传成功后调用该命令。

## GitHub Actions 云端处理

工作流触发条件：

- `push` 到 `main`，且 `data/**` 发生变化。
- 每周日北京时间 08:30 的定时补偿。
- `workflow_dispatch` 手动恢复。

工作流使用仓库级 `concurrency`，同一分支只允许一个数据发布任务运行。新任务不取消正在执行的数据库写入，避免出现 ingest 已完成但 prerender 被中断的半状态。

步骤顺序：

1. Checkout `main` 完整历史。
2. 安装根、scripts 和 frontend 依赖，全部使用 `npm ci`。
3. 运行 scripts 与 frontend 测试及类型检查。
4. 校验输入目录及确定最新有效周次。
5. 使用 GitHub Secrets 中的 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 执行 ingest。
6. 从 Supabase 预渲染四个 JSON。
7. 校验 `vehicles.json` 和 `trend_weekly.json` 已覆盖输入数据的最新周次；不满足则失败且不提交。
8. 仅提交 `frontend/public/data`。
9. 提交前拉取远端最新 `main` 并 rebase；若数据目录已由另一个任务更新，则重新执行预渲染或明确失败，不允许 force push 覆盖业务提交。
10. 普通 push 回 `main`。该提交不修改 `data/**`，因此不会再次触发数据工作流。

定时触发主要用于补偿 push 事件失败或 Secrets/平台短暂故障；由于 ingest 使用 upsert，重复运行应保持幂等。

## Supabase 数据行为

继续使用 `vehicles.name`、`brands.name` 和 `weeks.week` 作为 upsert 冲突键，不新增 schema。

必须补强现有 ingest 的错误处理：三个 upsert 均检查返回的 `error`，任一失败立即退出，禁止在部分入库后继续生成看似成功的快照。现有 RLS 保持不变，service role 仅存在 GitHub Secrets 和授权的本地环境，不进入前端或仓库。

预渲染继续全量读取 Supabase，四个输出保持现有前端契约：

- `vehicles.json`
- `trend_weekly.json`
- `brands_dist.json`
- `monthly.json`

## 一致性与恢复

幂等性：

- 相同文件内容重复同步不产生 Git 变化。
- CSV 重复入库通过 upsert 收敛。
- 相同数据库状态重复预渲染产生确定性 JSON。
- 无快照变化时不创建提交。

失败策略：

- WorkBuddy 产物缺失或无效：不提交、不推送，返回非零状态。
- 临时 clone 或 Git 认证失败：不修改本地工作树、不 force push，并返回非零状态。
- Supabase 任一写入失败：工作流失败，不运行或不提交预渲染结果。
- 快照新鲜度校验失败：工作流失败，不部署旧数据。
- GitHub push 竞争：重新基于远端状态处理一次；仍冲突则失败，由定时任务或手动触发恢复。
- Vercel 构建失败：GitHub 中的数据和快照仍可审计，Vercel 保留上一个成功部署。

## 测试策略

发布模块使用临时 Git 仓库和临时源目录进行行为测试，不触碰真实远端：

- 只同步允许的文件。
- `_fixed.csv` 优先。
- 相同内容重复执行无变化。
- 空文件或非法日期名被拒绝。
- 无变化时不提交。
- 有变化时提交信息包含最新周期。
- 不允许生成 force push 命令。
- 发布过程不改变调用者工作树及其未提交内容。

数据管道测试：

- 为 Supabase upsert 错误传播增加单元测试，证明任一表失败都会使 ingest 失败。
- 为最新周次计算和静态快照新鲜度校验增加单元测试。
- 保留并运行现有 normalize、aggregate、filter 测试。
- 执行 scripts 测试、frontend 测试、typecheck 和生产构建。

云端验证：

- 首次推送包含 W34 CSV 后，观察 GitHub Actions 成功完成。
- 确认生成 JSON 的最新周次为 W34。
- 确认 Vercel 对应部署成功且页面可读取新快照。
- 再次手动运行工作流，确认没有重复车型且无无意义提交。

## 安全与运维

- 不把 `service_role`、GitHub token、IMA key 或 MCP headers 写入代码、日志和提交。
- GitHub Action 只授予 `contents: write`，不增加其他权限。
- 前端继续不使用任何 Supabase key。
- 发布脚本只允许暂存 `data/` 的白名单文件，避免把 WorkBuddy 其他报告、日志或凭证带入仓库。
- 不使用 `--force` 或 `--force-with-lease`，业务仓库历史只允许普通快进推送。

## 交付物

- 可测试的本地发布模块与 Windows/WorkBuddy 调用入口。
- 发布模块单元/集成测试。
- 改造后的 GitHub Actions 工作流。
- ingest 错误检查及测试。
- 静态快照新鲜度校验及测试。
- WorkBuddy 自动化接入说明。
- W34 数据同步结果。
