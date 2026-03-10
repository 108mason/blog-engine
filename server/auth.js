import 'dotenv/config';

export function authMiddleware(req, res, next) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return res.status(500).json({ error: 'DASHBOARD_PASSWORD not configured' });
  }

  const authHeader = req.headers['authorization'] || '';
  // Expect: "Bearer <password>"
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (token !== password) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
