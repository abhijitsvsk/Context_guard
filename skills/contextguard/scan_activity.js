const fs = require('fs');
const path = require('path');
const os = require('os');

const dirsToScan = [
  path.join(os.homedir(), '.gemini', 'antigravity', 'brain'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'workspaceStorage')
];

function getRecentFiles(dir, filelist = []) {
  if (!fs.existsSync(dir)) return filelist;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filepath = path.join(dir, file);
      try {
        const stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
          getRecentFiles(filepath, filelist);
        } else {
          filelist.push({ path: filepath, mtime: stat.mtimeMs });
        }
      } catch (e) {}
    }
  } catch (e) {}
  return filelist;
}

const allFiles = [];
for (const d of dirsToScan) {
  getRecentFiles(d, allFiles);
}

allFiles.sort((a, b) => b.mtime - a.mtime);

console.log('--- Top 15 Most Recently Modified Files Across Antigravity ---');
allFiles.slice(0, 15).forEach((f, idx) => {
  console.log(`${idx + 1}. [${new Date(f.mtime).toLocaleTimeString()}] ${f.path}`);
});
