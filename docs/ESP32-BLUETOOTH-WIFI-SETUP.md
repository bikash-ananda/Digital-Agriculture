# ESP32 Wi-Fi setup over Bluetooth

Firmware `gh-1.0.6` provides Wi-Fi provisioning for the greenhouse controller (`ESP32-01`).

The BLE support needs a larger app partition than the Arduino default. `partitions.csv` uses one 2.875 MiB factory app slot, keeps the existing NVS offset for saved Wi-Fi and BLE pairing keys, and leaves 1 MiB for SPIFFS. It does not provide a second OTA app slot; firmware is uploaded through USB serial.

## Behavior

- At first boot, firmware copies the Wi-Fi profiles from the ignored local `iot/esp32/greenhouse/include/secrets.h` into ESP32 NVS storage.
- It tries the saved profiles for up to 60 seconds. If none connect, it advertises `ESP32-01-Setup` over Bluetooth and keeps trying Wi-Fi.
- If Wi-Fi is already connected, an authorized device user can queue **Enable Bluetooth on online ESP32** from the device page. The ESP polls its command queue and advertises for 10 minutes.
- BLE commands list, scan, add, edit, and delete up to eight saved SSIDs. The ESP32 never sends stored passwords back to the browser. For an edit, leave the password empty to keep the existing password; enter a password when renaming a network.
- GATT writes/reads require BLE secure pairing. The ESP32 prints a random six-digit PIN to its USB serial monitor when opening the setup window; enter that PIN in the operating system's pairing prompt if it appears. The code is never sent to the website.
- After add, edit, or delete, the ESP32 acknowledges the change, restarts, and tries the updated profile list. If no profile can connect, Bluetooth setup starts again.
- Credentials entered in the Bluetooth panel go directly from the browser to the ESP32. The existing online Wi-Fi queue remains available separately and stores its queued password encrypted on the server until acknowledgement or expiry.

## Use the website

1. Open the device page on `https://kaskikotagro.com.np` in a recent Chrome or Edge browser on a computer or Android device.
2. If the device already has internet, click **Enable Bluetooth on online ESP32**, wait for the queued command to be received, and then click **Connect to ESP32 over Bluetooth**. If it has no working Wi-Fi, skip the enable command and connect once its 60-second Wi-Fi attempt finishes.
3. If prompted, enter the random PIN shown in the ESP32 serial monitor. Choose `ESP32-01-Setup` in the browser chooser. Scan nearby Wi-Fi names if useful, or enter the SSID manually.
4. Add a network, or edit/delete a stored profile. The ESP32 restarts after a change; reconnect to Bluetooth only if another change is needed.

Web Bluetooth is available only in secure browser contexts and is not implemented by every browser. If the browser reports that Bluetooth is unavailable, use a supported Chrome/Edge browser on HTTPS or continue using the existing server-queued Wi-Fi form.

## Local MCP tools in VS Code

The workspace MCP configuration at `.vscode/mcp.json` registers `digitalAgricultureEsp32` as a local stdio server. The project uses the official MCP TypeScript server SDK. Install the root development dependencies with `npm install` if needed, then reload MCP servers in VS Code.

The MCP tools are:

- `esp32_project_status`: report the firmware version, whether local secrets are configured (without returning them), and available serial ports.
- `esp32_build_firmware`: compile the firmware with PlatformIO.
- `esp32_upload_firmware`: upload to a chosen port, such as `COM4`; requires `confirmation: "UPLOAD"` because it restarts the connected ESP32.

The MCP process runs on the developer's machine only. It is not part of the public website or production backend.
