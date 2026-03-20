'use strict';

const express  = require('express');
const db       = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roleCheck');

const router = express.Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /api/monitoring/log  – log a monitoring event (student)
// ---------------------------------------------------------------------------
router.post('/log', requireRole('student'), async (req, res) => {
  try {
    const { exam_id, event_type, description } = req.body;

    if (!exam_id || !event_type) {
      return res.status(400).json({ success: false, message: 'exam_id and event_type are required.' });
    }

    await db.query(
      'INSERT INTO monitoring_logs (exam_id, student_id, event_type, description) VALUES (?, ?, ?, ?)',
      [parseInt(exam_id, 10), req.user.id, event_type, description || null]
    );

    res.json({ success: true, message: 'Event logged.' });
  } catch (err) {
    console.error('Monitoring log error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/monitoring/:examId  – teacher: view logs for an exam
// ---------------------------------------------------------------------------
router.get('/:examId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);

    const [rows] = await db.query(
      `SELECT ml.id, ml.event_type, ml.description, ml.logged_at,
              u.name AS student_name, u.email AS student_email
       FROM monitoring_logs ml
       JOIN users u ON u.id = ml.student_id
       WHERE ml.exam_id = ?
       ORDER BY ml.logged_at DESC`,
      [examId]
    );

    res.json({ success: true, logs: rows });
  } catch (err) {
    console.error('Get monitoring logs error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/monitoring/summary/:examId  – teacher: summary of suspicious activity
// ---------------------------------------------------------------------------
router.get('/summary/:examId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);

    const [rows] = await db.query(
      `SELECT u.id AS student_id, u.name, u.email,
              COUNT(*) AS total_events,
              SUM(ml.event_type = 'tab_switch') AS tab_switches,
              SUM(ml.event_type = 'webcam_denied') AS webcam_denied,
              SUM(ml.event_type = 'fullscreen_exit') AS fullscreen_exits
       FROM monitoring_logs ml
       JOIN users u ON u.id = ml.student_id
       WHERE ml.exam_id = ?
       GROUP BY u.id
       ORDER BY total_events DESC`,
      [examId]
    );

    res.json({ success: true, summary: rows });
  } catch (err) {
    console.error('Monitoring summary error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
