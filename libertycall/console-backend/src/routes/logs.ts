import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ logs: [{ timestamp: new Date().toISOString(), level: 'info', message: 'System started' }] });
});

export default router;
