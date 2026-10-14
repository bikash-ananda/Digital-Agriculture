const db = require('../config/db');

let busy = false;

async function removeExpiredChats() {
  if (busy) return;
  busy = true;
  try {
    const [result] = await db.query(
      'DELETE FROM support_conversations WHERE last_message_at < UTC_TIMESTAMP() - INTERVAL 90 DAY'
    );
    if (result.affectedRows) console.info(`[support-chat] removed ${result.affectedRows} expired conversations`);
  } catch (error) {
    console.error('[support-chat] retention cleanup failed', error.code || error.name);
  } finally { busy = false; }
}

module.exports = {
  start() {
    const daily = setInterval(removeExpiredChats, 24 * 60 * 60 * 1000);
    const firstRun = setTimeout(removeExpiredChats, 60 * 1000);
    daily.unref?.();
    firstRun.unref?.();
    console.info('Support chat retention job started (90 days)');
  }
};
