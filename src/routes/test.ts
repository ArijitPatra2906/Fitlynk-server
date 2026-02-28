import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/test
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Test route is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// GET /api/test/echo - Echo back any query parameters
router.get('/echo', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Echo endpoint',
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
    },
  });
});

// POST /api/test/echo - Echo back request body
router.post('/echo', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Echo endpoint (POST)',
    body: req.body,
  });
});

export default router;
