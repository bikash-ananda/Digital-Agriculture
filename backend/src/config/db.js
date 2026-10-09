const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: ['DATE'],
  timezone: 'Z'
});

// Every session runs in UTC so NOW() and stored timestamps agree on any machine.
pool.pool.on('connection', (conn) => { conn.query("SET time_zone = '+00:00'"); });

module.exports = pool;
