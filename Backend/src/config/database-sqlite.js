const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Create database directory if it doesn't exist
const fs = require('fs');
const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'dayflow_hrms.db');

class SQLitePool {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        // Enable foreign keys
        this.db.run('PRAGMA foreign_keys = ON');
      }
    });
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({ rows });
          }
        });
      } else {
        this.db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              rows: [], 
              rowCount: this.changes,
              insertId: this.lastID 
            });
          }
        });
      }
    });
  }

  async end() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        }
        resolve();
      });
    });
  }
}

const pool = new SQLitePool();

module.exports = pool;