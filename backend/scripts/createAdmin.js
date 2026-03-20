'use strict';

require('dotenv').config();

const bcrypt = require('bcryptjs');
const db     = require('../config/db');

async function createAdmin() {
  const name     = process.env.ADMIN_NAME     || 'Administrator';
  const email    = process.env.ADMIN_EMAIL    || 'admin@exam.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const role     = 'admin';

  try {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
      console.log(`Admin account already exists for ${email}.`);
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, role]
    );

    console.log(`✅  Admin account created:`);
    console.log(`    Email   : ${email}`);
    console.log(`    Password: ${password}`);
    console.log(`    Role    : ${role}`);
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err.message);
    process.exit(1);
  }
}

createAdmin();
