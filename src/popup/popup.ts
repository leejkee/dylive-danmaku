// src/popup/popup.ts
interface DanmakuData {
    msg_id: string;
    timestamp: number;
    type: string; 
    user: string;
    text: string;
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleBtn') as HTMLButtonElement;
    const statusSpan = document.getElementById('status') as HTMLSpanElement;
    const danmakuList = document.getElementById('danmakuList') as HTMLDivElement;
    
    let isCapturing = false;

    function getBadgeClass(type: string): string {
        switch(type) {
            case 'chat': 
            case 'screen_chat': return 'type-chat';
            case 'gift': 
            case 'lucky_box': return 'type-gift';
            case 'enter': return 'type-enter';
            case 'like': return 'type-like';
            default: return 'type-other';
        }
    }

    function renderDanmakuToUI(data: DanmakuData) {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.remove();
        
        const div = document.createElement('div');
        div.className = 'danmaku-item';
        div.innerHTML = `
            <span class="type-badge ${getBadgeClass(data.type)}">${data.type.toUpperCase()}</span>
            <span class="user">${data.user}:</span>
            <span class="text">${data.text}</span>
        `;
        
        danmakuList.appendChild(div);
        danmakuList.scrollTop = danmakuList.scrollHeight;
        
        if (danmakuList.children.length > 100) {
            danmakuList.removeChild(danmakuList.firstChild as Node);
        }
    }

    // Update UI state
    function updateUIState() {
        if (isCapturing) {
            toggleBtn.textContent = 'Stop Capture';
            toggleBtn.style.backgroundColor = '#ef4444';
            statusSpan.textContent = 'Capturing...';
            statusSpan.style.color = '#16a34a';
        } else {
            toggleBtn.textContent = 'Start Capture';
            toggleBtn.style.backgroundColor = '#3b82f6';
            statusSpan.textContent = 'Paused';
            statusSpan.style.color = '#6b7280';
        }
    }

    // Initialize: request current state and cached messages from Background
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
        if (response) {
            isCapturing = response.isCapturing;
            updateUIState();
            if (response.messages && response.messages.length > 0) {
                response.messages.forEach(renderDanmakuToUI);
            }
        }
    });

    // Handle button click
    toggleBtn.addEventListener('click', () => {
        isCapturing = !isCapturing;
        updateUIState();
        
        // Notify Background of state change
        chrome.runtime.sendMessage({ type: 'SET_STATE', isCapturing });

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            if (!currentTab || !currentTab.url || !currentTab.url.includes('live.douyin.com')) {
                alert("Please enable capture on a Douyin live streaming page!");
                return;
            }
            // Notify Content Script to start/stop Inject Hook
            chrome.tabs.sendMessage(currentTab.id!, {
                action: isCapturing ? "START_HOOK" : "STOP_HOOK"
            }).catch(()=>{});
        });
    });

    // Listen for real-time new danmaku
    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'NEW_DANMAKU' && isCapturing) {
            renderDanmakuToUI(request.data);
        }
    });
});
