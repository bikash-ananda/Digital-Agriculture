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
const consoleRoutes = require('./routes/consoleRoutes');
const aiRoutes = require('./routes/aiRoutes');
const opsRoutes = require('./routes/opsRoutes');
const consoleRoutes = require('./routes/consoleRoutes');
const aiRoutes = require('./routes/aiRoutes');
const opsRoutes = require('./routes/opsRoutes');
const consoleRoutes = require('./routes/consoleRoutes');
const aiRoutes = require('./routes/aiRoutes');
const opsRoutes = require('./routes/opsRoutes');
const consoleRoutes = require('./routes/consoleRoutes');
const aiRoutes = require('./routes/aiRoutes');
const opsRoutes = require('./routes/opsRoutes');
const consoleRoutes = require('./routes/consoleRoutes');
const aiRoutes = require('./routes/aiRoutes');
const opsRoutes = require('./routes/opsRoutes');
const farmerDataRoutes = require('./routes/farmerDataRoutes');
const dataCenterRoutes = require('./routes/dataCenterRoutes');
const researchRoutes = require('./routes/researchRoutes');
const deviceTelemetryRoutes = require('./routes/deviceTelemetryRoutes');
const v1Routes = require('./routes/v1Routes');
const v1Routes = require('./routes/v1Routes');
const v1Routes = require('./routes/v1Routes');
const dataCenterPhase2Routes = require('./routes/dataCenterPhase2Routes');
const siteRoutes = require('./routes/siteRoutes');
const monitorRoutes = require('./routes/monitorRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const intelligenceRoutes = require('./routes/intelligenceRoutes');

const app = express();
app.set('trust proxy', 1);
app.set('trust proxy', 1);
app.set('trust proxy', 1);
app.set('trust proxy', 1);
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, skip: (req) => ((((((((req.path.startsWith('/device') || req.path.startsWith('/ops/devices/')) || req.path.startsWith('/ops/devices/')) || req.path.startsWith('/ops/devices/')) || req.path.startsWith('/ops/devices/')) || req.path.startsWith('/ops/devices/')) || req.path.startsWith('/v1/')) || req.path.startsWith('/v1/')) || req.path.startsWith('/v1/')) }));

app.get('/api/health', async (req, res) => {
  let dbOk = true;
  try { await require('./config/db').query('SELECT 1'); } catch { dbOk = false; }
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ok' : 'degraded', service: 'Digital Agriculture API', db: dbOk ? 'up' : 'down', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/console', consoleRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/console', consoleRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/console', consoleRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/console', consoleRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/console', consoleRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/farmers', farmerDataRoutes);
app.use('/api/datacenter', dataCenterRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/device', deviceTelemetryRoutes);
app.use('/api/v1', v1Routes);
app.use('/api/v1', v1Routes);
app.use('/api/v1', v1Routes);
app.use('/api/datacenter', dataCenterPhase2Routes);
app.use('/api/smart', siteRoutes);
app.use('/api/smart', monitorRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/smart', intelligenceRoutes);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: 'Internal server error' });
});

module.exports = app;











































