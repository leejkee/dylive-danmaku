// src/background/background.ts
// Background as persistent process: receives data and maintains state

interface DanmakuData {
    msg_id: string;
    timestamp: number;
    type: string;
    user: string;
    text: string;
}

let isCapturing = false;
let messageBuffer: DanmakuData[] = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Receive new danmaku from Content Script
    if (request.type === 'NEW_DANMAKU') {
        if (isCapturing) {
            messageBuffer.push(request.data);
            // Limit cache size to prevent memory overflow
            if (messageBuffer.length > 100) messageBuffer.shift();
            
            // Forward to Popup if open
            chrome.runtime.sendMessage(request).catch(() => {});
        }
    } 
    // Response to Popup: current state and cached data
    else if (request.type === 'GET_STATE') {
        sendResponse({ isCapturing, messages: messageBuffer });
    } 
    // Update capture state from Popup
    else if (request.type === 'SET_STATE') {
        isCapturing = request.isCapturing;
        if (!isCapturing) {
            // Clear buffer on stop (optional)
            messageBuffer = [];
        }
        sendResponse({ success: true });
    }
});
