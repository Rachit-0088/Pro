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
// GET /api/questions/:examId  – list questions for an exam
//   Teacher: full list with answers
//   Student: list WITHOUT correct_ans (randomised if exam.randomize=1)
// ---------------------------------------------------------------------------
router.get('/:examId', async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);

    const [examRows] = await db.query('SELECT id, created_by, randomize, is_active FROM exams WHERE id = ?', [examId]);
    if (examRows.length === 0) return res.status(404).json({ success: false, message: 'Exam not found.' });

    const exam = examRows[0];

    if (req.user.role === 'student') {
      if (!exam.is_active) return res.status(403).json({ success: false, message: 'Exam not available.' });

      let [rows] = await db.query(
        'SELECT id, question, option_a, option_b, option_c, option_d, marks FROM questions WHERE exam_id = ?',
        [examId]
      );

      // Randomise if enabled
      if (exam.randomize) rows = shuffle(rows);

      return res.json({ success: true, questions: rows });
    }

    // Teacher / Admin – include correct answers
    if (exam.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    const [rows] = await db.query(
      'SELECT id, question, option_a, option_b, option_c, option_d, correct_ans, marks FROM questions WHERE exam_id = ?',
      [examId]
    );
    res.json({ success: true, questions: rows });
  } catch (err) {
    console.error('List questions error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/questions/:examId  – add question (teacher/admin)
// ---------------------------------------------------------------------------
router.post('/:examId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);
    const { question, option_a, option_b, option_c, option_d, correct_ans, marks } = req.body;

    if (!question || !option_a || !option_b || !option_c || !option_d || !correct_ans) {
      return res.status(400).json({ success: false, message: 'All question fields are required.' });
    }
    if (!['A', 'B', 'C', 'D'].includes(correct_ans.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'correct_ans must be A, B, C, or D.' });
    }

    const [examRows] = await db.query('SELECT id, created_by FROM exams WHERE id = ?', [examId]);
    if (examRows.length === 0) return res.status(404).json({ success: false, message: 'Exam not found.' });
    if (examRows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    const qMarks = parseInt(marks || 1, 10);

    const [result] = await db.query(
      `INSERT INTO questions (exam_id, question, option_a, option_b, option_c, option_d, correct_ans, marks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [examId, question, option_a, option_b, option_c, option_d, correct_ans.toUpperCase(), qMarks]
    );

    // Update total_marks on exam
    await db.query('UPDATE exams SET total_marks = (SELECT COALESCE(SUM(marks),0) FROM questions WHERE exam_id = ?) WHERE id = ?', [examId, examId]);

    res.status(201).json({ success: true, message: 'Question added.', questionId: result.insertId });
  } catch (err) {
    console.error('Add question error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/questions/:examId/:questionId  – update question (teacher/admin)
// ---------------------------------------------------------------------------
router.put('/:examId/:questionId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId     = parseInt(req.params.examId, 10);
    const questionId = parseInt(req.params.questionId, 10);
    const { question, option_a, option_b, option_c, option_d, correct_ans, marks } = req.body;

    const [examRows] = await db.query('SELECT id, created_by FROM exams WHERE id = ?', [examId]);
    if (examRows.length === 0) return res.status(404).json({ success: false, message: 'Exam not found.' });
    if (examRows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    await db.query(
      `UPDATE questions SET question=?, option_a=?, option_b=?, option_c=?, option_d=?, correct_ans=?, marks=?
       WHERE id=? AND exam_id=?`,
      [question, option_a, option_b, option_c, option_d, correct_ans.toUpperCase(),
       parseInt(marks || 1, 10), questionId, examId]
    );

    await db.query('UPDATE exams SET total_marks = (SELECT COALESCE(SUM(marks),0) FROM questions WHERE exam_id = ?) WHERE id = ?', [examId, examId]);

    res.json({ success: true, message: 'Question updated.' });
  } catch (err) {
    console.error('Update question error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/questions/:examId/:questionId  – delete question (teacher/admin)
// ---------------------------------------------------------------------------
router.delete('/:examId/:questionId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId     = parseInt(req.params.examId, 10);
    const questionId = parseInt(req.params.questionId, 10);

    const [examRows] = await db.query('SELECT id, created_by FROM exams WHERE id = ?', [examId]);
    if (examRows.length === 0) return res.status(404).json({ success: false, message: 'Exam not found.' });
    if (examRows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    await db.query('DELETE FROM questions WHERE id = ? AND exam_id = ?', [questionId, examId]);

    await db.query('UPDATE exams SET total_marks = (SELECT COALESCE(SUM(marks),0) FROM questions WHERE exam_id = ?) WHERE id = ?', [examId, examId]);

    res.json({ success: true, message: 'Question deleted.' });
  } catch (err) {
    console.error('Delete question error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// Helper: Fisher–Yates shuffle
// ---------------------------------------------------------------------------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = router;
