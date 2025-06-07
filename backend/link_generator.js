const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'data/database.db');

// Function to generate a unique alphanumeric code
function generateUniqueCode(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Function to check if a code is unique in the database
async function isCodeUnique(code, db) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM affiliate_links WHERE unique_code = ?', [code], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(!row); // True if row is undefined (code is unique)
      }
    });
  });
}

// Main function to create an affiliate link
async function createAffiliateLink(targetUrl, affiliateId = null) {
  if (!targetUrl) {
    throw new Error('Target URL is required.');
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) throw new Error(`Error opening database for link creation: ${err.message}`);
  });

  let uniqueCode;
  let codeIsUnique = false;
  let retries = 10; // Max retries to find a unique code to prevent infinite loop

  while (!codeIsUnique && retries > 0) {
    uniqueCode = generateUniqueCode();
    try {
      // Pass the opened db instance to isCodeUnique
      codeIsUnique = await isCodeUnique(uniqueCode, db);
    } catch (error) {
      console.error('Error checking code uniqueness:', error);
      db.close(); // Close DB if error occurs here
      throw new Error('Failed to verify code uniqueness due to DB error.');
    }
    retries--;
  }

  if (!codeIsUnique) {
    db.close();
    throw new Error('Failed to generate a unique code after multiple attempts.');
  }

  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO affiliate_links (target_url, unique_code, affiliate_id) VALUES (?, ?, ?)');
    stmt.run(targetUrl, uniqueCode, affiliateId, function (err) {
      stmt.finalize((finalizeErr) => {
        if (finalizeErr) console.error('Error finalizing statement:', finalizeErr.message);
        db.close((closeErr) => {
          if (closeErr) console.error('Error closing database after insert:', closeErr.message);
        });
      });

      if (err) {
        reject(new Error(`Failed to save affiliate link: ${err.message}`));
      } else {
        const domain = process.env.APP_DOMAIN || 'http://localhost:3000';
        resolve({
          id: this.lastID, // Return the ID of the newly inserted row
          target_url: targetUrl,
          unique_code: uniqueCode,
          affiliate_id: affiliateId,
          full_affiliate_link: `${domain}/go?code=${uniqueCode}`
        });
      }
    });
  });
}

module.exports = { createAffiliateLink };

// Example usage (can be run with `node link_generator.js`)
async function main() {
  try {
    console.log('Attempting to generate link 1...');
    const link1 = await createAffiliateLink('https://google.com', 'user123');
    console.log('Generated link 1:', link1);

    console.log('Attempting to generate link 2...');
    const link2 = await createAffiliateLink('https://bing.com');
    console.log('Generated link 2:', link2);
  } catch (error) {
    console.error('Error in example usage of link generator:', error.message);
  }
}

if (require.main === module) {
  // Ensure DB is setup for example, or this will fail if links table doesn't exist
  const db = new sqlite3.Database(dbPath);
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='affiliate_links'", async (err, table) => {
    if (err || !table) {
        console.error("Error: affiliate_links table does not exist. Run setup_database.js first.");
        db.close();
        return;
    }
    db.close(() => main()); // Close and then run main
  });
}
