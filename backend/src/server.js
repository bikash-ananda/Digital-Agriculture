const app = require('./app');
require('./config/validateEnv')();
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on port ${port}`));
require('./jobs/engine').start();
require('./jobs/aiDigest').start();
require('./services/rollupService').start();
require('./services/supportChatRetention').start();
