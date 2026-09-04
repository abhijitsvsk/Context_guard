import os
import datetime
import subprocess
import json

targets = [
    '77c0eeee-dfdf-413e-920f-c5bcafb79a73',
    '71b20f30-5940-435a-b7d1-9512ae6f373d',
    '8946af9d-13e7-404a-aa3e-09b658d2f2a1',
    'c71b90f1-7e8a-430c-8ae1-b2a4ab3a1f5f',
    '457819bf-3018-4ced-bf02-f00de24c159a'
]

brain_dir = r'os.path.expanduser('~')\.gemini\antigravity\brain'
now = datetime.datetime.now().isoformat()
print(f'=== INSPECTION TIMESTAMP: {now} ===\n')

for sid in targets:
    s_path = os.path.join(brain_dir, sid)
    print(f'================================================================================')
    print(f'SESSION: {sid}')
    print(f'PATH:    {s_path}')
    print(f'EXISTS:  {os.path.exists(s_path)}')
    
    # Complete recursive file listing
    all_files = []
    for root, dirs, files in os.walk(s_path):
        for f in files:
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, s_path)
            size = os.path.getsize(fp)
            mtime = datetime.datetime.fromtimestamp(os.path.getmtime(fp)).strftime('%Y-%m-%d %H:%M:%S')
            all_files.append((rel, size, mtime))
            
    print(f'TOTAL FILES: {len(all_files)}')
    for rel, size, mtime in sorted(all_files, key=lambda x: x[0]):
        print(f'  {rel:<45} | {size:>10} B | {mtime}')
        
    # Check current engine.js result
    js_cmd = f"""
    const engine = require('os.getcwd()/.agents/contextguard/engine.js');
    const res = engine.updateChatState('{sid}', process.cwd());
    console.log(JSON.stringify(res));
    """
    res = subprocess.run(['node', '-e', js_cmd], capture_output=True, text=True)
    out = json.loads(res.stdout.strip()) if res.stdout.strip() else {}
    print(f'\nCURRENT ENGINE.JS RESOLVER RESULT:')
    print(f'  percentageUsed: {out.get("percentageUsed")}')
    print(f'  tokensUsed:     {out.get("tokensUsed")}')
    print(f'  precision:      "{out.get("precision")}"')
    print(f'  badge:          "{out.get("badge")}"')
    print(f'  level:          "{out.get("level")}"')
    print(f'================================================================================\n')
