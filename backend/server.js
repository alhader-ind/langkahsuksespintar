const http = require('http');
const url = require('url');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const { createAffiliateLink } = require('./link_generator');
const { getUniqueClicksPerLink, getConversionData } = require('./analytics');
const { verifyPassword } = require('./auth');

const dbPath = path.join(__dirname, 'data/database.db');
const PORT = process.env.PORT || 3000;
const DEFAULT_ERROR_REDIRECT_URL = process.env.ERROR_REDIRECT_URL || 'http://localhost:4321/error';

// Helper function to send JSON responses
function sendJSONResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Helper to parse JSON body
function parseJsonBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            const parsedBody = JSON.parse(body);
            callback(null, parsedBody);
        } catch (e) {
            callback(e, null);
        }
    });
    req.on('error', (err) => {
        callback(err, null);
    });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);
  const pathname = reqUrl.pathname;
  const method = req.method;

  // Logging for each request
  console.log(`Request: ${method} ${pathname}`);

  // Existing /go redirector
  if (pathname === '/go' && method === 'GET' && reqUrl.query.code) {
    const uniqueCode = reqUrl.query.code;
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('Error opening database for /go endpoint:', err.message);
        return sendJSONResponse(res, 500, { success: false, message: 'Internal Server Error' });
      }
    });

    let dbClosed = false;
    const ensureDbClose = (context) => {
        if (db && !dbClosed && db.open) {
            db.close(err => { if (err) console.error(`Error closing DB in /go ${context}:`, err.message); dbClosed = true; });
        }
    };

    try {
      const linkQuery = 'SELECT id, target_url FROM affiliate_links WHERE unique_code = ?';
      db.get(linkQuery, [uniqueCode], (err, row) => {
        if (err) {
          console.error('Error fetching link from database:', err.message);
          ensureDbClose("db.get error");
          return sendJSONResponse(res, 500, { success: false, message: 'Internal Server Error fetching link' });
        }

        if (row) {
          const linkId = row.id;
          const targetUrl = row.target_url;
          const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

          const clickDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (clickErr) => {
            if (clickErr) {
              console.error('Error opening DB for logging click:', clickErr.message);
              // Don't let logging error stop redirect, but don't try to log if DB can't open
            } else {
              let clickDbClosed = false;
              const ensureClickDbClose = (context) => {
                  if(clickDb && !clickDbClosed && clickDb.open){
                      clickDb.close(err => { if(err) console.error(`Error closing clickDb in ${context}:`, err.message); clickDbClosed = true; });
                  }
              };
              const logStmt = clickDb.prepare('INSERT INTO click_logs (link_id, ip_address) VALUES (?, ?)');
              logStmt.run(linkId, ipAddress, (logErr) => {
                if (logErr) console.error('Error logging click:', logErr.message);
                logStmt.finalize((finalizeErr) => {
                  if (finalizeErr) console.error('Error finalizing log statement:', finalizeErr.message);
                  ensureClickDbClose("log finalize");
                });
              });
            }
          });

          res.writeHead(302, { 'Location': targetUrl });
          res.end();
          ensureDbClose("successful redirect");
        } else {
          res.writeHead(302, { 'Location': DEFAULT_ERROR_REDIRECT_URL + '?error=invalid_code' });
          res.end();
          ensureDbClose("invalid code");
        }
      });
    } catch (e) {
      console.error('Unexpected error in /go handler:', e);
      ensureDbClose("unexpected error catch");
      sendJSONResponse(res, 500, { success: false, message: 'Internal Server Error in /go handler' });
    }
  }
  // API: Create new link
  else if (pathname === '/api/links' && method === 'POST') {
    parseJsonBody(req, async (err, body) => {
        if (err) {
            return sendJSONResponse(res, 400, { success: false, message: 'Invalid JSON payload' });
        }
        const { target_url, affiliate_id } = body;
        if (!target_url) {
            return sendJSONResponse(res, 400, { success: false, message: 'target_url is required' });
        }
        try {
            const newLinkData = await createAffiliateLink(target_url, affiliate_id);
            sendJSONResponse(res, 201, { success: true, link: newLinkData });
        } catch (error) {
            console.error('Error creating affiliate link:', error.message);
            sendJSONResponse(res, 500, { success: false, message: `Error creating link: ${error.message}` });
        }
    });
  }
  // API: Get all links with stats
  else if (pathname === '/api/links' && method === 'GET') {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (dbErr) => {
        if (dbErr) {
            console.error('Error opening database for GET /api/links:', dbErr.message);
            return sendJSONResponse(res, 500, { success: false, message: 'Internal Server Error' });
        }
    });
    db.all('SELECT * FROM affiliate_links', [], async (err, links) => {
        if (err) {
            db.close();
            console.error('Error fetching links from database:', err.message);
            return sendJSONResponse(res, 500, { success: false, message: 'Error fetching links' });
        }
        if (!links || links.length === 0) {
            db.close();
            return sendJSONResponse(res, 200, []);
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const linksWithStats = [];

        for (const link of links) {
            let unique_clicks_today = 0;
            let total_conversions = 0;
            try {
                unique_clicks_today = await getUniqueClicksPerLink(link.id, today);
                if (link.affiliate_id) {
                    total_conversions = await getConversionData(link.affiliate_id);
                }
            } catch (analyticsError) {
                console.error(`Error fetching analytics for link ${link.id}:`, analyticsError.message);
                // Continue, but clicks/conversions might be 0 or incomplete
            }
            linksWithStats.push({ ...link, unique_clicks_today, total_conversions });
        }
        db.close();
        sendJSONResponse(res, 200, linksWithStats);
    });
  }
  // API: Login
  else if (pathname === '/api/login' && method === 'POST') {
    parseJsonBody(req, (err, body) => {
        if (err) {
            return sendJSONResponse(res, 400, { success: false, message: 'Invalid JSON payload' });
        }
        const { password } = body;
        try {
            const isValid = verifyPassword(password);
            if (isValid) {
                sendJSONResponse(res, 200, { success: true, message: "Login successful" });
            } else {
                sendJSONResponse(res, 401, { success: false, message: 'Invalid password' });
            }
        } catch (authError) { // Catch errors from getSharedPassword if config is missing
            console.error("Authentication error:", authError.message);
            sendJSONResponse(res, 500, { success: false, message: `Authentication error: ${authError.message}` });
        }
    });
  }
  // Not Found for other API routes or general 404
  else if (pathname.startsWith('/api/')) {
    sendJSONResponse(res, 404, { success: false, message: 'API endpoint not found' });
  }
  else {
    // Keep existing 404 for non-API, non-/go routes
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Affiliate redirect endpoint: /go?code=UNIQUE_CODE`);
  console.log(`API endpoints available at /api/...`);
});

module.exports = server;
