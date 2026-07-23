import express from 'express';
import { db } from '../db/database';

const router = express.Router();

// ローカル日付 (YYYY-MM-DD)
function todayStr(base?: Date): string {
  const d = base ? new Date(base) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 現在時刻 (HH:MM)
function nowTime(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// ---------------------------------------------------------------------------
// 既存エンドポイント
// ---------------------------------------------------------------------------

// 本日の全スタッフ出勤状況（未打刻スタッフも空で返す）
router.get('/today', async (req, res) => {
  try {
    const date = todayStr();
    const rows = await db.query(`
      SELECT
        s.id            AS staff_id,
        s.name          AS staff_name,
        a.id            AS attendance_id,
        a.date          AS date,
        a.check_in      AS check_in,
        a.check_out     AS check_out,
        a.status        AS status
      FROM staff s
      LEFT JOIN attendance a
        ON a.staff_id = s.id AND a.date = ?
      ORDER BY s.id
    `, [date]);
    res.json(rows);
  } catch (error) {
    console.error('Attendance today GET error:', error);
    res.status(500).json({ error: 'Failed to fetch today attendance' });
  }
});

// 指定スタッフの全出勤レコード
router.get('/staff/:id', async (req, res) => {
  try {
    const rows = await db.query(
      'SELECT * FROM attendance WHERE staff_id = ? ORDER BY date DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Attendance staff GET error:', error);
    res.status(500).json({ error: 'Failed to fetch staff attendance' });
  }
});

// スケジュール登録（日付指定で出退勤時間を作成/更新）
router.post('/schedule', async (req, res) => {
  try {
    const { staffId, date, checkIn, checkOut } = req.body;
    if (!staffId || !date) {
      return res.status(400).json({ error: 'staffId and date are required' });
    }
    const existing = await db.get(
      'SELECT * FROM attendance WHERE staff_id = ? AND date = ?',
      [staffId, date]
    );
    if (existing) {
      await db.run(
        'UPDATE attendance SET check_in = ?, check_out = ? WHERE id = ?',
        [checkIn || null, checkOut || null, existing.id]
      );
      const updated = await db.get('SELECT * FROM attendance WHERE id = ?', [existing.id]);
      return res.json(updated);
    }
    const result = await db.run(
      'INSERT INTO attendance (staff_id, date, check_in, check_out, status) VALUES (?, ?, ?, ?, ?)',
      [staffId, date, checkIn || null, checkOut || null, 'scheduled']
    );
    const created = await db.get('SELECT * FROM attendance WHERE id = ?', [result.lastID]);
    res.json(created);
  } catch (error) {
    console.error('Attendance schedule POST error:', error);
    res.status(500).json({ error: 'Failed to save schedule' });
  }
});

// 出勤レコード更新
router.put('/:id', async (req, res) => {
  try {
    const { check_in, check_out, status } = req.body;
    const existing = await db.get('SELECT * FROM attendance WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Attendance not found' });
    await db.run(
      'UPDATE attendance SET check_in = ?, check_out = ?, status = ? WHERE id = ?',
      [
        check_in !== undefined ? check_in : existing.check_in,
        check_out !== undefined ? check_out : existing.check_out,
        status !== undefined ? status : existing.status,
        req.params.id,
      ]
    );
    const updated = await db.get('SELECT * FROM attendance WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    console.error('Attendance PUT error:', error);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// 出勤レコード削除
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM attendance WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Attendance not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Attendance DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete attendance' });
  }
});

// ---------------------------------------------------------------------------
// 追加エンドポイント
// ---------------------------------------------------------------------------

// 出勤打刻
router.post('/checkin', async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) return res.status(400).json({ error: 'staffId is required' });
    const date = todayStr();
    const time = nowTime();
    const existing = await db.get(
      'SELECT * FROM attendance WHERE staff_id = ? AND date = ?',
      [staffId, date]
    );
    if (existing) {
      await db.run(
        "UPDATE attendance SET check_in = ?, status = 'working' WHERE id = ?",
        [time, existing.id]
      );
      const updated = await db.get('SELECT * FROM attendance WHERE id = ?', [existing.id]);
      return res.json(updated);
    }
    const result = await db.run(
      "INSERT INTO attendance (staff_id, date, check_in, status) VALUES (?, ?, ?, 'working')",
      [staffId, date, time]
    );
    const created = await db.get('SELECT * FROM attendance WHERE id = ?', [result.lastID]);
    res.json(created);
  } catch (error) {
    console.error('Attendance checkin error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// 退勤打刻
router.post('/checkout', async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) return res.status(400).json({ error: 'staffId is required' });
    const date = todayStr();
    const time = nowTime();
    const existing = await db.get(
      'SELECT * FROM attendance WHERE staff_id = ? AND date = ?',
      [staffId, date]
    );
    if (!existing) {
      return res.status(404).json({ error: 'No attendance record for today' });
    }
    await db.run(
      "UPDATE attendance SET check_out = ?, status = 'completed' WHERE id = ?",
      [time, existing.id]
    );
    const updated = await db.get('SELECT * FROM attendance WHERE id = ?', [existing.id]);
    res.json(updated);
  } catch (error) {
    console.error('Attendance checkout error:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// 週間スケジュール（今日から7日間、データがない日は空で補完）
router.get('/week/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 6);
    const startStr = todayStr(start);
    const endStr = todayStr(end);

    const rows = await db.query(
      'SELECT * FROM attendance WHERE staff_id = ? AND date BETWEEN ? AND ?',
      [staffId, startStr, endStr]
    );
    const byDate: Record<string, any> = {};
    for (const row of rows) {
      byDate[row.date] = row;
    }

    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const date = todayStr(d);
      const existing = byDate[date];
      week.push(existing || {
        staff_id: Number(staffId),
        date,
        check_in: null,
        check_out: null,
        status: null,
      });
    }
    res.json(week);
  } catch (error) {
    console.error('Attendance week GET error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly schedule' });
  }
});

export { router as attendanceRouter };
