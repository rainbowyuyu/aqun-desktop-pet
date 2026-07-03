const os = require('os');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const BINDING_FILENAME = '.aqun-device.json';
const USER_BINDING_FILENAME = 'machine-binding.json';

function getMachineFingerprint() {
  const parts = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
    process.env.COMPUTERNAME || '',
    process.env.USERDOMAIN || '',
  ];
  return crypto.createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex');
}

function readBinding(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return typeof data.machineId === 'string' ? data.machineId : null;
  } catch {
    return null;
  }
}

function writeBinding(filePath, machineId) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ machineId, registeredAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

function portableBindingPath(execPath, isDev) {
  if (isDev) return null;
  return path.join(path.dirname(execPath), BINDING_FILENAME);
}

function userBindingPath(app) {
  return path.join(app.getPath('userData'), USER_BINDING_FILENAME);
}

function resolveStoredMachineId(portablePath, userPath) {
  return readBinding(portablePath) || readBinding(userPath);
}

/**
 * 检测是否在新电脑运行便携版。
 * 便携目录内的绑定文件随压缩包迁移；若与当前机器指纹不一致则视为新电脑。
 */
function checkNewMachine({ app, isDev, execPath }) {
  const fingerprint = getMachineFingerprint();
  if (isDev) {
    return { isNewMachine: false, fingerprint };
  }

  const portablePath = portableBindingPath(execPath, isDev);
  const userPath = userBindingPath(app);
  const stored = resolveStoredMachineId(portablePath, userPath);

  if (!stored) {
    if (portablePath) writeBinding(portablePath, fingerprint);
    writeBinding(userPath, fingerprint);
    return { isNewMachine: false, fingerprint };
  }

  if (stored === fingerprint) {
    if (portablePath) writeBinding(portablePath, fingerprint);
    writeBinding(userPath, fingerprint);
    return { isNewMachine: false, fingerprint };
  }

  return { isNewMachine: true, fingerprint };
}

function commitMachineBinding({ app, isDev, execPath, fingerprint }) {
  const portablePath = portableBindingPath(execPath, isDev);
  const userPath = userBindingPath(app);
  if (portablePath) writeBinding(portablePath, fingerprint);
  writeBinding(userPath, fingerprint);
}

module.exports = {
  checkNewMachine,
  commitMachineBinding,
  getMachineFingerprint,
};
