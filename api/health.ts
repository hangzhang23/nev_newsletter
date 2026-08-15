import type { VercelRequest, VercelResponse } from '@vercel/node';

// GET /api/health —— 部署后健康检查
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    code: 0,
    data: { ok: true, time: new Date().toISOString() },
    message: 'ok',
  });
}
