const SERVICE_UUID = 'f14a0001-4c89-4f5f-a4de-6b1e0f4a0001';
const WRITE_UUID = 'f14a0002-4c89-4f5f-a4de-6b1e0f4a0002';
const NOTIFY_UUID = 'f14a0003-4c89-4f5f-a4de-6b1e0f4a0003';
export function bluetoothUnavailableMessage() {
  if (!window.isSecureContext) return 'Bluetooth setup needs the secure HTTPS website.';
  if (!navigator.bluetooth) return 'This browser does not support Web Bluetooth. Use a recent Chrome or Edge browser on a computer or Android device.';
  return '';
}

export async function connectEsp32Bluetooth() {
  const unsupported = bluetoothUnavailableMessage();
  if (unsupported) throw new Error(unsupported);

  // requestDevice must be called directly from the user's button click.
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: 'ESP32-01-Setup' }],
    optionalServices: [SERVICE_UUID]
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  const writeCharacteristic = await service.getCharacteristic(WRITE_UUID);
  const notifyCharacteristic = await service.getCharacteristic(NOTIFY_UUID);
  const waiting = new Map();
  let fragments = [];
  let expectedFragments = 0;

  const onNotification = (event) => {
    const view = event.target.value;
    if (view.byteLength < 2) return;
    const index = view.getUint8(0);
    const total = view.getUint8(1);
    if (!total || index >= total) return;
    if (index === 0 || expectedFragments !== total) {
      fragments = new Array(total);
      expectedFragments = total;
    }
    fragments[index] = new Uint8Array(view.buffer, view.byteOffset + 2, view.byteLength - 2).slice();
    if (fragments.filter(Boolean).length !== total) return;

    const length = fragments.reduce((sum, part) => sum + part.length, 0);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of fragments) { bytes.set(part, offset); offset += part.length; }
    fragments = [];
    expectedFragments = 0;
    try {
      const response = JSON.parse(new TextDecoder().decode(bytes));
      const request = waiting.get(response.request_id);
      if (!request) return;
      clearTimeout(request.timer);
      waiting.delete(response.request_id);
      request.resolve(response);
    } catch { /* Ignore incomplete or unrelated GATT messages. */ }
  };

  const onDisconnected = () => {
    for (const request of waiting.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('The ESP32 Bluetooth connection was lost. It may be restarting to apply the Wi-Fi change.'));
    }
    waiting.clear();
  };

  notifyCharacteristic.addEventListener('characteristicvaluechanged', onNotification);
  device.addEventListener('gattserverdisconnected', onDisconnected);
  try {
    await notifyCharacteristic.startNotifications();
  } catch (error) {
    notifyCharacteristic.removeEventListener('characteristicvaluechanged', onNotification);
    device.removeEventListener('gattserverdisconnected', onDisconnected);
    if (device.gatt.connected) device.gatt.disconnect();
    throw error;
  }

  return {
    device,
    async request(action, details = {}) {
      if (!device.gatt.connected) throw new Error('ESP32 Bluetooth is disconnected. Reconnect and retry.');
      const requestId = (Date.now() + Math.floor(Math.random() * 10000)) & 0x7fffffff;
      const payload = new TextEncoder().encode(JSON.stringify({ request_id: requestId, action, ...details }));
      const responsePromise = new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          waiting.delete(requestId);
          reject(new Error('No response from the ESP32. Check the Bluetooth connection and try again.'));
        }, 15000);
        waiting.set(requestId, { resolve, reject, timer });
      });
      try {
        if (writeCharacteristic.writeValueWithResponse) await writeCharacteristic.writeValueWithResponse(payload);
        else await writeCharacteristic.writeValue(payload);
      } catch (error) {
        const request = waiting.get(requestId);
        if (request) clearTimeout(request.timer);
        waiting.delete(requestId);
        throw error;
      }
      return responsePromise;
    },
    disconnect() {
      notifyCharacteristic.removeEventListener('characteristicvaluechanged', onNotification);
      device.removeEventListener('gattserverdisconnected', onDisconnected);
      if (device.gatt.connected) device.gatt.disconnect();
    }
  };
}

export const wifiProfileConstraints = {
  maxSsidBytes: 32,
  validPassword(password) {
    const bytes = new TextEncoder().encode(password).length;
    return password === '' || (bytes >= 8 && bytes <= 63) || (/^[a-f0-9]{64}$/i.test(password));
  }
};
