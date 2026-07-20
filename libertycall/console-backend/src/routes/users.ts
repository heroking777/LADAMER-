import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ users: [{ id: '1', username: 'admin', role: 'admin' }] });
});

export default router;
