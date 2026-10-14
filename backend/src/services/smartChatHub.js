const clientsByUser = new Map();

function userKey(userId) {
  return String(userId);
}

function isClientOpen(client) {
  return !client.response.destroyed && !client.response.writableEnded;
}

function writeEvent(client, event) {
  if (!isClientOpen(client)) return false;
  try {
    client.response.write('data: ' + JSON.stringify(event) + '\n\n');
    return true;
  } catch {
    return false;
  }
}

function addClient({ userId, deviceId, sessionId, response }) {
  const key = userKey(userId);
  let sessions = clientsByUser.get(key);
  if (!sessions) {
    sessions = new Map();
    clientsByUser.set(key, sessions);
  }

  let connections = sessions.get(sessionId);
  if (!connections) {
    connections = new Set();
    sessions.set(sessionId, connections);
  }

  const client = { userId: key, deviceId, sessionId, response };
  connections.add(client);

  const heartbeat = setInterval(() => {
    if (!isClientOpen(client)) return remove();
    try { response.write(': ping\n\n'); } catch { remove(); }
  }, 25000);

  let removed = false;
  function remove() {
    if (removed) return;
    removed = true;
    clearInterval(heartbeat);
    connections.delete(client);
    if (connections.size === 0) sessions.delete(sessionId);
    if (sessions.size === 0) clientsByUser.delete(key);
  }

  response.on('close', remove);
  response.on('error', remove);
  return remove;
}

function onlineSessions(userId) {
  const sessions = clientsByUser.get(userKey(userId));
  if (!sessions) return [];
  const result = [];
  for (const [sessionId, connections] of sessions.entries()) {
    for (const client of connections) {
      if (isClientOpen(client)) {
        result.push({ deviceId: client.deviceId, sessionId });
        break;
      }
    }
  }
  return result;
}

function hasSession(userId, sessionId, deviceId) {
  const sessions = clientsByUser.get(userKey(userId));
  const connections = sessions && sessions.get(String(sessionId));
  return Boolean(connections && Array.from(connections).some((client) =>
    isClientOpen(client) && (!deviceId || client.deviceId === deviceId)));
}

function connectionCount(userId) {
  const sessions = clientsByUser.get(userKey(userId));
  if (!sessions) return 0;
  let total = 0;
  for (const connections of sessions.values()) {
    for (const client of connections) if (isClientOpen(client)) total += 1;
  }
  return total;
}

function sendTo({ userId, sessionId, event }) {
  const sessions = clientsByUser.get(userKey(userId));
  if (!sessions) return false;
  const targets = sessionId ? [sessions.get(sessionId)].filter(Boolean) : Array.from(sessions.values());
  let sent = false;
  for (const connections of targets) {
    for (const client of Array.from(connections)) {
      if (writeEvent(client, event)) sent = true;
      else client.response.destroy();
    }
  }
  return sent;
}

module.exports = { addClient, onlineSessions, hasSession, connectionCount, sendTo };
