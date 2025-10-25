// WebSocket Connection Management
export class WebSocketManager {
    constructor(onMessage, onOpen, onClose, onError) {
        this.ws = null;
        this.connectionAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.onMessage = onMessage;
        this.onOpen = onOpen;
        this.onClose = onClose;
        this.onError = onError;
        this.heartbeatInterval = null;
    }

    connect() {
        if (this.connectionAttempts >= this.maxReconnectAttempts) {
            this.onError('Unable to connect to the server.');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => this.handleOpen();
        this.ws.onmessage = (event) => this.handleMessage(event);
        this.ws.onclose = (event) => this.handleClose(event);
        this.ws.onerror = (error) => this.handleError(error);
    }

    handleOpen() {
        console.log('✅ Connected to ShareIt server');
        this.connectionAttempts = 0;
        this.startHeartbeat();
        this.onOpen();
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.onMessage(message);
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    handleClose(event) {
        console.log(`❌ Disconnected from server: ${event.code}`);
        this.stopHeartbeat();
        this.connectionAttempts++;
        const delay = Math.min(1000 * (2 ** this.connectionAttempts), 10000);
        setTimeout(() => this.connect(), delay);
        this.onClose(event);
    }

    handleError(error) {
        console.error('WebSocket error:', error);
        this.onError(error);
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendMessage({ type: 'heartbeat' });
            }
        }, 25000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
        }
    }
}
