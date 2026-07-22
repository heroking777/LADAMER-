import express from 'express';
import { db } from '../db/database';

const router = express.Router();


router.get('/staff/:staffId/tags', async (req, res) => {
  try {
    const tags = await db.query(`
      SELECT t.* FROM tags t
      JOIN staff_tags st ON st.tag_id = t.id
      WHERE st.staff_id = ?
    `, [req.params.staffId]);
    res.json(tags);
  } catch (error) {
    console.error('Staff tags GET error:', error);
    res.status(500).json({ error: 'Failed to fetch staff tags' });
  }
});

// staff/1 でもタグを返す
router.get('/staff/:staffId', async (req, res) => {
  try {
    const tags = await db.query(`
      SELECT t.* FROM tags t
      JOIN staff_tags st ON st.tag_id = t.id
      WHERE st.staff_id = ?
    `, [req.params.staffId]);
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff tags' });
  }
});

router.post('/staff/:staffId/tags', async (req, res) => {
  try {
    const { staffId } = req.params;
    const { tagIds } = req.body;
    await db.run('DELETE FROM staff_tags WHERE staff_id = ?', [staffId]);
    for (const tagId of tagIds) {
      await db.run('INSERT INTO staff_tags (staff_id, tag_id) VALUES (?, ?)', [staffId, tagId]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Staff tags POST error:', error);
    res.status(500).json({ error: 'Failed to save staff tags' });
  }
});

router.get('/', async (req, res) => {
  try {
    const tags = await db.query('SELECT * FROM tags ORDER BY category, name');
    res.json(tags);
  } catch (error) {
    console.error('Tags GET error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, category, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Tag name is required' });
    const result = await db.run(
      'INSERT INTO tags (name, category, color) VALUES (?, ?, ?)',
      [name, category || 'その他', color || '#00d4aa']
    );
    const newTag = await db.get('SELECT * FROM tags WHERE id = ?', [result.lastID]);
    res.status(201).json(newTag);
  } catch (error) {
    console.error('Tag POST error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM staff_tags WHERE tag_id = ?', [req.params.id]);
    const result = await db.run('DELETE FROM tags WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Tag not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Tag DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export { router as tagsRouter };

// 全スタッフのタグを一括取得
router.get('/staff-tags/all', async (req, res) => {
  try {
    const staffTags = await db.query(`
      SELECT st.staff_id, t.id, t.name, t.category, t.color
      FROM staff_tags st
      JOIN tags t ON st.tag_id = t.id
      ORDER BY st.staff_id, t.category, t.name
    `);
    
    // スタッフIDごとにグループ化
    const grouped = staffTags.reduce((acc, row) => {
      if (!acc[row.staff_id]) {
        acc[row.staff_id] = [];
      }
      acc[row.staff_id].push({
        id: row.id,
        name: row.name,
        category: row.category,
        color: row.color
      });
      return acc;
    }, {});
    
    res.json(grouped);
  } catch (error) {
    console.error('All staff tags GET error:', error);
    res.status(500).json({ error: 'Failed to fetch all staff tags' });
  }
});
