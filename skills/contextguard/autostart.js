const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function ensureCDPServiceRunning() {
  const serviceScript = path.join(__dirname, 'cdp-service.js');
  if (!fs.existsSync(serviceScript)) return;

  const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'node.exe'\\" | Where-Object CommandLine -like '*cdp-service.js*'"`;
  exec(cmd, (err, stdout) => {
    if (!stdout || !stdout.trim()) {
      try {
        const child = spawn(process.execPath, [serviceScript], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          cwd: __dirname
        });
        child.unref();
      } catch (e) {}
    }
  });
}

ensureCDPServiceRunning();
