import express from 'express';
import { db } from '../db/database';

const router = express.Router();

// GET /today - 本日の出勤情報（全スタッフ）
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.query(
      `SELECT s.id, s.name as staff_name, a.check_in, a.check_out, a.status 
       FROM staff s 
       LEFT JOIN attendance a ON s.id = a.staff_id AND a.date = ? 
       ORDER BY s.name`,
      [today]
    );
    res.json(result);
  } catch (error) {
    console.error('Today attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch today attendance' });
  }
});

// GET /staff/:id - 特定スタッフの出勤履歴
router.get('/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const records = await db.query(
      'SELECT * FROM attendance WHERE staff_id = ? ORDER BY date DESC, check_in DESC',
      [id]
    );
    res.json(records);
  } catch (error) {
    console.error('Staff attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch staff attendance' });
  }
});

// GET /week/:staffId - 週間スケジュール
router.get('/week/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    
    const records = await db.query(
      'SELECT * FROM attendance WHERE staff_id = ? AND date >= ? AND date <= ? ORDER BY date',
      [staffId, dates[0], dates[6]]
    );
    
    // 7日分のデータを補完
    const result = dates.map(date => {
      const found = records.find(r => r.date === date);
      return found || { staff_id: parseInt(staffId), date, check_in: null, check_out: null, status: null };
    });
    
    res.json(result);
  } catch (error) {
    console.error('Week attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch week attendance' });
  }
});

// POST /schedule - スケジュール登録
router.post('/schedule', async (req, res) => {
  try {
    const { staffId, date, checkIn, checkOut } = req.body;
    if (!staffId || !date) {
      return res.status(400).json({ error: 'staffId and date are required' });
    }
    const staff = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    
    // 既存レコードを確認
    const existing = await db.get('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', [staffId, date]);
    if (existing) {
      await db.run(
        'UPDATE attendance SET check_in = ?, check_out = ?, status = ? WHERE id = ?',
        [checkIn || null, checkOut || null, 'scheduled', existing.id]
      );
      const updated = await db.get('SELECT * FROM attendance WHERE id = ?', [existing.id]);
      return res.json(updated);
    }
    
    const result = await db.run(
      'INSERT INTO attendance (staff_id, staff_name, date, check_in, check_out, status) VALUES (?, ?, ?, ?, ?, ?)',
      [staffId, staff.name, date, checkIn || null, checkOut || null, 'scheduled']
    );
    const newRecord = await db.get('SELECT * FROM attendance WHERE id = ?', [result.lastID]);
    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Schedule create error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// POST /checkin - 出勤打刻
router.post('/checkin', async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) {
      return res.status(400).json({ error: 'staffId is required' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().slice(0, 5);
    
    const staff = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    
    const existing = await db.get('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', [staffId, today]);
    if (existing) {
      await db.run('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?', [now, 'working', existing.id]);
      const updated = await db.get('SELECT * FROM attendance WHERE id = ?', [existing.id]);
      return res.json(updated);
    }
    
    const result = await db.run(
      'INSERT INTO attendance (staff_id, staff_name, date, check_in, status) VALUES (?, ?, ?, ?, ?)',
      [staffId, staff.name, today, now, 'working']
    );
    const newRecord = await db.get('SELECT * FROM attendance WHERE id = ?', [result.lastID]);
    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// POST /checkout - 退勤打刻
router.post('/checkout', async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) {
      return res.status(400).json({ error: 'staffId is required' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().slice(0, 5);
    
    const existing = await db.get('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', [staffId, today]);
    if (!existing) {
      return res.status(404).json({ error: 'No check-in found for today' });
    }
    
    await db.run('UPDATE attendance SET check_out = ?, status = ? WHERE id = ?', [now, 'completed', existing.id]);
    const updated = await db.get('SELECT * FROM attendance WHERE id = ?', [existing.id]);
    res.json(updated);
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// PUT /:id - 更新
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, status } = req.body;
    const existing = await db.get('SELECT * FROM attendance WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    await db.run(
      'UPDATE attendance SET check_in = ?, check_out = ?, status = ? WHERE id = ?',
      [checkIn || null, checkOut || null, status || existing.status, id]
    );
    const updated = await db.get('SELECT * FROM attendance WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Attendance update error:', error);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// DELETE /:id - 削除
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.get('SELECT * FROM attendance WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    await db.run('DELETE FROM attendance WHERE id = ?', [id]);
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Attendance delete error:', error);
    res.status(500).json({ error: 'Failed to delete attendance' });
  }
});

export { router as attendanceRouter };
