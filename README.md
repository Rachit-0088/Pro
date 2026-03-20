# 🎓 AI Based Examination Portal

A complete, production-ready full-stack web application for online examinations with AI-powered proctoring features.

---

## 🏗 Tech Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | HTML5, CSS3, Vanilla JavaScript (no TypeScript)  |
| Backend    | Node.js + Express.js                             |
| Database   | MySQL 8+                                         |
| Auth       | JWT (JSON Web Tokens) + bcryptjs password hashing |

---

## 📁 Folder Structure

```
├── .env.example              # Environment variable template
├── .gitignore
├── package.json
├── README.md
│
├── backend/
│   ├── server.js             # Express app entry point
│   ├── config/
│   │   └── db.js             # MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication middleware
│   │   └── roleCheck.js      # Role-based access control middleware
│   ├── routes/
│   │   ├── auth.js           # Register, Login, Me
│   │   ├── exams.js          # CRUD for exams
│   │   ├── questions.js      # CRUD for MCQ questions
│   │   ├── results.js        # Submit, view, export results
│   │   ├── monitoring.js     # Log & view suspicious activity
│   │   └── users.js          # Student management (admin/teacher)
│   └── scripts/
│       └── createAdmin.js    # Seed admin account
│
├── database/
│   └── schema.sql            # Full MySQL database schema
│
└── frontend/
    ├── index.html            # Login / Register page
    ├── assets/
    │   ├── css/
    │   │   └── style.css     # Global stylesheet
    │   └── js/
    │       └── api.js        # API helper, auth utilities, DOM helpers
    ├── teacher/
    │   ├── dashboard.html    # Teacher overview
    │   ├── exams.html        # Create/edit/delete exams + manage questions
    │   ├── results.html      # View & export results per exam
    │   ├── monitor.html      # View suspicious activity logs
    │   └── students.html     # Manage student accounts
    └── student/
        ├── dashboard.html    # Available exams list
        ├── exam.html         # Exam page (timer, webcam, tab monitor)
        ├── result.html       # Instant result + answer review
        └── history.html      # Past exam history
```

---

## ✨ Features

### Authentication & Security
- JWT-based authentication with 24h token expiry
- Passwords hashed with bcrypt (12 salt rounds)
- Rate limiting on all API and auth endpoints (via `express-rate-limit`)
- Helmet.js security headers
- Role-based access control middleware

### Teacher / Admin
- Create, edit, delete exams with title, subject, schedule, duration, pass marks
- Add, edit, delete MCQ questions per exam (A/B/C/D options + correct answer)
- Toggle exam active/inactive status
- View all student submissions per exam with scores and pass/fail status
- Export results to CSV
- View detailed activity monitoring logs (tab switches, webcam denied, fullscreen exits)
- View suspicious activity summary with risk levels
- Manage student accounts (admin: activate/deactivate/delete)

### Student
- Self-registration (student role)
- View available & upcoming exams
- Attempt exams with countdown timer
- Auto-submit when time expires
- Question navigation with answer progress indicator
- View instant result with score, percentage, pass/fail
- Per-question answer review (correct vs. your answer)
- Exam history page

### Exam Monitoring
- **Tab switching detection** — alerts student and logs event to DB
- **Webcam access** — requests camera permission, shows live preview during exam
- **Fullscreen exit detection** — logs event on fullscreen change
- **Right-click & copy/paste disabled** during exam
- Teacher can view all logged events per exam with risk classification

