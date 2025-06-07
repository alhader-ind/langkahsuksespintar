const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'data/database.db');

/**
 * Calculates unique clicks for a given link ID on a specific date.
 * @param {number} linkId - The ID of the affiliate link.
 * @param {string} date - The date in 'YYYY-MM-DD' format.
 * @returns {Promise<number>} - The count of unique IP addresses.
 */
function getUniqueClicksPerLink(linkId, date) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(new Error(`Error opening database: ${err.message}`));
    });

    // Date is YYYY-MM-DD. We need to match timestamps that start with this date.
    const query = `
      SELECT COUNT(DISTINCT ip_address) AS unique_clicks
      FROM click_logs
      WHERE link_id = ? AND strftime('%Y-%m-%d', timestamp) = ?
    `;

    db.get(query, [linkId, date], (err, row) => {
      db.close((closeErr) => {
        if (closeErr) console.error('Error closing DB after getUniqueClicksPerLink:', closeErr.message);
      });
      if (err) {
        reject(new Error(`Error querying unique clicks: ${err.message}`));
      } else {
        resolve(row ? row.unique_clicks : 0);
      }
    });
  });
}

/**
 * Retrieves total conversion data for a given affiliate ID.
 * @param {string} affiliateId - The ID of the affiliate.
 * @returns {Promise<number>} - The total number of conversions.
 */
function getConversionData(affiliateId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(new Error(`Error opening database: ${err.message}`));
    });

    const query = `
      SELECT total_conversion
      FROM conversions
      WHERE affiliate_id = ?
    `;

    db.get(query, [affiliateId], (err, row) => {
      db.close((closeErr) => {
        if (closeErr) console.error('Error closing DB after getConversionData:', closeErr.message);
      });
      if (err) {
        reject(new Error(`Error querying conversions: ${err.message}`));
      } else {
        resolve(row ? row.total_conversion : 0);
      }
    });
  });
}

module.exports = {
  getUniqueClicksPerLink,
  getConversionData
};

// Example Usage (Can be run with `node analytics.js`)
async function runExamples() {
  console.log("Running analytics examples...");
  try {
    // To make these examples work, we'd need some data.
    // Assume link_id 1 exists from link_generator.js and affiliate_id 'user123' has conversions.
    // And that there are clicks for today.

    // Create dummy data for testing if database is empty
    const db = new sqlite3.Database(dbPath);
    await new Promise((res, rej) => {
        db.serialize(() => {
            db.run("INSERT OR IGNORE INTO affiliate_links (id, target_url, unique_code, affiliate_id) VALUES (1, 'http://example.com', 'DUMMYCD1', 'user123')", err => { if(err) console.warn("Error inserting dummy link", err.message)});
            db.run("INSERT OR IGNORE INTO click_logs (link_id, ip_address, timestamp) VALUES (1, '192.168.1.1', date('now'))",  err => { if(err) console.warn("Error inserting dummy click1", err.message)});
            db.run("INSERT OR IGNORE INTO click_logs (link_id, ip_address, timestamp) VALUES (1, '192.168.1.2', date('now'))",  err => { if(err) console.warn("Error inserting dummy click2", err.message)});
            db.run("INSERT OR IGNORE INTO click_logs (link_id, ip_address, timestamp) VALUES (1, '192.168.1.1', date('now', '-1 day'))",  err => { if(err) console.warn("Error inserting dummy click3", err.message)});
            db.run("INSERT OR IGNORE INTO conversions (affiliate_id, total_conversion) VALUES ('user123', 50)",  err => { if(err) console.warn("Error inserting dummy conversion", err.message)});
            db.run("INSERT OR IGNORE INTO conversions (affiliate_id, total_conversion) VALUES ('user456', 30)",  err => { if(err) console.warn("Error inserting dummy conversion2", err.message)}, () => res()); // Resolve on last one
        });
    });
    db.close();


    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log(`Getting unique clicks for link ID 1 on ${today}...`);
    const uniqueClicksToday = await getUniqueClicksPerLink(1, today);
    console.log(`Unique clicks for link ID 1 on ${today}:`, uniqueClicksToday);

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    console.log(`Getting unique clicks for link ID 1 on ${yesterday}...`);
    const uniqueClicksYesterday = await getUniqueClicksPerLink(1, yesterday);
    console.log(`Unique clicks for link ID 1 on ${yesterday}:`, uniqueClicksYesterday);


    console.log("Getting conversion data for affiliate 'user123'...");
    const conversionsUser123 = await getConversionData('user123');
    console.log("Conversions for 'user123':", conversionsUser123);

    console.log("Getting conversion data for affiliate 'user_nonexistent'...");
    const conversionsNonExistent = await getConversionData('user_nonexistent');
    console.log("Conversions for 'user_nonexistent':", conversionsNonExistent);

  } catch (error) {
    console.error("Error running analytics examples:", error.message);
  }
}

if (require.main === module) {
  runExamples();
}
