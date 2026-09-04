import urllib.request, json, asyncio, websockets, time, os

async def test_live():
    res = urllib.request.urlopen('http://127.0.0.1:50270/json')
    targets = json.loads(res.read())
    p = next(t for t in targets if t.get('type') == 'page')
    async with websockets.connect(p['webSocketDebuggerUrl']) as ws:
        await asyncio.sleep(1.0)
        
        # 1. Inspect initial badge state (must be collapsed)
        eval_state = '''
        (() => {
            const el = document.getElementById('contextguard-dom-badge');
            const header = document.getElementById('contextguard-badge-header');
            const panel = document.getElementById('contextguard-badge-panel');
            const btn = document.getElementById('contextguard-handoff-action-btn');
            return {
                exists: !!el,
                hasHeader: !!header,
                hasPanel: !!panel,
                panelDisplay: panel ? panel.style.display : null,
                isExpanded: el ? !!el.__isExpanded : false,
                headerText: header ? header.innerText.trim() : null
            };
        })()
        '''
        await ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': eval_state, 'returnByValue': True}}))
        r1 = json.loads(await ws.recv())['result']['result']['value']
        print('1. INITIAL BADGE STATE (COLLAPSED):', json.dumps(r1, indent=2))

        # 2. Click the header to expand
        click_header = '''
        (() => {
            const header = document.getElementById('contextguard-badge-header');
            if (!header) return { clicked: false };
            header.click();
            const panel = document.getElementById('contextguard-badge-panel');
            const el = document.getElementById('contextguard-dom-badge');
            const btn = document.getElementById('contextguard-handoff-action-btn');
            return {
                clicked: true,
                isExpanded: el ? !!el.__isExpanded : false,
                panelDisplay: panel ? panel.style.display : null,
                panelVisible: panel ? (panel.offsetHeight > 0) : false,
                buttonVisible: btn ? (btn.offsetHeight > 0) : false,
                buttonText: btn ? btn.innerText.trim() : null
            };
        })()
        '''
        await ws.send(json.dumps({'id': 2, 'method': 'Runtime.evaluate', 'params': {'expression': click_header, 'returnByValue': True}}))
        r2 = json.loads(await ws.recv())['result']['result']['value']
        print('\n2. AFTER HEADER CLICK (EXPANDED):', json.dumps(r2, indent=2))

        # 3. Click the handoff button
        click_btn = '''
        (() => {
            const btn = document.getElementById('contextguard-handoff-action-btn');
            if (!btn) return { clicked: false };
            btn.click();
            return { clicked: true };
        })()
        '''
        await ws.send(json.dumps({'id': 3, 'method': 'Runtime.evaluate', 'params': {'expression': click_btn, 'returnByValue': True}}))
        r3 = json.loads(await ws.recv())['result']['result']['value']
        print('\n3. CLICKED HANDOFF BUTTON:', json.dumps(r3, indent=2))

        await asyncio.sleep(0.5)

        # 4. Check button feedback text
        check_btn = '''
        (() => {
            const btn = document.getElementById('contextguard-handoff-action-btn');
            return btn ? btn.innerText.trim() : null;
        })()
        '''
        await ws.send(json.dumps({'id': 4, 'method': 'Runtime.evaluate', 'params': {'expression': check_btn, 'returnByValue': True}}))
        btn_text = json.loads(await ws.recv())['result']['result']['value']
        btn_clean = btn_text.encode('ascii', 'backslashreplace').decode('ascii') if btn_text else None
        print('Button feedback text (ASCII):', repr(btn_clean))

        # 5. Click outside to test collapse
        click_outside = '''
        (() => {
            document.body.click();
            const el = document.getElementById('contextguard-dom-badge');
            const panel = document.getElementById('contextguard-badge-panel');
            return {
                isExpandedAfterOutsideClick: el ? !!el.__isExpanded : false,
                panelDisplay: panel ? panel.style.display : null
            };
        })()
        '''
        await ws.send(json.dumps({'id': 5, 'method': 'Runtime.evaluate', 'params': {'expression': click_outside, 'returnByValue': True}}))
        r4 = json.loads(await ws.recv())['result']['result']['value']
        print('\n4. OUTSIDE CLICK (COLLAPSE CHECK):', json.dumps(r4, indent=2))

if __name__ == '__main__':
    asyncio.run(test_live())
