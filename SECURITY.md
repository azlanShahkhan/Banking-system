# Security Documentation - Banking System

This document outlines all security features implemented in the banking system.

## 1. Password Security ✓

### Hashing
- **Algorithm**: bcryptjs with 10 rounds (configurable via `BCRYPT_ROUNDS` in .env)
- **Cost Factor**: 10 (takes approximately 1 second per hash)
- **Implementation**: All passwords are hashed before storage

```javascript
const hashedPassword = bcrypt.hashSync(password, BCRYPT_ROUNDS);
```

### Validation
- **Minimum Length**: 8 characters (configurable via `PASSWORD_MIN_LENGTH`)
- **Validation Check**: Ensures passwords meet minimum complexity requirements
- **Comparison**: Safe comparison using `bcryptjs.compareSync()` to prevent timing attacks

---

## 2. Authentication & Authorization ✓

### JWT (JSON Web Tokens)
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Secret Key**: Environment variable `JWT_SECRET` (must be 32+ characters in production)
- **Expiration**: 24 hours (configurable via `JWT_EXPIRY`)
- **Token Structure**: Contains userId and username

```javascript
const token = jwt.sign(
  { userId: user.id, username: user.username },
  SECRET_KEY,
  { expiresIn: process.env.JWT_EXPIRY || '24h' }
);
```

### Protected Routes
All API endpoints (except /register and /login) require valid JWT token:

```javascript
app.get('/api/accounts', authenticate, (req, res) => { ... });
```

### Token Validation
- Verifies token signature
- Checks expiration
- Returns 401 Unauthorized if token is invalid or expired

---

## 3. Rate Limiting ✓

### Global Rate Limiting
- **Window**: 15 minutes
- **Max Requests**: 100 per window
- **Applied To**: All `/api/` endpoints

### Authentication Rate Limiting
- **Stricter Limits**: 5 login/register attempts per 15 minutes
- **Skip Successful**: Only counts failed attempts
- **Purpose**: Prevents brute force attacks

```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});
```

---

## 4. Database Security ✓

### Schema Constraints
- **Foreign Keys**: Enabled and enforced
- **Cascading Deletes**: ON DELETE CASCADE to maintain data integrity
- **Check Constraints**: 
  - Username: 3-20 characters
  - Email: Must contain @ and domain
  - Password: Minimum 60 characters (bcrypt hash length)
  - Balance: Cannot be negative
  - Amount: Must be positive

### Database Indexes
- `idx_users_username`: Fast username lookups
- `idx_users_email`: Fast email lookups
- `idx_accounts_user_id`: Fast account retrieval
- `idx_transactions_account_id`: Fast transaction queries
- `idx_transfers_from_account_id`: Transfer lookups
- `idx_login_attempts_created_at`: Audit trail queries

### Parameterized Queries
All database queries use parameterized statements to prevent SQL injection:

```javascript
db.get('SELECT * FROM users WHERE username = ?', [username], callback);
```

---

## 5. API Security ✓

### Helmet.js
- **Purpose**: Sets various HTTP security headers
- **Headers Protected**:
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security

```javascript
app.use(helmet());
```

### CORS (Cross-Origin Resource Sharing)
- **Configurable Origins**: Via `CORS_ORIGIN` in .env
- **Credentials**: Enabled for authenticated requests
- **Default**: Allows localhost on ports 3000, 8000, 5173

```javascript
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  credentials: true
}));
```

### Input Validation

#### Username Validation
```javascript
validateUsername(username) => /^[a-zA-Z0-9_-]{3,20}$/.test(username)
```
- 3-20 characters
- Alphanumeric, dash, underscore only

#### Email Validation
```javascript
validateEmail(email) => validator.isEmail(email)
```
- RFC 5322 compliant validation

#### Password Validation
```javascript
validatePassword(password) => password.length >= PASSWORD_MIN_LENGTH
```

---

## 6. Error Handling ✓

### Information Disclosure Prevention
- **Login Failures**: Returns generic "Invalid credentials" message
- **User Existence**: Does not reveal if username/email exists
- **Production Mode**: Error messages are generic; detailed logs only in development

```javascript
if (!user) {
  return res.status(401).json({ error: 'Invalid credentials' });
}
```

### Global Error Handler
- Catches unhandled errors
- Prevents stack traces from leaking in production
- Logs errors for debugging

---

## 7. Request Body Limits ✓

- **JSON Limit**: 10MB (prevents DoS attacks via large payloads)
- **URL Encoded Limit**: 10MB

```javascript
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
```

---

## 8. Transaction Security ✓

### Balance Verification
- Withdrawal requests check available balance before processing
- Prevents negative balances

```javascript
if (account.balance < amount) {
  return res.status(400).json({ error: 'Insufficient funds' });
}
```

### Data Consistency
- Transactions are recorded after balance updates
- Account ID verification ensures users can only access their accounts

```javascript
db.get(
  'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
  [account_id, req.userId],
  (err, account) => { ... }
);
```

---

## 9. Audit Logging ✓

### Login Attempts Table
- Tracks all login attempts (successful and failed)
- Records username, IP address, user agent
- Enables detection of suspicious activities

```sql
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  success BOOLEAN DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. Environment Configuration ✓

### .env File
Sensitive configuration stored in environment variables:

```env
JWT_SECRET=your-secret-key-min-32-chars
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
BCRYPT_ROUNDS=10
```

### Security Best Practices
- Never commit `.env` to version control
- Use `.env.example` as a template
- Rotate secrets regularly in production
- Use strong, random secrets (32+ characters)

---

## 11. Authorization Checks ✓

### User-Scoped Queries
All queries verify that the requested resource belongs to the authenticated user:

```javascript
// Only get accounts belonging to current user
db.get(
  'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
  [account_id, req.userId],
  callback
);
```

### Transfer Validation
- Prevents transfers between accounts unless authorized
- Checks sufficient balance before allowing transfers

---

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET` (32+ random characters)
- [ ] Update `CORS_ORIGIN` to match your frontend domain
- [ ] Use HTTPS/TLS for all connections
- [ ] Configure database backups
- [ ] Set up proper logging and monitoring
- [ ] Enable firewall rules
- [ ] Rotate secrets regularly
- [ ] Keep dependencies updated (`npm audit fix`)
- [ ] Set up rate limiting rules for production loads
- [ ] Enable HTTPS-only cookies
- [ ] Use environment-specific configuration

---

## Known Limitations & Future Improvements

1. **No 2FA**: Implement two-factor authentication
2. **No Session Management**: Add session timeout and refresh tokens
3. **No Audit Log Export**: Implement transaction export functionality
4. **No Device Management**: Add device tracking and approval
5. **No Encryption at Rest**: Consider encrypting sensitive data in DB
6. **No IP Whitelisting**: Add optional IP restriction for accounts
7. **No Account Lockout**: Implement lockout after multiple failed attempts

---

## Compliance Notes

This implementation follows:
- OWASP Top 10 prevention measures
- NIST Password Guidelines (minimum requirements)
- RESTful API security best practices
- Banking industry standards for basic security

---

## Support & Questions

For security questions or to report vulnerabilities:
1. Do not disclose publicly
2. Contact development team privately
3. Allow reasonable time for patching
