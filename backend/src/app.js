const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const lookupRoutes = require('./routes/lookupRoutes');
const farmerDataRoutes = require('./routes/farmerDataRoutes');
const dataCenterRoutes = require('./routes/dataCenterRoutes');
const researchRoutes = require('./routes/researchRoutes');
const deviceTelemetryRoutes = require('./routes/deviceTelemetryRoutes');
const v1Routes = require('./routes/v1Routes');
const dataCenterPhase2Routes = require('./routes/dataCenterPhase2Routes');
const siteRoutes = require('./routes/siteRoutes');
const monitorRoutes = require('./routes/monitorRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const opsRoutes = require('./routes/opsRoutes');
const intelligenceRoutes = require('./routes/intelligenceRoutes');

const app = express();
const proxyHops = Number(process.env.TRUST_PROXY_HOPS);
app.set('trust proxy', Number.isInteger(proxyHops) && proxyHops >= 0 ? proxyHops : 0);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  skip: (req) => req.path.startsWith('/device') || req.path === '/v1/telemetry' || /^\/v1\/devices\/[^/]+\/commands\//.test(req.path) || req.path.startsWith('/ops/devices/'),
  message: { message: 'Too many requests. Try again later.' }
}));

app.get('/api/health', async (req, res) => {
  let dbOk = true;
  try { await require('./config/db').query('SELECT 1'); } catch { dbOk = false; }
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ok' : 'degraded', service: 'Digital Agriculture API', db: dbOk ? 'up' : 'down', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/farmers', farmerDataRoutes);
app.use('/api/datacenter', dataCenterRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/device', deviceTelemetryRoutes);
app.use('/api/v1', v1Routes);
app.use('/api/datacenter', dataCenterPhase2Routes);
app.use('/api/smart', siteRoutes);
app.use('/api/smart', monitorRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/smart', intelligenceRoutes);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST'].includes(err.code)) {
    return res.status(503).json({ message: 'Database unavailable. Start MySQL and try again.' });
  }
  res.status(err.status || 500).json({ message: 'Internal server error' });
});

module.exports = app;
