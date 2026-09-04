import asyncio
import json
import websockets
import urllib.request

async def get_dom_badge():
    res = urllib.request.urlopen('http://127.0.0.1:50270/json')
    targets = json.loads(res.read())
    page_target = next(t for t in targets if t.get('type') == 'page')
    ws_url = page_target['webSocketDebuggerUrl']
    
    async with websockets.connect(ws_url) as ws:
        # Evaluate DOM badge properties
        eval_expr = """
        (() => {
            const el = document.getElementById('contextguard-dom-badge');
            if (!el) return { exists: false };
            const style = window.getComputedStyle(el);
            return {
                exists: true,
                id: el.id,
                innerText: el.innerText,
                innerHTML: el.innerHTML,
                outerHTML: el.outerHTML,
                color: style.color,
                borderColor: style.borderColor,
                backgroundColor: style.backgroundColor,
                display: style.display,
                visibility: style.visibility,
                position: style.position,
                top: style.top,
                right: style.right,
                zIndex: style.zIndex
            };
        })()
        """
        msg = {
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {
                "expression": eval_expr,
                "returnByValue": True
            }
        }
        await ws.send(json.dumps(msg))
        resp = await ws.recv()
        data = json.loads(resp)
        print("DOM BADGE EVALUATION RESULT:")
        print(json.dumps(data['result']['result']['value'], indent=2))

asyncio.run(get_dom_badge())