### Core
- Fisher–Yates question randomisation (configurable per exam)
- Automatic score calculation (per-question marks)
- Instant result generation on submission
- Duplicate submission prevention

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 16+ ([nodejs.org](https://nodejs.org))
- MySQL 8+ ([dev.mysql.com](https://dev.mysql.com/downloads/))
- npm (bundled with Node.js)

---

### Step 1 – Clone & Install

```bash
git clone <repo-url>
cd Pro

npm install
```

---

### Step 2 – Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=exam_portal
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=24h
ADMIN_EMAIL=admin@exam.com
ADMIN_PASSWORD=Admin@123
ADMIN_NAME=Administrator
```

> ⚠️ **Change `JWT_SECRET`** to a long random string in production.

---

### Step 3 – Create Database

Log into MySQL and run the schema:

```bash
mysql -u root -p < database/schema.sql
```

Or paste the contents of `database/schema.sql` into MySQL Workbench / DBeaver.

---

### Step 4 – Create Admin Account

```bash
npm run seed
```

Output:
```
✅  Admin account created:
    Email   : admin@exam.com
    Password: Admin@123
    Role    : admin
```

---

### Step 5 – Start the Server

**Development (with auto-restart):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Open your browser at: **http://localhost:3000**

---

## 🧪 Testing Instructions

### Manual Test Flow

#### 1. Admin / Teacher Login
1. Go to `http://localhost:3000`
2. Log in with `admin@exam.com` / `Admin@123`
3. You are redirected to the **Teacher Dashboard**

#### 2. Create an Exam
1. Click **Manage Exams** → **+ New Exam**
2. Fill in: Title, Subject, Scheduled date/time, Duration, Pass Marks
3. Check **"Exam is active"** and **"Randomise question order"**
4. Click **Save Exam**

#### 3. Add Questions
1. Click **Questions** next to your new exam
2. Click **+ Add Question**
3. Fill in the question, 4 options, correct answer, and marks
4. Repeat for multiple questions

#### 4. Student Registration
1. Open an incognito/private window and go to `http://localhost:3000`
2. Switch to the **Register** tab
3. Register with a new name, email, password
4. Switch to **Login** and log in

#### 5. Attempt an Exam
1. On the student dashboard, click **Start Exam** on an available exam
2. Allow webcam when prompted
3. Answer questions (try switching to another tab to trigger monitoring)
4. Click **Submit Exam** or let the timer expire

#### 6. View Results (Student)
1. After submission you are redirected to the result page
2. See your score, percentage, pass/fail, and per-question review
3. Go to **My Results** for history

#### 7. View Results (Teacher)
1. Go back to the teacher browser tab
2. Click **Results** in the nav
3. Select your exam from the dropdown
4. See student scores and click **Export CSV** to download

#### 8. View Monitoring
1. Click **Monitor** in the nav
2. Select your exam
3. See tab-switch events logged by the student

---

### API Testing (curl / Postman)

**Register student:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Student","email":"student@test.com","password":"pass123"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@exam.com","password":"Admin@123"}'
```
Copy the `token` from the response.

**List exams (authenticated):**
```bash
curl http://localhost:3000/api/exams \
  -H "Authorization: Bearer <your-token>"
```

**Health check:**
```bash
curl http://localhost:3000/api/health
```

---

## 🗂 Database Schema Overview

| Table              | Key Columns                                                         |
|--------------------|---------------------------------------------------------------------|
| `users`            | id, name, email, password (hashed), role, is_active                |
| `exams`            | id, title, subject, scheduled_at, duration_mins, total_marks, pass_marks, randomize |
| `questions`        | id, exam_id, question, option_a–d, correct_ans, marks              |
| `results`          | id, exam_id, student_id, score, percentage, passed, answers (JSON) |
| `monitoring_logs`  | id, exam_id, student_id, event_type, description, logged_at        |

---

## 🔐 API Endpoints Summary

### Auth
| Method | Endpoint             | Access   | Description           |
|--------|----------------------|----------|-----------------------|
| POST   | /api/auth/register   | Public   | Student self-register |
| POST   | /api/auth/login      | Public   | Login                 |
| GET    | /api/auth/me         | Auth     | Current user profile  |

### Exams
| Method | Endpoint                   | Access          | Description              |
|--------|----------------------------|-----------------|--------------------------|
| GET    | /api/exams                 | Auth            | List exams               |
| GET    | /api/exams/:id             | Auth            | Get exam details         |
| POST   | /api/exams                 | Teacher/Admin   | Create exam              |
| PUT    | /api/exams/:id             | Teacher/Admin   | Update exam              |
| DELETE | /api/exams/:id             | Teacher/Admin   | Delete exam              |
| GET    | /api/exams/:id/students    | Teacher/Admin   | Students who attempted   |

### Questions
| Method | Endpoint                            | Access         | Description      |
|--------|-------------------------------------|----------------|------------------|
| GET    | /api/questions/:examId              | Auth           | List questions   |
| POST   | /api/questions/:examId              | Teacher/Admin  | Add question     |
| PUT    | /api/questions/:examId/:questionId  | Teacher/Admin  | Update question  |
| DELETE | /api/questions/:examId/:questionId  | Teacher/Admin  | Delete question  |

### Results
| Method | Endpoint                     | Access         | Description              |
|--------|------------------------------|----------------|--------------------------|
| POST   | /api/results/submit          | Student        | Submit exam answers      |
| GET    | /api/results/my              | Student        | My result history        |
| GET    | /api/results/:examId/:studentId | Auth        | Single result detail     |
| GET    | /api/results/exam/:examId    | Teacher/Admin  | All results for exam     |
| GET    | /api/results/export/:examId  | Teacher/Admin  | Export results as CSV    |

### Monitoring
| Method | Endpoint                        | Access        | Description             |
|--------|---------------------------------|---------------|-------------------------|
| POST   | /api/monitoring/log             | Student       | Log monitoring event    |
| GET    | /api/monitoring/:examId         | Teacher/Admin | View event logs         |
| GET    | /api/monitoring/summary/:examId | Teacher/Admin | Suspicious activity sum |

### Users
| Method | Endpoint              | Access        | Description          |
|--------|-----------------------|---------------|----------------------|
| GET    | /api/users            | Teacher/Admin | List users           |
| POST   | /api/users            | Admin         | Create user          |
| PUT    | /api/users/:id/toggle | Admin         | Toggle active status |
| DELETE | /api/users/:id        | Admin         | Delete user          |

---

## 🛡 Security Features

- **Helmet.js** — sets secure HTTP headers
- **bcryptjs** — password hashing (12 rounds)
- **JWT** — stateless auth tokens
- **Rate limiting** — 200 req/15min globally, 20 req/15min on auth routes
- **Role middleware** — strict teacher/student/admin separation
- **SQL injection prevention** — parameterised queries via mysql2
- **HTML escaping** — `escHtml()` used on all user-generated content in frontend

---

## 🎨 UI Highlights

- Responsive design (mobile-friendly)
- Clean sidebar + topbar layout for dashboards
- Color-coded badges (pass/fail, risk levels)
- Animated countdown timer (turns orange < 5 min, red < 1 min)
- Question navigation dots (filled when answered)
- Progress bar tracking answered questions
- Score circle with percentage visualization
- Webcam preview pinned to bottom-right during exam

---

## 📄 License

MIT – Free for educational and commercial use.