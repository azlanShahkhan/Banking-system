const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./banking.db');

// Check current balances
db.all(`SELECT accounts.id, accounts.account_number, accounts.balance, users.username 
        FROM accounts 
        JOIN users ON accounts.user_id = users.id`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Current Accounts:');
    console.log(JSON.stringify(rows, null, 2));
    
    // Update all accounts with balance 0 or 1 to 10
    db.run(`UPDATE accounts SET balance = 10 WHERE balance <= 1`, function(err) {
      if (err) {
        console.error('Error updating:', err);
      } else {
        console.log(`\nUpdated ${this.changes} account(s) to $10.00`);
        
        // Show updated balances
        db.all(`SELECT accounts.id, accounts.account_number, accounts.balance, users.username 
                FROM accounts 
                JOIN users ON accounts.user_id = users.id`, (err, rows) => {
          if (!err) {
            console.log('\nUpdated Accounts:');
            console.log(JSON.stringify(rows, null, 2));
          }
          db.close();
        });
      }
    });
  }
});
