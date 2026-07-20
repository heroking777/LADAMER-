import express from 'express';
const router = express.Router();

router.post('/send', async (req, res) => {
  const { to, subject, body } = req.body;
  res.json({ success: true, message: `Email sent to ${to}` });
});

export default router;
