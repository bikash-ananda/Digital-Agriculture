const app = require('./app');
require('./config/validateEnv')();
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on port ${port}`));
require('./jobs/engine').start();
require('./jobs/aiDigest').start();
require('./services/rollupService').start();
require('./services/supportChatRetention').start();

// Autonomous Farmer Support Agent periodic cycle (every 30 minutes)
const farmerSupportAgent = require('./services/farmerSupportAgent');
setInterval(() => {
  farmerSupportAgent.runAutonomousSupportSweep().catch((err) => {
    console.error('[farmerSupportAgent-job] periodic sweep error:', err.message);
  });
}, 30 * 60 * 1000);
setTimeout(() => {
  farmerSupportAgent.runAutonomousSupportSweep().catch(() => {});
}, 90 * 1000);
console.log('Autonomous Farmer Support Agent initialized');
// Autonomous Greenhouse Climate & Production Loop (every 5 minutes)
const greenhouseAgent = require('./services/greenhouseAgentEngine');
setInterval(() => {
  greenhouseAgent.runAutonomousGreenhouseLoop().catch((err) => {
    console.error('[greenhouseAgent-job] periodic loop error:', err.message);
  });
}, 5 * 60 * 1000);
setTimeout(() => {
  greenhouseAgent.runAutonomousGreenhouseLoop().catch(() => {});
}, 30 * 1000);
console.log('Autonomous Greenhouse Control Agent initialized');