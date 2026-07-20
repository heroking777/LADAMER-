import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ calls: [{ id: '1', status: 'active', duration: 120 }] });
});

router.get('/:id', (req, res) => {
  res.json({ id: req.params.id, status: 'active' });
});

export default router;
