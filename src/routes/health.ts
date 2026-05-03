import { Router, Request, Response } from 'express';

const router = Router();
const startedAt = new Date();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    uptime: Math.round((Date.now() - startedAt.getTime()) / 1000),
    ts: new Date().toISOString(),
  });
});

export default router;
