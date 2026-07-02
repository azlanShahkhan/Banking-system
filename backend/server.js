const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const helmet = require('helmet');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;
const PASSWORD_MIN_LENGTH = parseInt(process.env.PASSWORD_MIN_LENGTH) || 8;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

app.use('/api/', limiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

// Authentication middleware with enhanced error handling
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid authorization format' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Input validation helpers
const validateEmail = (email) => validator.isEmail(email);
const validateUsername = (username) => /^[a-zA-Z0-9_-]{3,20}$/.test(username);
const validatePassword = (password) => password.length >= PASSWORD_MIN_LENGTH;

// Helper function to generate account number
function generateAccountNumber() {
  return 'ACC' + Math.random().toString(36).substring(2, 15).toUpperCase();
}

// ============= AUTHENTICATION ROUTES =============

// Register with enhanced validation
app.post('/api/register', (req, res) => {
  const { username, email, password, full_name, phone, address } = req.body;

  // Validation
  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters (alphanumeric, dash, underscore)' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
  }

  if (full_name.trim().length < 2) {
    return res.status(400).json({ error: 'Full name must be at least 2 characters' });
  }

  const hashedPassword = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  db.run(
    `INSERT INTO users (username, email, password, full_name, phone, address) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [username, email, hashedPassword, full_name, phone || null, address || null],
    function (err) {
      if (err) {
        return res.status(400).json({ error: 'User already exists or invalid data' });
      }

      const accountNumber = generateAccountNumber();
      db.run(
        `INSERT INTO accounts (user_id, account_number, account_type, balance) 
         VALUES (?, ?, ?, ?)`,
        [this.lastID, accountNumber, 'Checking', 10],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to create account' });
          }
          res.json({ message: 'User registered successfully' });
        }
      );
    }
  );
});

// Login with enhanced security
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      SECRET_KEY,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.json({
      token,
      userId: user.id,
      username: user.username,
      full_name: user.full_name
    });
  });
});

// ============= ADMIN ROUTES =============

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  if (name === process.env.ADMIN_NAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { adminId: 'admin', role: 'admin' },
      SECRET_KEY,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.json({
      token,
      message: 'Admin login successful',
      adminName: name
    });
  } else {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
});

// Admin verify token
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid authorization format' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Not an admin token' });
    }
    req.adminId = decoded.adminId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get admin dashboard stats
app.get('/api/admin/dashboard', authenticateAdmin, (req, res) => {
  db.serialize(() => {
    const stats = {};

    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch user count' });
      }
      stats.totalUsers = result.count;

      db.get('SELECT COUNT(*) as count FROM accounts', [], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch account count' });
        }
        stats.totalAccounts = result.count;

        db.get('SELECT SUM(balance) as total FROM accounts', [], (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to fetch total balance' });
          }
          stats.totalBalance = result.total || 0;

          db.get('SELECT COUNT(*) as count FROM transactions', [], (err, result) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to fetch transaction count' });
            }
            stats.totalTransactions = result.count;

            res.json(stats);
          });
        });
      });
    });
  });
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
  db.all('SELECT id, username, email, full_name, phone, address, created_at FROM users LIMIT 100', [], (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(users);
  });
});

// Get all accounts (admin only)
app.get('/api/admin/accounts', authenticateAdmin, (req, res) => {
  db.all(
    'SELECT a.id, a.user_id, a.account_number, a.account_type, a.balance, u.username, u.full_name FROM accounts a JOIN users u ON a.user_id = u.id LIMIT 100',
    [],
    (err, accounts) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch accounts' });
      }
      res.json(accounts);
    }
  );
});

// Get all transactions (admin only)
app.get('/api/admin/transactions', authenticateAdmin, (req, res) => {
  db.all(
    'SELECT t.*, a.account_number FROM transactions t JOIN accounts a ON t.account_id = a.id ORDER BY t.created_at DESC LIMIT 100',
    [],
    (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch transactions' });
      }
      res.json(transactions);
    }
  );
});

// ============= USER ROUTES =============

// Get user profile
app.get('/api/user/profile', authenticate, (req, res) => {
  db.get('SELECT id, username, email, full_name, phone, address, created_at FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

// Update user profile
app.put('/api/user/profile', authenticate, (req, res) => {
  const { full_name, phone, address } = req.body;

  if (full_name && full_name.trim().length < 2) {
    return res.status(400).json({ error: 'Full name must be at least 2 characters' });
  }

  db.run(
    'UPDATE users SET full_name = ?, phone = ?, address = ? WHERE id = ?',
    [full_name, phone, address, req.userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update profile' });
      }
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

// ============= ACCOUNT ROUTES =============

// Get all accounts for user
app.get('/api/accounts', authenticate, (req, res) => {
  db.all(
    'SELECT * FROM accounts WHERE user_id = ? AND is_active = 1',
    [req.userId],
    (err, accounts) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch accounts' });
      }
      res.json(accounts);
    }
  );
});

// Create new account
app.post('/api/accounts', authenticate, (req, res) => {
  const { account_type } = req.body;

  if (!account_type) {
    return res.status(400).json({ error: 'Missing account type' });
  }

  const validTypes = ['Checking', 'Savings', 'Business'];
  if (!validTypes.includes(account_type)) {
    return res.status(400).json({ error: 'Invalid account type' });
  }

  const accountNumber = generateAccountNumber();
  db.run(
    `INSERT INTO accounts (user_id, account_number, account_type, balance) 
     VALUES (?, ?, ?, ?)`,
    [req.userId, accountNumber, account_type, 0],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create account' });
      }
      res.json({ id: this.lastID, account_number: accountNumber, account_type, balance: 0 });
    }
  );
});

// Get account details
app.get('/api/accounts/:accountId', authenticate, (req, res) => {
  const accountId = parseInt(req.params.accountId);
  if (isNaN(accountId)) {
    return res.status(400).json({ error: 'Invalid account ID' });
  }

  db.get(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
    [accountId, req.userId],
    (err, account) => {
      if (err || !account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json(account);
    }
  );
});

// ============= TRANSACTION ROUTES =============

// Deposit
app.post('/api/transactions/deposit', authenticate, (req, res) => {
  const { account_id, amount, description } = req.body;

  if (!account_id || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid account or amount' });
  }

  const accountId = parseInt(account_id);
  const depositAmount = parseFloat(amount);

  if (isNaN(accountId) || isNaN(depositAmount) || depositAmount > 1000000) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  db.serialize(() => {
    db.get(
      'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
      [accountId, req.userId],
      (err, account) => {
        if (err || !account) {
          return res.status(404).json({ error: 'Account not found' });
        }

        const newBalance = account.balance + depositAmount;

        db.run('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, accountId], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update balance' });
          }

          db.run(
            `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after) 
             VALUES (?, ?, ?, ?, ?)`,
            [accountId, 'Deposit', depositAmount, description || 'Deposit', newBalance],
            function (err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to record transaction' });
              }
              res.json({ message: 'Deposit successful', new_balance: newBalance, transaction_id: this.lastID });
            }
          );
        });
      }
    );
  });
});

// Withdraw
app.post('/api/transactions/withdraw', authenticate, (req, res) => {
  const { account_id, amount, description } = req.body;

  if (!account_id || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid account or amount' });
  }

  const accountId = parseInt(account_id);
  const withdrawAmount = parseFloat(amount);

  if (isNaN(accountId) || isNaN(withdrawAmount) || withdrawAmount > 1000000) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' });
  }

  db.get(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
    [accountId, req.userId],
    (err, account) => {
      if (err || !account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      if (account.balance < withdrawAmount) {
        return res.status(400).json({ error: 'Insufficient funds' });
      }

      const newBalance = account.balance - withdrawAmount;

      db.run('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, accountId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update balance' });
        }

        db.run(
          `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after) 
           VALUES (?, ?, ?, ?, ?)`,
          [accountId, 'Withdrawal', withdrawAmount, description || 'Withdrawal', newBalance],
          function (err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to record transaction' });
            }
            res.json({ message: 'Withdrawal successful', new_balance: newBalance, transaction_id: this.lastID });
          }
        );
      });
    }
  );
});

// Get transaction history
app.get('/api/transactions/:accountId', authenticate, (req, res) => {
  const accountId = parseInt(req.params.accountId);
  if (isNaN(accountId)) {
    return res.status(400).json({ error: 'Invalid account ID' });
  }

  db.all(
    `SELECT * FROM transactions 
     WHERE account_id = ? AND account_id IN 
     (SELECT id FROM accounts WHERE user_id = ?)
     ORDER BY created_at DESC LIMIT 50`,
    [accountId, req.userId],
    (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch transactions' });
      }
      res.json(transactions);
    }
  );
});

// ============= TRANSFER ROUTES =============

// Transfer between accounts
app.post('/api/transfers', authenticate, (req, res) => {
  const { from_account_id, to_account_number, to_account_id, amount, description } = req.body;

  if (!from_account_id || (!to_account_number && !to_account_id) || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid transfer details' });
  }

  const fromAccountId = parseInt(from_account_id);
  const transferAmount = parseFloat(amount);

  if (isNaN(fromAccountId) || isNaN(transferAmount) || transferAmount > 1000000) {
    return res.status(400).json({ error: 'Invalid transfer amount' });
  }

  db.serialize(() => {
    db.get(
      'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
      [fromAccountId, req.userId],
      (err, fromAccount) => {
        if (err || !fromAccount) {
          return res.status(404).json({ error: 'From account not found' });
        }

        if (fromAccount.balance < transferAmount) {
          return res.status(400).json({ error: 'Insufficient funds' });
        }

        // Look up recipient account by account number or ID
        let recipientQuery = '';
        let recipientParams = [];
        
        if (to_account_number) {
          recipientQuery = 'SELECT * FROM accounts WHERE account_number = ?';
          recipientParams = [to_account_number];
        } else {
          recipientQuery = 'SELECT * FROM accounts WHERE id = ?';
          recipientParams = [parseInt(to_account_id)];
        }

        db.get(recipientQuery, recipientParams, (err, toAccount) => {
          if (err || !toAccount) {
            return res.status(404).json({ error: 'Recipient account not found' });
          }

          const toAccountId = toAccount.id;

          if (fromAccountId === toAccountId) {
            return res.status(400).json({ error: 'Cannot transfer to the same account' });
          }

          const fromNewBalance = fromAccount.balance - transferAmount;
          const toNewBalance = toAccount.balance + transferAmount;

          db.run('UPDATE accounts SET balance = ? WHERE id = ?', [fromNewBalance, fromAccountId], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to update balances' });
            }

            db.run('UPDATE accounts SET balance = ? WHERE id = ?', [toNewBalance, toAccountId], (err) => {
              if (err) {
                return res.status(500).json({ error: 'Failed to update balances' });
              }

              db.run(
                `INSERT INTO transfers (from_account_id, to_account_id, amount, description) 
                 VALUES (?, ?, ?, ?)`,
                [fromAccountId, toAccountId, transferAmount, description || 'Transfer'],
                function (err) {
                  if (err) {
                    return res.status(500).json({ error: 'Failed to record transfer' });
                  }

                  db.run(
                    `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [fromAccountId, 'Transfer Out', transferAmount, description || 'Transfer', fromNewBalance],
                    () => {
                      db.run(
                        `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [toAccountId, 'Transfer In', transferAmount, description || 'Transfer', toNewBalance],
                        () => {
                          res.json({
                            message: 'Transfer successful',
                            transfer_id: this.lastID,
                            from_new_balance: fromNewBalance,
                            to_new_balance: toNewBalance
                          });
                        }
                      );
                    }
                  );
                }
              );
            });
          });
        });
      }
    );
  });
});

// Get transfer history
app.get('/api/transfers/:accountId', authenticate, (req, res) => {
  const accountId = parseInt(req.params.accountId);
  if (isNaN(accountId)) {
    return res.status(400).json({ error: 'Invalid account ID' });
  }

  db.all(
    `SELECT * FROM transfers 
     WHERE (from_account_id = ? OR to_account_id = ?) AND 
     (from_account_id IN (SELECT id FROM accounts WHERE user_id = ?) OR 
      to_account_id IN (SELECT id FROM accounts WHERE user_id = ?))
     ORDER BY created_at DESC LIMIT 50`,
    [accountId, accountId, req.userId, req.userId],
    (err, transfers) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch transfers' });
      }
      res.json(transfers);
    }
  );
});

// ============= ERROR HANDLING =============

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ============= START SERVER =============

app.listen(PORT, () => {
  console.log(`Banking System API running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Rate limiting: ${process.env.RATE_LIMIT_MAX_REQUESTS || 100} requests per ${parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000) / 60000} minutes`);
});

module.exports = app;
