import subprocess
import json
import datetime

tests = [
    ("Modern JSONL", "abe85271-ee69-4a49-81d6-e6c6fb9396df"),
    ("Intermediate Overview", "24858c01-0619-4d4f-a5a0-d482f8c7413d"),
    ("Old Protobuf", "71b20f30-5940-435a-b7d1-9512ae6f373d"),
    ("Empty/Non-existent", "test_race_condition_session_999")
]

print(f"=== CROSS-TIER VERIFICATION TIMESTAMP: {datetime.datetime.now().isoformat()} ===\n")

for label, sid in tests:
    js_cmd = f"""
    const engine = require('os.getcwd()/.agents/contextguard/engine.js');
    const res = engine.updateChatState('{sid}', process.cwd());
    console.log(JSON.stringify(res));
    """
    res = subprocess.run(['node', '-e', js_cmd], capture_output=True, text=True)
    out = json.loads(res.stdout.strip())
    print(f"[{label}] Session: {sid}")
    print(f"  - Percentage : {out.get('percentageUsed')}")
    print(f"  - Tokens     : {out.get('tokensUsed')}")
    print(f"  - Precision  : '{out.get('precision')}'")
    print(f"  - Badge      : '{out.get('badge')}'")
    print()
