import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishData } from './git';

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);
const sourceDir = process.env.NEV_DATA_DIR || 'e:/workbuddy/space';
const branch = process.env.NEV_GIT_BRANCH || 'main';
const detectedRemote = spawnSync('git', ['-C', repoRoot, 'remote', 'get-url', 'origin'], {
  encoding: 'utf8',
}).stdout;
const remote = process.env.NEV_GIT_REMOTE || (detectedRemote || '').trim();
if (!remote) throw new Error('无法确定 Git 远端；请设置 NEV_GIT_REMOTE');
const result = publishData({ sourceDir, remote, branch });
console.log(result.status === 'pushed' ? `已推送数据周期 ${result.period}` : `数据周期 ${result.period} 无变化`);
