'use strict';

const express  = require('express');
const db       = require('../config/db');
const bcrypt   = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roleCheck');
const { apiLimiter }   = require('../middleware/rateLimiter');

const router = express.Router();
router.use(apiLimiter);
router.use(authenticate);
router.use(requireRole('admin', 'teacher'));

// ---------------------------------------------------------------------------
// GET /api/users  – list all students (teacher/admin)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    let query = 'SELECT id, name, email, role, is_active, created_at FROM users';
    const params = [];

    if (req.user.role === 'teacher') {
      query += ' WHERE role = ?';
      params.push('student');
    }
    query += ' ORDER BY created_at DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/users  – create user (admin only)
// ---------------------------------------------------------------------------
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'name, email, password, and role are required.' });
    }

    const [dup] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (dup.length > 0) return res.status(409).json({ success: false, message: 'Email already exists.' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, role]
    );
    res.status(201).json({ success: true, message: 'User created.', userId: result.insertId });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/users/:id/toggle  – activate/deactivate user (admin)
// ---------------------------------------------------------------------------
router.put('/:id/toggle', requireRole('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    await db.query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [userId]);
    res.json({ success: true, message: 'User status toggled.' });
  } catch (err) {
    console.error('Toggle user error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/users/:id  – delete user (admin)
// ---------------------------------------------------------------------------
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
