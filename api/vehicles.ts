import type { VercelRequest, VercelResponse } from '@vercel/node';

// GET /api/vehicles —— 二期扩展：动态查询 Supabase 兜底
// 一期读路径走静态 JSON，此端点返回空列表占位，规范见 dev_handbook §6.3
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    code: 0,
    data: { list: [], total: 0 },
    message: 'ok',
  });
}
