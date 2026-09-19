# WorkBuddy → GitHub → Supabase → Vercel 自动化接入

## 自动化边界

WorkBuddy 的 `weekly-new-nev-investigation` 负责生成周报 CSV、摘要、深度分析和 IMA 上传。本仓库负责从 CSV 开始的发布链路。固定发布器与计划任务负责把短暂网络或认证失败变成可自动恢复的待处理状态。

## 一次性安装

从包含本功能的干净分支或合并后的 `main` 在 Windows PowerShell 执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File E:\projects\nev_web\scripts\install-workbuddy-publisher.ps1
```

安装器会创建 `E:\workbuddy\space\.workbuddy\bin\publish-nev.cmd`，注册当前用户计划任务 `NEV WorkBuddy Publisher`，并立即尝试发布一次。计划任务之后每 15 分钟检查一次待发布请求；没有待处理数据时立即退出。

## WorkBuddy 最后一步

在 CSV、摘要、深度分析和 IMA 上传成功后调用固定入口：

```bat
E:\workbuddy\space\.workbuddy\bin\publish-nev.cmd
```

该命令会：

1. 从 `E:\workbuddy\space` 校验并选择周报 CSV；同周期优先 `_fixed.csv`。
2. 只选择 `NEV_weekly_report_*.csv` 和 `brand_colors.json`。
3. 在 `E:\workbuddy\space\.workbuddy\publisher\nev_web` 维护专用干净 clone，不修改 `E:\projects\nev_web` 的工作树。
4. 写入唯一的待发布请求 token，并使用跨 Windows 会话文件锁避免 WorkBuddy 主动调用与计划任务重叠。
5. 无变化时成功退出且不提交；有变化时普通 push 到 `main`，绝不 force push。
6. 发布模块再次读取远端并确认提交已进入远端历史后才返回成功。
7. GitHub Actions 自动完成测试、Supabase 入库、静态 JSON 校验和回写，随后触发 Vercel 部署。

退出码 `0` 表示远端已包含最新数据或数据无变化；非零表示本次发布失败。CSV 等本地产物始终保留，计划任务会每 15 分钟继续调用同一幂等入口，不产生重复提交。

## 本机要求

- Windows 的 `git.exe`、`node` 和 `npm.cmd` 可从命令行使用。
- Windows Git Credential Manager 已对 `https://github.com/hangzhang23/nev_newsletter.git` 登录并有 `main` 写权限。
- 计划任务在当前 Windows 用户登录时运行，以复用同一用户的 Git 凭据。

发布器不会读取或输出 Supabase、IMA、MCP 或 GitHub token；Git 认证由 Credential Manager 完成。

## GitHub 配置

仓库 Actions Secrets 必须存在：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`

工作流权限需要允许 GitHub Actions 写入仓库内容。前端不使用 Supabase key。

`SUPABASE_ACCESS_TOKEN` 用于 Supabase Management API 的项目状态检查和自动恢复。优先创建仅限当前项目、具有 `Project Settings: Read-write` 权限的 Scoped Personal Access Token；若账户尚未开放 Scoped Token，只能使用权限范围更大的 Classic Token，并应严格限制其存放位置。

`Supabase Midweek Guard` 每周三北京时间 08:30 自动执行，也支持从 GitHub Actions 手动运行。它会：

1. 查询 Supabase 项目状态。
2. 在项目为 `INACTIVE` 时请求恢复，并最长等待 15 分钟至 `ACTIVE_HEALTHY`。
3. 执行三次轻量只读查询，验证数据库实际可达并产生用户数据库活动。

`Weekly Data Update` 在每次周六发布和周日补偿运行时也会执行相同前置检查，因此周中保活未能阻止暂停时，正式发布仍可自动恢复后继续。

## 恢复与观察

- WorkBuddy 发布失败：本地产物保留，计划任务每 15 分钟自动重试；也可手动运行固定入口。
- GitHub Action 失败：修复 Secrets 或平台故障后手动运行 `Weekly Data Update`。
- Supabase 自动恢复失败：检查 `SUPABASE_ACCESS_TOKEN` 是否有效且具有项目设置读写权限，然后手动运行 `Supabase Midweek Guard`。
- Supabase 写入失败：单次事务 RPC 自动回滚三表，不提交静态快照。
- Vercel 构建失败：仓库数据仍可审计，Vercel 保留上一个成功部署。

持久日志位于 `E:\workbuddy\space\.workbuddy\logs\nev-publisher.log`。本地 commit 不代表成功，日志中的“远端已包含最新数据或本次无变化”才代表本地发布阶段闭环。

```powershell
Get-ScheduledTask -TaskName "NEV WorkBuddy Publisher" | Get-ScheduledTaskInfo
Get-Content E:\workbuddy\space\.workbuddy\logs\nev-publisher.log -Tail 80
```

如需移除自动重试（不会删除周报或仓库数据）：

```powershell
Unregister-ScheduledTask -TaskName "NEV WorkBuddy Publisher" -Confirm:$false
```

## 手动验证

```bat
E:\workbuddy\space\.workbuddy\bin\publish-nev.cmd
```

首次运行应输出“已推送数据周期 …”；重复运行应输出“数据周期 … 无变化”。
