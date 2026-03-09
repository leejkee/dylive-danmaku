// src/content-scripts/content.ts
(() => {
    console.log("[Content] Script loaded, ready to inject detector...");

    function injectScript(filePath: string) {
        const script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.setAttribute('src', chrome.runtime.getURL(filePath));
        document.documentElement.appendChild(script);
        
        script.onload = () => {
            console.log(`[Content] Detector (${filePath}) injected successfully, tag cleaned up`);
            script.remove();
        };
    }

    injectScript('inject-scripts/inject.js');

    // Listen for danmaku data from inject.js
    window.addEventListener("message", (event: MessageEvent) => {
        if (event.source !== window) return;
        
        if (event.data && event.data.type === 'DATA_FROM_INJECT') {
            const danmakuData = event.data.payload;
            
            console.log("[Content] Received danmaku from Inject, forwarding to Background ->", danmakuData);
            
            // Forward to Background
            chrome.runtime.sendMessage({
                type: 'NEW_DANMAKU',
                data: danmakuData
            }).catch((err) => {
                console.warn("[Content] Forward to Background failed, Background may not be active:", err);
            });
        }
    });

    // Listen for commands from popup
    chrome.runtime.onMessage.addListener((request: any) => {
        console.log("[Content] Received command from extension:", request);
        if (request.action === "START_HOOK") {
            console.log("[Content] Notifying Inject to start capturing...");
            window.postMessage({ type: 'CMD_FROM_CONTENT', action: 'START' }, '*');
        } else if (request.action === "STOP_HOOK") {
            console.log("[Content] Notifying Inject to stop capturing...");
            window.postMessage({ type: 'CMD_FROM_CONTENT', action: 'STOP' }, '*');
        }
    });
})();
