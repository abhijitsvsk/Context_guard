import subprocess
import json
import datetime

targets = [
    '77c0eeee-dfdf-413e-920f-c5bcafb79a73',
    '71b20f30-5940-435a-b7d1-9512ae6f373d',
    '8946af9d-13e7-404a-aa3e-09b658d2f2a1',
    'c71b90f1-7e8a-430c-8ae1-b2a4ab3a1f5f',
    '457819bf-3018-4ced-bf02-f00de24c159a'
]

print(f"=== RE-VERIFICATION TIMESTAMP: {datetime.datetime.now().isoformat()} ===\n")

for sid in targets:
    js_cmd = f"""
    const engine = require('os.getcwd()/.agents/contextguard/engine.js');
    const res = engine.updateChatState('{sid}', process.cwd());
    console.log(JSON.stringify(res));
    """
    res = subprocess.run(['node', '-e', js_cmd], capture_output=True, text=True)
    out = json.loads(res.stdout.strip())
    print(f"SESSION ID: {sid}")
    print(f"  - Percentage Used : {out.get('percentageUsed')}%")
    print(f"  - Tokens Used     : {out.get('tokensUsed')}")
    print(f"  - Precision       : \"{out.get('precision')}\"")
    print(f"  - Badge           : \"{out.get('badge')}\"")
    print(f"  - Level           : \"{out.get('level')}\"")
    print()
