const DB_PREFIX = 'digital-ag-smart-chat';

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.random() * 16 | 0;
    return (char === 'x' ? value : (value & 3 | 8)).toString(16);
  });
}

export function getChatIdentity(userId) {
  const owner = String(userId);
  const deviceKey = DB_PREFIX + ':device:' + owner;
  const sessionKey = DB_PREFIX + ':session:' + owner;
  let deviceId;
  let sessionId;
  try {
    deviceId = localStorage.getItem(deviceKey);
    if (!deviceId) {
      deviceId = makeId();
      localStorage.setItem(deviceKey, deviceId);
    }
  } catch { deviceId = makeId(); }
  try {
    sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = makeId();
      sessionStorage.setItem(sessionKey, sessionId);
    }
  } catch { sessionId = makeId(); }
  return { userId: owner, deviceId, sessionId };
}

export function openChatDatabase(userId, deviceId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_PREFIX + ':' + String(userId) + ':' + deviceId, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      const messages = database.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('conversationId', 'conversationId', { unique: false });
      messages.createIndex('createdAt', 'createdAt', { unique: false });
      const attachments = database.createObjectStore('attachments', { keyPath: 'id' });
      attachments.createIndex('conversationId', 'conversationId', { unique: false });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error('Could not open device storage'));
    request.onblocked = () => reject(new Error('Close other Smart Farming chat tabs, then try again'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Device storage write failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Device storage write was cancelled'));
  });
}

export async function listConversationMessages(database, conversationId) {
  const transaction = database.transaction('messages', 'readonly');
  const request = transaction.objectStore('messages').index('conversationId').getAll(IDBKeyRange.only(String(conversationId)));
  const rows = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  return rows.sort((left, right) => left.createdAt - right.createdAt).slice(-500);
}

export async function saveLocalMessage(database, message) {
  const transaction = database.transaction('messages', 'readwrite');
  transaction.objectStore('messages').put(message);
  await transactionDone(transaction);
  return message;
}

export async function getLocalMessage(database, messageId) {
  const transaction = database.transaction('messages', 'readonly');
  const request = transaction.objectStore('messages').get(messageId);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalAttachment(database, attachment) {
  const transaction = database.transaction('attachments', 'readwrite');
  transaction.objectStore('attachments').put(attachment);
  await transactionDone(transaction);
}

export async function getLocalAttachment(database, attachmentId) {
  const transaction = database.transaction('attachments', 'readonly');
  const request = transaction.objectStore('attachments').get(attachmentId);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearLocalConversation(database, conversationId) {
  const transaction = database.transaction(['messages', 'attachments'], 'readwrite');
  const messageCursor = transaction.objectStore('messages').index('conversationId')
    .openCursor(IDBKeyRange.only(String(conversationId)));
  messageCursor.onsuccess = () => {
    const cursor = messageCursor.result;
    if (cursor) { cursor.delete(); cursor.continue(); }
  };
  const attachmentCursor = transaction.objectStore('attachments').index('conversationId')
    .openCursor(IDBKeyRange.only(String(conversationId)));
  attachmentCursor.onsuccess = () => {
    const cursor = attachmentCursor.result;
    if (cursor) { cursor.delete(); cursor.continue(); }
  };
  await transactionDone(transaction);
}
