const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.join(__dirname, process.env.DB_PATH || 'banking.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at', dbPath);
    initializeDatabase();
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

function initializeDatabase() {
  db.serialize(() => {
    // Users table with constraints
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL CHECK(LENGTH(username) >= 3 AND LENGTH(username) <= 20),
        email TEXT UNIQUE NOT NULL CHECK(email LIKE '%@%.%'),
        password TEXT NOT NULL CHECK(LENGTH(password) >= 60),
        full_name TEXT NOT NULL CHECK(LENGTH(full_name) >= 2),
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Create index on username for faster lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

    // Accounts table with constraints
    db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL CHECK(user_id > 0),
        account_number TEXT UNIQUE NOT NULL,
        account_type TEXT DEFAULT 'Checking' CHECK(account_type IN ('Checking', 'Savings', 'Business')),
        balance REAL DEFAULT 0 CHECK(balance >= 0),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number)`);

    // Transactions table with audit trail
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL CHECK(account_id > 0),
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('Deposit', 'Withdrawal', 'Transfer In', 'Transfer Out')),
        amount REAL NOT NULL CHECK(amount > 0),
        description TEXT,
        balance_after REAL NOT NULL CHECK(balance_after >= 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC)`);

    // Transfers table with audit trail
    db.run(`
      CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_account_id INTEGER NOT NULL CHECK(from_account_id > 0),
        to_account_id INTEGER NOT NULL CHECK(to_account_id > 0),
        amount REAL NOT NULL CHECK(amount > 0),
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY(to_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        CHECK(from_account_id != to_account_id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_transfers_from_account_id ON transfers(from_account_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transfers_to_account_id ON transfers(to_account_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON transfers(created_at DESC)`);

    // Login attempts table for tracking suspicious activity
    db.run(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        success BOOLEAN DEFAULT 0,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC)`);

    console.log('Database tables initialized successfully');
  });
}

module.exports = db;
