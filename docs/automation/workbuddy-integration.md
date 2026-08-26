# WorkBuddy → GitHub → Supabase → Vercel 自动化接入

## 自动化边界

WorkBuddy 的 `weekly-new-nev-investigation` 负责生成周报 CSV、摘要、深度分析和 IMA 上传。本仓库负责从 CSV 开始的发布链路。已检查的 `.codebuddy` / `.workbuddy` 目录只包含执行记忆，没有可编辑的调度定义，因此最终接入点采用稳定命令契约。

## WorkBuddy 最后一步

在 `weekly-new-nev-investigation` 确认 CSV、摘要、深度分析和 IMA 上传成功后，追加执行：

```bat
E:\projects\nev_web\scripts\publish-workbuddy.cmd
```

该命令会：

1. 从 `E:\workbuddy\space` 校验并选择周报 CSV；同周期优先 `_fixed.csv`。
2. 只选择 `NEV_weekly_report_*.csv` 和 `brand_colors.json`。
3. 创建临时干净 clone，不修改 `E:\projects\nev_web` 的工作树。
4. 无变化时成功退出且不提交。
5. 有变化时普通 push 到 `main`；遇非快进竞争会从最新远端完整重试一次。
6. GitHub Actions 自动完成测试、Supabase 入库、静态 JSON、最新周次校验和 JSON 回写。
7. JSON 回写触发 Vercel Git 部署。

退出码 `0` 表示已推送或数据无变化；非零表示发布失败，WorkBuddy 应把本周任务标记为部分失败并保留本地产物供重试。

## 本机要求

- `node` 和 `npm` 可从 Windows 命令行使用。
- `E:\projects\nev_web` 已配置名为 `origin` 的 Git 远端。
- Windows Git Credential Manager 已登录并有仓库写权限。
- 可选覆盖：
  - `NEV_DATA_DIR`
  - `NEV_GIT_REMOTE`
  - `NEV_GIT_BRANCH`（默认 `main`）

发布器不会读取或输出 Supabase、IMA、MCP 或 GitHub token；Git 认证由 Credential Manager 完成。

## GitHub 配置

仓库 Actions Secrets 必须存在：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

工作流权限需要允许 GitHub Actions 写入仓库内容。前端不使用 Supabase key。

## 恢复方式

- WorkBuddy 发布失败：产物保留在 `E:\workbuddy\space`，再次运行 `publish-workbuddy.cmd`。
- GitHub Action 失败：修复 Secrets 或平台故障后手动运行 `Weekly Data Update`。
- 数据竞争：当前运行会拒绝提交旧快照；后到的数据 push 会排队并重新生成。
- Supabase 写入失败：单次事务 RPC 自动回滚三表，不留下混合版本，也不提交静态快照。
- Vercel 构建失败：仓库数据仍可审计，Vercel 保留上一个成功部署。

## 手动验证

```bat
set NEV_DATA_DIR=E:\workbuddy\space
E:\projects\nev_web\scripts\publish-workbuddy.cmd
```

首次运行应输出“已推送数据周期 …”；重复运行应输出“数据周期 … 无变化”。
