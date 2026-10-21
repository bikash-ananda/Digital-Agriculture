import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const execFile = promisify(execFileCallback);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const firmwareDir = path.join(projectRoot, 'iot', 'esp32', 'greenhouse');
const platformioCandidates = process.platform === 'win32'
  ? [path.join(os.homedir(), '.platformio', 'penv', 'Scripts', 'platformio.exe'), 'platformio.exe', 'pio.exe']
  : [path.join(os.homedir(), '.platformio', 'penv', 'bin', 'platformio'), 'platformio', 'pio'];

function platformioPath() {
  return platformioCandidates.find((candidate) => candidate.includes(path.sep) ? existsSync(candidate) : candidate === platformioCandidates.at(-1))
    || platformioCandidates.find((candidate) => !candidate.includes(path.sep));
}

function safeFirmwareInfo() {
  const configPath = path.join(firmwareDir, 'include', 'config.h');
  const secretsPath = path.join(firmwareDir, 'include', 'secrets.h');
  const config = readFileSync(configPath, 'utf8');
  const version = config.match(/#define\s+FIRMWARE_VERSION\s+"([^"]+)"/)?.[1] || 'unknown';
  const deviceCode = config.match(/#define\s+DEVICE_CODE\s+"([^"]+)"/)?.[1] || 'unknown';
  const secrets = existsSync(secretsPath) ? readFileSync(secretsPath, 'utf8') : '';
  return {
    projectRoot,
    firmwareDir,
    deviceCode,
    firmwareVersion: version,
    localSecretsConfigured: Boolean(secrets.match(/#define\s+DEVICE_KEY\s+"[^"]+"/)),
    // Deliberately never return or log secret values from secrets.h.
    secretsFileIgnored: true
  };
}

async function serialPorts() {
  if (process.platform !== 'win32') return 'Serial-port discovery is currently configured for Windows.';
  const script = 'Get-CimInstance Win32_SerialPort | Select-Object DeviceID,Name,Status | ConvertTo-Json -Compress';
  try {
    const { stdout } = await execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 10000 });
    const parsed = stdout.trim() ? JSON.parse(stdout) : [];
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map(({ DeviceID, Name, Status }) => ({ port: DeviceID, name: Name, status: Status }));
  } catch (error) {
    return `Could not list serial ports: ${error.message}`;
  }
}

async function runPlatformIO(args, timeout) {
  const command = platformioPath();
  if (!command) throw new Error('PlatformIO CLI was not found. Install PlatformIO IDE/Core, then reopen VS Code.');
  const { stdout, stderr } = await execFile(command, [...args, '-d', firmwareDir], {
    cwd: projectRoot,
    windowsHide: true,
    timeout,
    maxBuffer: 3 * 1024 * 1024
  });
  return `${stdout}${stderr ? `\n${stderr}` : ''}`.trim();
}

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

function createServer() {
  const server = new McpServer({ name: 'digital-agriculture-esp32', version: '1.0.0' });

  server.registerTool('esp32_project_status', {
    title: 'ESP32 project status',
    description: 'Show firmware version, local key presence without revealing it, PlatformIO availability, and connected serial ports.',
    inputSchema: z.object({})
  }, async () => {
    const info = safeFirmwareInfo();
    const command = platformioPath();
    const ports = await serialPorts();
    return textResult(JSON.stringify({ ...info, platformioAvailable: Boolean(command), serialPorts: ports }, null, 2));
  });

  server.registerTool('esp32_build_firmware', {
    title: 'Build ESP32 firmware',
    description: 'Compile the greenhouse firmware with PlatformIO. Does not upload or modify the ESP32.',
    inputSchema: z.object({})
  }, async () => {
    try {
      const output = await runPlatformIO(['run'], 240000);
      return textResult(output.slice(-12000) || 'Firmware build completed.');
    } catch (error) {
      const detail = [error.message, error.stdout, error.stderr].filter(Boolean).join('\n').slice(-12000);
      return textResult(detail, true);
    }
  });

  server.registerTool('esp32_upload_firmware', {
    title: 'Upload firmware to ESP32',
    description: 'Flash the built greenhouse firmware to a serial port. Requires confirmation exactly equal to UPLOAD; the device restarts during upload.',
    inputSchema: z.object({
      port: z.string().regex(/^(COM[1-9][0-9]*|\/dev\/tty(USB|ACM)[0-9]+)$/i).describe('Serial port, such as COM4.'),
      confirmation: z.string().describe('Must be exactly UPLOAD to proceed.')
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
  }, async ({ port, confirmation }) => {
    if (confirmation !== 'UPLOAD') return textResult('Upload stopped. Call again with confirmation set to exactly UPLOAD after the ESP32 is ready.', true);
    try {
      const output = await runPlatformIO(['run', '--target', 'upload', '--upload-port', port], 300000);
      return textResult(output.slice(-12000) || `Upload to ${port} completed.`);
    } catch (error) {
      const detail = [error.message, error.stdout, error.stderr].filter(Boolean).join('\n').slice(-12000);
      return textResult(detail, true);
    }
  });

  return server;
}

void serveStdio(createServer);
