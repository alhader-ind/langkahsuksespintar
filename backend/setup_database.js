const sqlite3 = require('sqlite3').verbose();
const path =require('path');
const dbPath = path.join(__dirname, 'data/database.db');
const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
if (!require('fs').existsSync(dataDir)){
    require('fs').mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    createTables();
  }
});

function createTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS affiliate_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_url TEXT NOT NULL,
        unique_code TEXT NOT NULL UNIQUE,
        affiliate_id TEXT
      )
    `, (err) => {
      if (err) console.error('Error creating affiliate_links table:', err.message);
      else console.log('affiliate_links table created or already exists.');
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS click_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id INTEGER,
        ip_address TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(link_id) REFERENCES affiliate_links(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('Error creating click_logs table:', err.message);
      else console.log('click_logs table created or already exists.');
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        affiliate_id TEXT NOT NULL UNIQUE,
        total_conversion INTEGER NOT NULL
      )
    `, (err) => { // Made affiliate_id UNIQUE for upsert logic simplicity later
      if (err) console.error('Error creating conversions table:', err.message);
      else console.log('conversions table created or already exists.');
    });

    db.close((err) => {
      if (err) console.error('Error closing database:', err.message);
      else console.log('Database connection closed after setup.');
    });
  });
}
