import json
import time
import urllib.request
import sys
import websocket

def discover_cdp_target():
    for port in [61009, 9222, 9229]:
        try:
            req = urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2)
            if req.status == 200:
                targets = json.loads(req.read().decode('utf-8'))
                for t in targets:
                    if t.get('type') == 'page' and 'webSocketDebuggerUrl' in t:
                        return port, t['webSocketDebuggerUrl'], t.get('url', '')
        except Exception as e:
            pass
    return None, None, None

port, ws_url, page_url = discover_cdp_target()
if not ws_url:
    print("[ERROR] CDP Page target not found.")
    sys.exit(1)

print(f"[CDP] Port: {port}")
print(f"[CDP] URL: {page_url}")
print(f"[CDP] WebSocket: {ws_url}")

ws = websocket.create_connection(ws_url, suppress_origin=True)
ws.settimeout(1.0)

# Enable domains
ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
ws.send(json.dumps({"id": 2, "method": "Runtime.enable"}))

injection_js = """
(function() {
    let existing = document.getElementById('contextguard-dom-badge');
    if (existing) {
        let tag = existing.getAttribute('data-cg-instance-id');
        return JSON.stringify({ status: 'ALREADY_EXISTS', tag: tag, origTag: window.__cg_original_tag });
    }
    let tag = 'cg-node-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
    let el = document.createElement('div');
    el.id = 'contextguard-dom-badge';
    el.setAttribute('data-cg-instance-id', tag);
    el.__cg_instance_tag = tag;
    window.__cg_original_tag = tag;
    
    el.style.position = 'fixed';
    el.style.top = '14px';
    el.style.right = '280px';
    el.style.zIndex = '999999';
    el.style.background = '#0F172A';
    el.style.color = '#22C55E';
    el.style.border = '2px solid #22C55E';
    el.style.borderRadius = '9999px';
    el.style.padding = '5px 14px';
    el.style.fontFamily = 'Consolas, monospace';
    el.style.fontSize = '12px';
    el.style.fontWeight = 'bold';
    el.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5)';
    el.innerHTML = '♡ ContextGuard: DOM Overlay Active';
    document.body.appendChild(el);
    return JSON.stringify({ status: 'INITIAL_INJECTION', tag: tag });
})()
"""

check_js = """
(function() {
    let el = document.getElementById('contextguard-dom-badge');
    if (!el) {
        return 'ELEMENT_WAS_MISSING';
    }
    let origTag = window.__cg_original_tag;
    let currentTag = el.getAttribute('data-cg-instance-id');
    let currentPropTag = el.__cg_instance_tag;
    
    if (origTag && currentTag === origTag && currentPropTag === origTag) {
        return 'OLD_ELEMENT_STILL_PRESENT';
    } else {
        return 'ELEMENT_WAS_MISSING_AND_RECREATED';
    }
})()
"""

# Initial injection
ws.send(json.dumps({"id": 10, "method": "Runtime.evaluate", "params": {"expression": injection_js}}))
resp = json.loads(ws.recv())
val_str = resp.get('result', {}).get('result', {}).get('value', '{}')
init_info = json.loads(val_str)
print(f"\n[INITIAL INJECTION RESULT] {init_info}")

# Baseline check
ws.send(json.dumps({"id": 11, "method": "Runtime.evaluate", "params": {"expression": check_js}}))
resp = json.loads(ws.recv())
baseline_status = resp.get('result', {}).get('result', {}).get('value', 'UNKNOWN')
print(f"[BASELINE CHECK] Node Status: {baseline_status}")

print("\n=======================================================")
print("  PRECISE DOM NODE SURVIVAL MONITORING RUNNING (30s)   ")
print("  Please perform chat-switches, panel toggles, etc.    ")
print("=======================================================\n")

start_time = time.time()
last_check_time = time.time()

while time.time() - start_time < 30:
    try:
        raw = ws.recv()
        msg = json.loads(raw)
        method = msg.get('method', '')
        params = msg.get('params', {})
        if method:
            print(f"[{time.strftime('%H:%M:%S')}] [CDP EVENT] {method}")
            if method == 'Page.navigatedWithinDocument':
                url = params.get('url', '')
                print(f"    --> SPA Navigation URL: {url}")
            elif method == 'Page.frameNavigated':
                url = params.get('frame', {}).get('url', '')
                print(f"    --> Frame Navigated URL: {url}")
            
            # Immediately check DOM survival on event!
            ws.send(json.dumps({"id": 200, "method": "Runtime.evaluate", "params": {"expression": check_js}}))
            chk_resp = json.loads(ws.recv())
            status = chk_resp.get('result', {}).get('result', {}).get('value', 'UNKNOWN')
            print(f"    --> Node Survival Check on Event: {status}")
    except websocket.WebSocketTimeoutException:
        pass
    except Exception as e:
        print(f"WS error: {e}")
        break

    if time.time() - last_check_time >= 3.0:
        ws.send(json.dumps({"id": 100, "method": "Runtime.evaluate", "params": {"expression": check_js}}))
        try:
            chk_resp = json.loads(ws.recv())
            status = chk_resp.get('result', {}).get('result', {}).get('value', 'UNKNOWN')
            print(f"[{time.strftime('%H:%M:%S')}] [PERIODIC CHECK] Node Status: {status}")
        except:
            pass
        last_check_time = time.time()

ws.close()
print("\n[MONITORING COMPLETE]")
