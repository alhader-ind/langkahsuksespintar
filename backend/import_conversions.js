const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, 'data/database.db');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(value => value.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    data.push(row);
  }
  return data;
}

async function importConversions(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    return;
  }

  const dataToImport = parseCSV(filePath);
  if (!dataToImport.length) {
    console.log('No data to import.');
    return;
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      return;
    }
    console.log('Connected to the SQLite database for import.');
  });

  // Use a promise to ensure all DB operations complete before closing
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      const selectStmt = db.prepare('SELECT total_conversion FROM conversions WHERE affiliate_id = ?');
      const insertStmt = db.prepare('INSERT INTO conversions (affiliate_id, total_conversion) VALUES (?, ?)');
      const updateStmt = db.prepare('UPDATE conversions SET total_conversion = ? WHERE affiliate_id = ?');

      for (const row of dataToImport) {
        const affiliateId = row.affiliate_id;
        const newConversionCount = parseInt(row.total_conversion, 10);

        if (!affiliateId || isNaN(newConversionCount)) {
          console.warn(`Skipping invalid row: ${JSON.stringify(row)}`);
          continue;
        }

        try {
          const existing = await new Promise((res, rej) => {
            selectStmt.get(affiliateId, (err, existingRow) => {
              if (err) rej(err);
              else res(existingRow);
            });
          });

          if (existing) {
            const updatedConversion = existing.total_conversion + newConversionCount;
            await new Promise((res, rej) => {
              updateStmt.run(updatedConversion, affiliateId, function(err) {
                if (err) rej(err);
                else {
                  console.log(`Updated conversions for ${affiliateId} to ${updatedConversion}.`);
                  res();
                }
              });
            });
          } else {
            await new Promise((res, rej) => {
              insertStmt.run(affiliateId, newConversionCount, function(err) {
                if (err) rej(err);
                else {
                  console.log(`Inserted new conversion for ${affiliateId}: ${newConversionCount}.`);
                  res();
                }
              });
            });
          }
        } catch (err) {
          console.error(`Error processing row for ${affiliateId}:`, err.message);
          // Continue with next row
        }
      }

      selectStmt.finalize();
      insertStmt.finalize();
      updateStmt.finalize();

      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
          reject(err);
        } else {
          console.log('Database connection closed. Import complete.');
          resolve();
        }
      });
    });
  }).catch(err => {
      console.error("Error during database operations:", err);
      if (db && db.open) { // Ensure db is closed on error too
          db.close();
      }
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.log('Usage: node import_conversions.js <path/to/your_data.csv>');
    process.exit(1);
  }
  const filePath = args[0];
  importConversions(path.resolve(filePath));
}

module.exports = { importConversions, parseCSV };
