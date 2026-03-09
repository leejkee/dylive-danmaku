// src/inject-scripts/inject.ts
(() => {
    // Prevent duplicate injection
    if ((window as any).__DOUYIN_HOOK_INJECTED) return;
    (window as any).__DOUYIN_HOOK_INJECTED = true;

    interface DanmakuData {
        msg_id: string;
        timestamp: number;
        type: 'chat' | 'screen_chat' | 'gift' | 'enter' | 'like' | 'follow' | 'system' | 'fansclub' | 'lucky_box' | 'unknown';
        user: string;
        text: string;
        gift_name?: string;
        gift_count?: number;
    }

    class DouyinDanmakuInjector {
        private isRunning: boolean = false;
        private observer: MutationObserver | null = null;
        private scanTimer: number | null = null;
        private processedMsgIds: Set<string> = new Set<string>();

        private readonly classPrefixRegex = /(^|\s)webcast-(chatroom|room)___item/;

        constructor() {
            console.log("[Inject] Ready");
            this.initMessageListener();
        }

        private initMessageListener(): void {
            window.addEventListener("message", (event: MessageEvent) => {
                if (event.source !== window) return;
                const msg = event.data;
                if (msg && msg.type === "CMD_FROM_CONTENT") {
                    console.log(`[Inject] Received command from Content: ${msg.action}`);
                    if (msg.action === "START") this.start();
                    else if (msg.action === "STOP") this.stop();
                }
            }, false);
        }

        public start(): void {
            if (this.isRunning) return;
            this.isRunning = true;
            
            // Fix: Prevent clearing processed IDs on resume
            // This avoids re-capturing existing messages

            this.scanTimer = window.setInterval(() => {
                this.scanAll();
            }, 500);

            this.observer = new MutationObserver(() => {
                if (!this.isRunning) return;
                this.scanAll();
            });

            this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
            console.log("[Inject] Listener started (deduplication mode active)");
        }

        public stop(): void {
            if (!this.isRunning) return;
            this.isRunning = false;
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.scanTimer) {
                window.clearInterval(this.scanTimer);
                this.scanTimer = null;
            }
            console.log("[Inject] Listener stopped");
        }

        private scanAll(): void {
            const items = document.querySelectorAll('[class*="webcast-chatroom___item"]');
            items.forEach(el => this.extractDataFromFiber(el));

            const listRoot = document.querySelector('.webcast-chatroom___list');
            if (listRoot) {
                this.extractDataFromFiber(listRoot);
                if (listRoot.parentElement) this.extractDataFromFiber(listRoot.parentElement);
            }
        }

        private extractDataFromFiber(node: Element): void {
            const fiberKey = Object.keys(node).find(k => k.startsWith('__reactFiber$'));
            if (!fiberKey) return;

            // @ts-ignore
            let fiberNode = node[fiberKey];
            let depth = 0;

            while (fiberNode && depth < 10) {
                const props = fiberNode.memoizedProps;

                if (props) {
                    const arrays = [props.source, props.messages, props.data].filter(Array.isArray);
                    for (const arr of arrays) {
                        arr.forEach((msg: any) => this.parseAndSendMessage(msg));
                    }
                }

                if (props && props.message && (props.message.msg_id || props.message.common?.msg_id)) {
                    this.parseAndSendMessage(props.message);
                } else if (props && props.children?.props?.message && (props.children.props.message.msg_id || props.children.props.message.common?.msg_id)) {
                    this.parseAndSendMessage(props.children.props.message);
                }

                fiberNode = fiberNode.return;
                depth++;
            }
        }

        private parseAndSendMessage(rawMsg: any): void {
            if (!rawMsg) return;
            
            const payload = rawMsg.payload || {};
            
            // Enhanced ID extraction for varying message structures
            let msgId = rawMsg.msg_id || 
                        payload.common?.msg_id || 
                        rawMsg.common?.msg_id || 
                        rawMsg.id?.toString();
                        
            if (!msgId) return;

            // Convert Long/BigInt to string
            if (typeof msgId === 'object') msgId = msgId.toString();
            msgId = String(msgId);

            // Skip invalid IDs
            if (msgId === 'undefined' || msgId === '[object Object]') return;

            // Deduplication check
            if (this.processedMsgIds.has(msgId)) return;
            this.processedMsgIds.add(msgId);

            // Memory protection: prevent Set from growing infinitely
            if (this.processedMsgIds.size > 5000) {
                // Remove oldest 1000 entries when cache exceeds 5000
                const iterator = this.processedMsgIds.values();
                for (let i = 0; i < 1000; i++) {
                    const value = iterator.next().value;
                    if (value !== undefined) {
                        this.processedMsgIds.delete(value);
                    }
                }
            }

            const method = rawMsg.method;
            const nickname = payload.user?.desensitized_nickname || payload.user?.nickname || "System/Unknown";

            let type: DanmakuData['type'] = 'unknown';
            let text = "";
            let giftName = undefined;
            let giftCount = undefined;

            switch (method) {
                case 'WebcastChatMessage':
                case 'WebcastEmojiChatMessage':
                    type = 'chat'; text = payload.content || "[Sticker/Chat]"; break;
                case 'WebcastScreenChatMessage':
                case 'WebcastPrivilegeScreenChatMessage':
                case 'WebcastExhibitionChatMessage':
                    type = 'screen_chat'; text = payload.content || "[Special Screen Message]"; break;
                case 'WebcastGiftMessage':
                    type = 'gift'; giftName = payload.gift?.name || "Unknown Gift"; giftCount = payload.combo_count || payload.count || 1; text = `Sent [${giftName}] x ${giftCount}`; break;
                case 'WebcastMemberMessage':
                    type = 'enter'; text = "Entered the live room"; break;
                case 'WebcastLikeMessage':
                    type = 'like'; text = `Liked the live room (${payload.count || 1} times)`; break;
                default:
                    type = 'unknown'; text = `[Unknown event: ${method}]`;
            }

            const msgStruct: DanmakuData = {
                msg_id: msgId, timestamp: Date.now(), type: type, user: nickname, text: text, gift_name: giftName, gift_count: giftCount
            };

            console.log(`[Inject] Parsed danmaku: [${type}] ${nickname}: ${text}`);
            window.postMessage({ type: 'DATA_FROM_INJECT', payload: msgStruct }, '*');
        }
    }

    new DouyinDanmakuInjector();
})();
