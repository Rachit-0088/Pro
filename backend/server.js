'use strict';

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const path     = require('path');

const { apiLimiter } = require('./middleware/rateLimiter');

const authRoutes       = require('./routes/auth');
const examRoutes       = require('./routes/exams');
const questionRoutes   = require('./routes/questions');
const resultRoutes     = require('./routes/results');
const monitoringRoutes = require('./routes/monitoring');
const userRoutes       = require('./routes/users');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "blob:"],
      mediaSrc:   ["'self'", "blob:"],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsers ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Static Frontend ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── API Routes (rate limiting applied per-router) ───────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/exams',      examRoutes);
app.use('/api/questions',  questionRoutes);
app.use('/api/results',    resultRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/users',      userRoutes);

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', apiLimiter, (_req, res) => {
  res.json({ success: true, message: 'AI Examination Portal API is running.' });
});

// ─── Catch-all: serve frontend (rate-limited) ────────────────────────────────
app.get('*', apiLimiter, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  AI Examination Portal running on http://localhost:${PORT}`);
});

module.exports = app;
