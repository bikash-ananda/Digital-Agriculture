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
const dataCenterPhase2Routes = require('./routes/dataCenterPhase2Routes');
const siteRoutes = require('./routes/siteRoutes');
const monitorRoutes = require('./routes/monitorRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const intelligenceRoutes = require('./routes/intelligenceRoutes');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, skip: (req) => req.path.startsWith('/device') }));

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', service: 'Digital Agriculture API', time: new Date().toISOString() })
);

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/farmers', farmerDataRoutes);
app.use('/api/datacenter', dataCenterRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/device', deviceTelemetryRoutes);
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














