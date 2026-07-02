# Banking System

A fully functional banking system with user authentication, account management, transactions, and fund transfers.

## Features

- **User Authentication**: Register and login with secure password hashing
- **Multiple Accounts**: Create and manage multiple bank accounts (Checking, Savings, Business)
- **Deposits & Withdrawals**: Add or remove funds from accounts
- **Fund Transfers**: Transfer money between your accounts
- **Transaction History**: View all transactions for each account
- **Profile Management**: Update personal information
- **Real-time Balance**: See account balances in real-time
- **Account Types**: Support for Checking, Savings, and Business accounts

## Project Structure

```
Banking system/
├── backend/
│   ├── server.js          # Express server and API endpoints
│   ├── database.js        # SQLite database setup
│   ├── package.json       # Node.js dependencies
│   └── banking.db         # SQLite database (created on first run)
├── frontend/
│   └── index.html         # Complete frontend UI with embedded CSS and JavaScript
└── README.md
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The API will run on `http://localhost:5000`

### Frontend Setup

1. Open the frontend in a browser:
```bash
# Simply open the frontend/index.html file in your web browser
# Or use a local server:
cd frontend
python -m http.server 8000
# Then visit http://localhost:8000
```

## Usage

### Getting Started

1. Open the banking system in your browser
2. Create a new account by clicking "Register here"
3. Fill in your details and register
4. A default Checking account will be automatically created
5. Log in with your credentials

### Main Features

#### Accounts Tab
- View all your accounts with balances
- Create new accounts
- Deposit funds
- Withdraw funds

#### Transactions Tab
- Select an account to view its transaction history
- See all deposits, withdrawals, and transfers
- View transaction dates and amounts

#### Transfers Tab
- Transfer money between your accounts
- Enter the destination account ID
- Specify the amount and optional description

#### Profile Tab
- View your personal information
- Edit your profile details
- Update phone number and address

## API Endpoints

### Authentication
- `POST /api/register` - Register a new user
- `POST /api/login` - Login user

### User
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

### Accounts
- `GET /api/accounts` - Get all user accounts
- `POST /api/accounts` - Create new account
- `GET /api/accounts/:accountId` - Get account details

### Transactions
- `POST /api/transactions/deposit` - Deposit funds
- `POST /api/transactions/withdraw` - Withdraw funds
- `GET /api/transactions/:accountId` - Get transaction history

### Transfers
- `POST /api/transfers` - Transfer between accounts
- `GET /api/transfers/:accountId` - Get transfer history

## Security Features

- Password hashing with bcryptjs
- JWT token-based authentication
- Authorization middleware for protected routes
- SQL database with proper schema

## Default Behavior

- New users automatically get a "Checking" account on registration
- All balances default to $0
- Transactions are recorded in real-time
- Insufficient balance check on withdrawals

## Demo Credentials

After registration, you can use any created account to test the system.

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Security**: bcryptjs (password hashing), JWT (authentication)
- **Frontend**: HTML, CSS, JavaScript (Vanilla)

## Notes

- The database file (`banking.db`) is created automatically on first run
- All data is stored locally in SQLite
- The system is designed for local development/testing
- For production, consider using a more robust database and implementing additional security measures

## Future Enhancements

- Bill payment system
- Recurring transfers
- Account statements export
- Multi-currency support
- Mobile app version
- Advanced reporting and analytics

## License

MIT
