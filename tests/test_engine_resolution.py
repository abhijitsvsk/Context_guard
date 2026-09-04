import subprocess
import json

test_js = """
const engine = require('os.getcwd()/.agents/contextguard/engine.js');

const chatsToTest = [
    'abe85271-ee69-4a49-81d6-e6c6fb9396df', // current active chat
    '0dfcd89f-b50f-4829-ba88-824449b25316', // previous chat
    '24858c01-0619-4d4f-a5a0-d482f8c7413d', // missing transcript
    'c3e511ab-c9a3-48fd-ac33-84af51c68f84'  // small 2KB transcript
];

for (const id of chatsToTest) {
    const res = engine.updateChatState(id, process.cwd());
    console.log(`[CHAT ${id.substring(0,8)}] Pct: ${res.percentageUsed !== null ? res.percentageUsed + '%' : 'NO_DATA'}, Tokens: ${res.tokensUsed}, Precision: '${res.precision}', Badge: '${res.badge}'`);
}
"""

res = subprocess.run(['node', '-e', test_js], capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("ERR:", res.stderr)
