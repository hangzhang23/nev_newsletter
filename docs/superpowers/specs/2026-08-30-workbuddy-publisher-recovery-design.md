# WorkBuddy 发布器自动恢复设计

## 目标

补齐 WorkBuddy 本地产物与 GitHub 之间的最后一个断点：即使周报完成时网络或 Git 凭据暂时不可用，系统也会保留产物并每 15 分钟自动重试，直到远端 `main` 确认包含该周期数据。

## 设计

- 发布入口固定为 `E:\workbuddy\space\.workbuddy\bin\publish-nev.cmd`，不再依赖可能脏或落后的 `E:\projects\nev_web`。
- 运行器在 `E:\workbuddy\space\.workbuddy\publisher\nev_web` 维护专用干净 clone；每次运行先同步远端 `main`，再调用仓库已有的幂等发布模块。
- Windows 计划任务 `NEV WorkBuddy Publisher` 每 15 分钟检查待发布请求；WorkBuddy 阶段三调用固定入口创建标记并立即发布。两者共用同一运行器，成功后只清除本次处理快照中的 token，新到请求保留给下一次重试。
- 使用状态目录内的独占文件锁跨 Windows 会话避免 WorkBuddy 与计划任务并发发布；锁竞争返回非零并保留待发布请求。
- 日志仅记录时间、命令输出和退出状态，写入 `.workbuddy\logs\nev-publisher.log`；不读取或记录业务密钥。
- 数据目录固定为 `E:\workbuddy\space`，远端固定为 `https://github.com/hangzhang23/nev_newsletter.git`，分支固定为 `main`；运行时不接受覆盖，避免不同请求配置被错误合并。
- Git 认证继续复用当前 Windows 用户的 Git Credential Manager。认证或网络失败返回非零，但不删除源 CSV；后续计划任务继续重试。
- 发布模块的远端提交确认仍是唯一成功标准。相同数据再次运行不产生重复提交。

## 安全边界

- 专用 clone 路径必须位于 `.workbuddy\publisher`，运行器拒绝把其他目录当作托管 clone。
- 不使用 force push，不修改项目主工作树，不复制 Markdown、日志或凭据。
- 安装器只创建上述固定目录、入口和当前用户计划任务。
