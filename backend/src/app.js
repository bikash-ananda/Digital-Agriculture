const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', service: 'Digital Agriculture API', time: new Date().toISOString() })
);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: 'Internal server error' });
});

module.exports = app;
