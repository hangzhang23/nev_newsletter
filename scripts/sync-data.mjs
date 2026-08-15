// 同步数据脚本：把本机周报工作区（workbuddy/space）的 CSV 和品牌色配置
// 复制到项目 data/ 目录，供 git 提交 → GitHub Action 读取
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = process.env.NEV_DATA_DIR || 'e:/workbuddy/space';
const DEST = path.join(ROOT, 'data');

if (!fs.existsSync(SRC)) {
  console.error(`数据源目录不存在: ${SRC}\n请设置 NEV_DATA_DIR 环境变量指向周报工作区`);
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });

const srcFiles = fs
  .readdirSync(SRC)
  .filter((f) => /^NEV_weekly_report_\d{8}_\d{8}(_fixed)?\.csv$/.test(f) || f === 'brand_colors.json');

if (srcFiles.length === 0) {
  console.error(`未在 ${SRC} 找到周报 CSV 或 brand_colors.json`);
  process.exit(1);
}

for (const f of srcFiles) {
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
}
console.log(`已同步 ${srcFiles.length} 个文件 → ${DEST}\n`);
console.log('下一步：git add data/ && git commit && git push');
console.log('GitHub Action 将自动执行 ingest → prerender → 提交前端 JSON → Vercel 部署');
