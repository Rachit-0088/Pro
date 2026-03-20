-- =============================================================
-- AI Based Examination Portal - Database Schema
-- Database: exam_portal
-- =============================================================

CREATE DATABASE IF NOT EXISTS exam_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE exam_portal;

-- -------------------------------------------------------------
-- Table: users
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin','teacher','student') NOT NULL DEFAULT 'student',
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- Table: exams
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exams (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  subject         VARCHAR(100),
  created_by      INT NOT NULL,
  scheduled_at    DATETIME NOT NULL,
  duration_mins   INT NOT NULL DEFAULT 30,
  total_marks     INT NOT NULL DEFAULT 0,
  pass_marks      INT NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  randomize       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- Table: questions
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  exam_id      INT NOT NULL,
  question     TEXT NOT NULL,
  option_a     VARCHAR(500) NOT NULL,
  option_b     VARCHAR(500) NOT NULL,
  option_c     VARCHAR(500) NOT NULL,
  option_d     VARCHAR(500) NOT NULL,
  correct_ans  ENUM('A','B','C','D') NOT NULL,
  marks        INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- Table: results
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  exam_id          INT NOT NULL,
  student_id       INT NOT NULL,
  score            INT NOT NULL DEFAULT 0,
  total_marks      INT NOT NULL DEFAULT 0,
  percentage       DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  passed           TINYINT(1) NOT NULL DEFAULT 0,
  answers          JSON,
  time_taken_secs  INT NOT NULL DEFAULT 0,
  submitted_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id)     REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)  REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_result (exam_id, student_id)
);

-- -------------------------------------------------------------
-- Table: monitoring_logs
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitoring_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  exam_id      INT NOT NULL,
  student_id   INT NOT NULL,
  event_type   VARCHAR(50) NOT NULL,
  description  TEXT,
  logged_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id)    REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- Indexes for performance
-- -------------------------------------------------------------
CREATE INDEX idx_exams_created_by   ON exams(created_by);
CREATE INDEX idx_exams_scheduled_at ON exams(scheduled_at);
CREATE INDEX idx_questions_exam_id  ON questions(exam_id);
CREATE INDEX idx_results_exam_id    ON results(exam_id);
CREATE INDEX idx_results_student_id ON results(student_id);
CREATE INDEX idx_monitoring_exam    ON monitoring_logs(exam_id);
CREATE INDEX idx_monitoring_student ON monitoring_logs(student_id);
