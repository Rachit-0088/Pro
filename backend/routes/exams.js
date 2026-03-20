'use strict';

const express  = require('express');
const db       = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roleCheck');
const { apiLimiter }   = require('../middleware/rateLimiter');

const router = express.Router();
router.use(apiLimiter);
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/exams  – list exams
//   Teacher/Admin: all exams they created
//   Student: active exams that are scheduled (not yet attempted)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'student') {
      [rows] = await db.query(
        `SELECT e.id, e.title, e.description, e.subject, e.scheduled_at,
                e.duration_mins, e.total_marks, e.pass_marks,
                u.name AS created_by_name,
                (SELECT COUNT(*) FROM results r WHERE r.exam_id = e.id AND r.student_id = ?) AS attempted
         FROM exams e
         JOIN users u ON u.id = e.created_by
         WHERE e.is_active = 1
         ORDER BY e.scheduled_at ASC`,
        [req.user.id]
      );
    } else {
      [rows] = await db.query(
        `SELECT e.id, e.title, e.description, e.subject, e.scheduled_at,
                e.duration_mins, e.total_marks, e.pass_marks, e.is_active, e.randomize,
                u.name AS created_by_name,
                (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
                (SELECT COUNT(*) FROM results r WHERE r.exam_id = e.id) AS attempt_count
         FROM exams e
         JOIN users u ON u.id = e.created_by
         WHERE e.created_by = ?
         ORDER BY e.created_at DESC`,
        [req.user.id]
      );
    }
    res.json({ success: true, exams: rows });
  } catch (err) {
    console.error('List exams error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/exams/:id  – single exam detail
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const [rows] = await db.query(
      `SELECT e.*, u.name AS created_by_name
       FROM exams e JOIN users u ON u.id = e.created_by
       WHERE e.id = ?`,
      [examId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }
    const exam = rows[0];

    // Students can only view active exams
    if (req.user.role === 'student' && !exam.is_active) {
      return res.status(403).json({ success: false, message: 'Exam not available.' });
    }

    res.json({ success: true, exam });
  } catch (err) {
    console.error('Get exam error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/exams  – create exam (teacher/admin)
// ---------------------------------------------------------------------------
router.post('/', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { title, description, subject, scheduled_at, duration_mins, pass_marks, randomize } = req.body;

    if (!title || !scheduled_at || !duration_mins) {
      return res.status(400).json({ success: false, message: 'title, scheduled_at, and duration_mins are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO exams (title, description, subject, created_by, scheduled_at, duration_mins, pass_marks, randomize)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, subject || null, req.user.id, scheduled_at,
       parseInt(duration_mins, 10), parseInt(pass_marks || 0, 10), randomize !== false ? 1 : 0]
    );

    res.status(201).json({ success: true, message: 'Exam created.', examId: result.insertId });
  } catch (err) {
    console.error('Create exam error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/exams/:id  – update exam (teacher/admin)
// ---------------------------------------------------------------------------
router.put('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const { title, description, subject, scheduled_at, duration_mins, pass_marks, is_active, randomize } = req.body;

    const [rows] = await db.query('SELECT id, created_by FROM exams WHERE id = ?', [examId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Exam not found.' });
    if (rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    await db.query(
      `UPDATE exams SET title=?, description=?, subject=?, scheduled_at=?,
       duration_mins=?, pass_marks=?, is_active=?, randomize=? WHERE id=?`,
      [title, description || null, subject || null, scheduled_at,
       parseInt(duration_mins, 10), parseInt(pass_marks || 0, 10),
       is_active === false || is_active === 0 ? 0 : 1,
       randomize !== false ? 1 : 0, examId]
    );

    res.json({ success: true, message: 'Exam updated.' });
  } catch (err) {
    console.error('Update exam error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/exams/:id  – delete exam (teacher/admin)
// ---------------------------------------------------------------------------
router.delete('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);

    const [rows] = await db.query('SELECT id, created_by FROM exams WHERE id = ?', [examId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Exam not found.' });
    if (rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    await db.query('DELETE FROM exams WHERE id = ?', [examId]);
    res.json({ success: true, message: 'Exam deleted.' });
  } catch (err) {
    console.error('Delete exam error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/exams/:id/students  – students who attempted (teacher)
// ---------------------------------------------------------------------------
router.get('/:id/students', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, r.score, r.total_marks, r.percentage, r.passed, r.submitted_at
       FROM results r JOIN users u ON u.id = r.student_id
       WHERE r.exam_id = ?
       ORDER BY r.submitted_at DESC`,
      [examId]
    );
    res.json({ success: true, students: rows });
  } catch (err) {
    console.error('Exam students error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
