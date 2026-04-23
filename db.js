const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const sslConfig = {};

const shouldUseSsl = process.env.DATABASE_SSL === 'true';
const certPath = process.env.DATABASE_SSL_CA_PATH || 'root.crt';

if (shouldUseSsl) {
  if (fs.existsSync(certPath)) {
    sslConfig.ca = fs.readFileSync(certPath).toString();
  } else if (process.env.DATABASE_SSL_CA) {
    sslConfig.ca = process.env.DATABASE_SSL_CA;
  }
  sslConfig.rejectUnauthorized = false;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(Object.keys(sslConfig).length ? { ssl: sslConfig } : {}),
});

module.exports = pool;