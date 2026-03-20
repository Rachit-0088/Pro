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
// POST /api/results/submit  – student submits answers
// ---------------------------------------------------------------------------
router.post('/submit', requireRole('student'), async (req, res) => {
  try {
    const { exam_id, answers, time_taken_secs } = req.body;
    // answers: { questionId: 'A'|'B'|'C'|'D', ... }

    if (!exam_id || !answers) {
      return res.status(400).json({ success: false, message: 'exam_id and answers are required.' });
    }

    const examId = parseInt(exam_id, 10);

    // Check exam exists and is active
    const [examRows] = await db.query('SELECT id, total_marks, pass_marks FROM exams WHERE id = ? AND is_active = 1', [examId]);
    if (examRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exam not found or not active.' });
    }

    // Prevent duplicate submission
    const [dupRows] = await db.query('SELECT id FROM results WHERE exam_id = ? AND student_id = ?', [examId, req.user.id]);
    if (dupRows.length > 0) {
      return res.status(409).json({ success: false, message: 'Exam already submitted.' });
    }

    // Fetch correct answers
    const [questions] = await db.query(
      'SELECT id, correct_ans, marks FROM questions WHERE exam_id = ?',
      [examId]
    );

    // Calculate score
    let score = 0;
    const answerDetail = {};

    questions.forEach(q => {
      const given = (answers[q.id] || '').toString().toUpperCase();
      const correct = q.correct_ans.toUpperCase();
      const isCorrect = given === correct;
      if (isCorrect) score += q.marks;
      answerDetail[q.id] = { given, correct, isCorrect, marks: q.marks };
    });

    const totalMarks   = examRows[0].total_marks || questions.reduce((s, q) => s + q.marks, 0);
    const passMarks    = examRows[0].pass_marks || 0;
    const percentage   = totalMarks > 0 ? parseFloat(((score / totalMarks) * 100).toFixed(2)) : 0;
    const passed       = score >= passMarks ? 1 : 0;
    const timeTaken    = parseInt(time_taken_secs || 0, 10);

    const [result] = await db.query(
      `INSERT INTO results (exam_id, student_id, score, total_marks, percentage, passed, answers, time_taken_secs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [examId, req.user.id, score, totalMarks, percentage, passed, JSON.stringify(answerDetail), timeTaken]
    );

    res.status(201).json({
      success: true,
      message: 'Exam submitted successfully.',
      result: {
        id: result.insertId,
        score,
        total_marks: totalMarks,
        percentage,
        passed: Boolean(passed),
        answers: answerDetail,
        time_taken_secs: timeTaken
      }
    });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ success: false, message: 'Server error during submission.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/results/my  – student: own result history
// ---------------------------------------------------------------------------
router.get('/my', requireRole('student'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id, r.exam_id, r.score, r.total_marks, r.percentage, r.passed,
              r.time_taken_secs, r.submitted_at,
              e.title, e.subject, e.duration_mins
       FROM results r
       JOIN exams e ON e.id = r.exam_id
       WHERE r.student_id = ?
       ORDER BY r.submitted_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    console.error('My results error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/results/:examId/:studentId  – single result detail
// ---------------------------------------------------------------------------
router.get('/:examId/:studentId', async (req, res) => {
  try {
    const examId    = parseInt(req.params.examId, 10);
    const studentId = parseInt(req.params.studentId, 10);

    // Students can only view their own result
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Access forbidden.' });
    }

    const [rows] = await db.query(
      `SELECT r.*, e.title, e.subject, e.pass_marks, u.name AS student_name
       FROM results r
       JOIN exams e ON e.id = r.exam_id
       JOIN users u ON u.id = r.student_id
       WHERE r.exam_id = ? AND r.student_id = ?`,
      [examId, studentId]
    );

    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Result not found.' });

    // Fetch questions for display
    const [questions] = await db.query(
      'SELECT id, question, option_a, option_b, option_c, option_d, correct_ans, marks FROM questions WHERE exam_id = ?',
      [examId]
    );

    const result = rows[0];
    const answersMap = typeof result.answers === 'string' ? JSON.parse(result.answers) : result.answers;

    res.json({ success: true, result, questions, answersMap });
  } catch (err) {
    console.error('Get result error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/results/exam/:examId  – teacher: all results for an exam
// ---------------------------------------------------------------------------
router.get('/exam/:examId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);

    const [rows] = await db.query(
      `SELECT r.id, r.student_id, r.score, r.total_marks, r.percentage, r.passed,
              r.time_taken_secs, r.submitted_at,
              u.name AS student_name, u.email AS student_email
       FROM results r
       JOIN users u ON u.id = r.student_id
       WHERE r.exam_id = ?
       ORDER BY r.percentage DESC`,
      [examId]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    console.error('Exam results error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/results/export/:examId  – export results as CSV (teacher/admin)
// ---------------------------------------------------------------------------
router.get('/export/:examId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);

    const [rows] = await db.query(
      `SELECT u.name, u.email, r.score, r.total_marks, r.percentage, r.passed,
              r.time_taken_secs, r.submitted_at
       FROM results r
       JOIN users u ON u.id = r.student_id
       WHERE r.exam_id = ?
       ORDER BY r.percentage DESC`,
      [examId]
    );

    const [examRows] = await db.query('SELECT title FROM exams WHERE id = ?', [examId]);
    const examTitle = examRows.length > 0 ? examRows[0].title : `Exam_${examId}`;

    const header = 'Name,Email,Score,Total Marks,Percentage,Passed,Time Taken (s),Submitted At\n';
    const csvRows = rows.map(r =>
      `"${r.name}","${r.email}",${r.score},${r.total_marks},${r.percentage},${r.passed ? 'Yes' : 'No'},${r.time_taken_secs},"${r.submitted_at}"`
    ).join('\n');

    const filename = `results_${examTitle.replace(/\s+/g, '_')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(header + csvRows);
  } catch (err) {
    console.error('Export results error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
