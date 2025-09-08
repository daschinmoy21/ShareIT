class ShareItClient {
    constructor() {
        this.ws = null;
        this.peerId = null;
        this.deviceName = '';
        this.peers = new Map();
        this.connections = new Map();
        this.dataChannels = new Map();
        this.selectedFiles = [];
        this.activeTransfers = new Map();
        this.connectionAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.selectedPeer = null;

        this.initializeUI();
        this.connect();
        this.startHeartbeat();
    }

    // Initialization
    initializeUI() {
        this.ui = {
            deviceNameInput: document.getElementById('device-name'),
            deviceId: document.getElementById('device-id'),
            peersList: document.getElementById('peers-list'),
            messagingSection: document.getElementById('messaging-section'),
            messagesList: document.getElementById('messages-list'),
            messageInput: document.getElementById('message-input'),
            sendMessageBtn: document.getElementById('send-message-btn'),
            fileInput: document.getElementById('file-input'),
            selectFilesBtn: document.getElementById('select-files'),
            dropZone: document.getElementById('drop-zone'),
            selectedFiles: document.getElementById('selected-files'),
            transfersSection: document.getElementById('transfers-section'),
            transfersList: document.getElementById('transfers-list'),
            notification: document.getElementById('notification'),
            connectionError: document.getElementById('connection-error'),
            incomingFileModal: document.getElementById('incoming-file-modal'),
            incomingFileInfo: document.getElementById('incoming-file-info'),
            acceptTransferBtn: document.getElementById('accept-transfer'),
            rejectTransferBtn: document.getElementById('reject-transfer'),
            transferItemTemplate: document.getElementById('transfer-item-template'),
        };

        this.ui.deviceNameInput.value = this.generateDeviceName();
        this.deviceName = this.ui.deviceNameInput.value;

        this.addEventListeners();
    }

    addEventListeners() {
        this.ui.deviceNameInput.addEventListener('input', (e) => this.handleDeviceNameInput(e));
        this.ui.deviceNameInput.addEventListener('blur', () => this.setDeviceName());
        this.ui.selectFilesBtn.addEventListener('click', () => this.ui.fileInput.click());
        this.ui.fileInput.addEventListener('change', (e) => this.handleFileSelection(Array.from(e.target.files)));
        this.ui.sendMessageBtn.addEventListener('click', () => this.sendMessageToPeer());

        // Drag and drop
        this.ui.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.ui.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.ui.dropZone.addEventListener('drop', (e) => this.handleDrop(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    // WebSocket Connection
    connect() {
        if (this.connectionAttempts >= this.maxReconnectAttempts) {
            this.showConnectionError('Unable to connect to the server.');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => this.handleWsOpen();
        this.ws.onmessage = (event) => this.handleWsMessage(event);
        this.ws.onclose = (event) => this.handleWsClose(event);
        this.ws.onerror = (error) => this.handleWsError(error);
    }

    startHeartbeat() {
        setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendMessage({ type: 'heartbeat' });
            }
        }, 25000);
    }

    // WebSocket Event Handlers
    handleWsOpen() {
        console.log('✅ Connected to ShareIt server');
        this.connectionAttempts = 0;
        this.hideConnectionError();
        this.setDeviceName();
    }

    handleWsMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.handleSignalingMessage(message);
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    handleWsClose(event) {
        console.log(`❌ Disconnected from server: ${event.code}`);
        this.connectionAttempts++;
        const delay = Math.min(1000 * (2 ** this.connectionAttempts), 10000);
        setTimeout(() => this.connect(), delay);
    }

    handleWsError(error) {
        console.error('WebSocket error:', error);
        this.showConnectionError('Connection error. Please refresh the page.');
    }

    // Signaling
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    handleSignalingMessage(message) {
        switch (message.type) {
            case 'peer-id':
                this.peerId = message.id;
                this.ui.deviceId.textContent = `ID: ${this.peerId.slice(0, 8)}`;
                break;
            case 'peers-updated':
                this.updatePeersList(message.peers);
                break;
            case 'offer':
                this.handleOffer(message);
                break;
            case 'answer':
                this.handleAnswer(message);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(message);
                break;
            case 'error':
                this.showNotification(`Error: ${message.message}`, 'error');
                break;
        }
    }

    // UI Handlers
    handleDeviceNameInput(e) {
        this.deviceName = e.target.value.slice(0, 50);
    }

    setDeviceName() {
        if (t is.deviceName.trim()) {
            this.sendMessage({ type: 'set-name', name: this.deviceName.trim() });
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        this.ui.dropZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.ui.dropZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.ui.dropZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            this.handleFileSelection(files);
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && this.ui.messageInput === document.activeElement) {
            this.sendMessageToPeer();
        }
    }

    // Peer Management
    updatePeersList(peers) {
        const otherPeers = peers.filter(peer => peer.id !== this.peerId);
        this.peers.clear();
        otherPeers.forEach(peer => this.peers.set(peer.id, peer));

        if (otherPeers.length === 0) {
            this.ui.peersList.innerHTML = '<div class="no-peers">Searching for devices on your network...</div>';
            this.ui.messagingSection.style.display = 'none';
            this.selectedPeer = null;
            return;
        }

        this.ui.peersList.innerHTML = otherPeers.map(peer => this.createPeerCard(peer)).join('');

        if (this.selectedPeer && !this.peers.has(this.selectedPeer)) {
            this.selectedPeer = null;
            this.ui.messagingSection.style.display = 'none';
        }
    }

    createPeerCard(peer) {
        const isConnected = this.connections.has(peer.id);
        const isSelected = this.selectedPeer === peer.id;
        return `
            <div class="peer-card ${isConnected ? 'connected' : ''} ${isSelected ? 'selected' : ''}" onclick="client.handlePeerClick('${peer.id}')">
                <div class="peer-avatar">${this.getPeerIcon(peer)}</div>
                <div class="peer-name">${this.escapeHtml(peer.name)}</div>
                <div class="peer-status">${isConnected ? '🟢 Connected' : '🔵 Available'}</div>
            </div>
        `;
    }

    async handlePeerClick(peerId) {
        this.selectedPeer = peerId;
        this.updatePeersList(Array.from(this.peers.values()));
        this.ui.messagingSection.style.display = 'block';

        await this.connectToPeer(peerId);

        if (this.selectedFiles.length > 0) {
            await this.sendFiles(peerId, this.selectedFiles);
        }
    }

    // WebRTC Connection
    async connectToPeer(peerId) {
        if (this.connections.has(peerId)) {
            const dataChannel = this.dataChannels.get(peerId);
            if (dataChannel && dataChannel.readyState === 'open') {
                return this.connections.get(peerId);
            }
        }

        this.showNotification(`Connecting to ${this.peers.get(peerId)?.name}...`, 'info');
        const connection = this.createPeerConnection(peerId);
        const dataChannel = connection.createDataChannel('main');
        this.setupDataChannel(dataChannel, peerId);
        this.dataChannels.set(peerId, dataChannel);

        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        this.sendMessage({ type: 'offer', target: peerId, offer });

        this.connections.set(peerId, connection);
        return connection;
    }

    createPeerConnection(peerId) {
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const connection = new RTCPeerConnection(configuration);

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendMessage({ type: 'ice-candidate', target: peerId, candidate: event.candidate });
            }
        };

        connection.onconnectionstatechange = () => {
            this.handleConnectionStateChange(peerId, connection.connectionState);
        };

        connection.ondatachannel = (event) => {
            const dataChannel = event.channel;
            this.setupDataChannel(dataChannel, peerId);
            this.dataChannels.set(peerId, dataChannel);
        };

        return connection;
    }

    handleConnectionStateChange(peerId, state) {
        console.log(`Connection state with ${peerId}: ${state}`);
        switch (state) {
            case 'connected':
                this.showNotification(`Connected to ${this.peers.get(peerId)?.name}`, 'success');
                this.updatePeersList(Array.from(this.peers.values()));
                break;
            case 'disconnected':
            case 'failed':
                this.connections.delete(peerId);
                this.dataChannels.delete(peerId);
                this.updatePeersList(Array.from(this.peers.values()));
                this.showNotification(`Disconnected from ${this.peers.get(peerId)?.name}`, 'warning');
                if (this.selectedPeer === peerId) {
                    this.selectedPeer = null;
                    this.ui.messagingSection.style.display = 'none';
                }
                break;
        }
    }

    // WebRTC Signaling Handlers
    async handleOffer(message) {
        const connection = this.createPeerConnection(message.from);
        await connection.setRemoteDescription(message.offer);

        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        this.sendMessage({ type: 'answer', target: message.from, answer });
        this.connections.set(message.from, connection);
    }

    async handleAnswer(message) {
        const connection = this.connections.get(message.from);
        if (connection) {
            await connection.setRemoteDescription(message.answer);
        }
    }

    async handleIceCandidate(message) {
        const connection = this.connections.get(message.from);
        if (connection) {
            await connection.addIceCandidate(message.candidate);
        }
    }

    // Data Channel
    setupDataChannel(dataChannel, peerId) {
        dataChannel.onopen = () => console.log(`Data channel with ${peerId} is open`);
        dataChannel.onmessage = (event) => this.handleDataChannelMessage(event, peerId);
        dataChannel.onerror = (error) => console.error('Data channel error:', error);
        dataChannel.onclose = () => console.log(`Data channel with ${peerId} is closed`);
    }

    handleDataChannelMessage(event, peerId) {
        if (typeof event.data === 'string') {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'text':
                    this.displayMessage(message.content, 'received');
                    break;
                case 'file-offer':
                    this.handleFileOffer(message, peerId);
                    break;
                case 'file-accept':
                    this.startFileSend(message.transferId);
                    break;
                case 'file-reject':
                    this.handleFileReject(message.transferId);
                    break;
            }
        } else {
            this.handleFileChunk(event.data);
        }
    }

    // Messaging
    sendMessageToPeer() {
        const message = this.ui.messageInput.value.trim();
        if (!message || !this.selectedPeer) return;

        const dataChannel = this.dataChannels.get(this.selectedPeer);
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({ type: 'text', content: message }));
            this.displayMessage(message, 'sent');
            this.ui.messageInput.value = '';
        } else {
            this.showNotification('Not connected to peer. Please select a peer.', 'warning');
        }
    }

    displayMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        this.ui.messagesList.appendChild(messageElement);
        this.ui.messagesList.scrollTop = this.ui.messagesList.scrollHeight;
    }

    // File Handling
    handleFileSelection(files) {
        this.selectedFiles = files.filter(file => {
            if (file.size > 100 * 1024 * 1024) { // 100MB limit
                this.showNotification(`File ${file.name} is too large (max 100MB)`, 'warning');
                return false;
            }
            return true;
        });
        this.updateSelectedFilesUI();

        if (this.selectedPeer && this.selectedFiles.length > 0) {
            this.sendFiles(this.selectedPeer, this.selectedFiles);
        }
    }

    updateSelectedFilesUI() {
        if (this.selectedFiles.length === 0) {
            this.ui.selectedFiles.innerHTML = '';
            return;
        }

        this.ui.selectedFiles.innerHTML = `
            <h3>Selected Files (${this.selectedFiles.length})</h3>
            ${this.selectedFiles.map((file, index) => `
                <div class="file-item">
                    <span class="file-icon">${this.getFileIcon(file.type)}</span>
                    <span class="file-name">${this.escapeHtml(file.name)}</span>
                    <span class="file-size">${this.formatFileSize(file.size)}</span>
                    <button onclick="client.removeFile(${index})" class="remove-file-btn">×</button>
                </div>
            `).join('')}
            <button onclick="client.clearSelectedFiles()" class="clear-files-btn">Clear</button>
        `;
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateSelectedFilesUI();
    }

    clearSelectedFiles() {
        this.selectedFiles = [];
        this.ui.fileInput.value = '';
        this.updateSelectedFilesUI();
    }

    async sendFiles(peerId, files) {
        const dataChannel = this.dataChannels.get(peerId);
        if (!dataChannel || dataChannel.readyState !== 'open') {
            this.showNotification('Connection not ready. Please try again.', 'warning');
            return;
        }

        for (const file of files) {
            const transferId = this.generateTransferId();
            this.activeTransfers.set(transferId, { file, peerId, type: 'outgoing' });
            this.addTransferToUI(transferId, file.name, file.size, 'outgoing');

            dataChannel.send(JSON.stringify({
                type: 'file-offer',
                transferId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
            }));
            console.log(`Sent file offer for ${file.name} with transfer ID ${transferId}`);
        }

        this.clearSelectedFiles();
    }

    // File Transfer Flow
    handleFileOffer(offer, peerId) {
        const { transferId, fileName, fileSize } = offer;
        this.ui.incomingFileInfo.textContent = `From: ${this.peers.get(peerId)?.name} (${this.formatFileSize(fileSize)}) - ${fileName}`;
        this.ui.incomingFileModal.style.display = 'flex';

        const accept = () => {
            this.activeTransfers.set(transferId, { fileName, fileSize, peerId, type: 'incoming', chunks: [], receivedSize: 0 });
            this.addTransferToUI(transferId, fileName, fileSize, 'incoming');
            const dataChannel = this.dataChannels.get(peerId);
            dataChannel.send(JSON.stringify({ type: 'file-accept', transferId }));
            this.ui.incomingFileModal.style.display = 'none';
        };

        const reject = () => {
            const dataChannel = this.dataChannels.get(peerId);
            dataChannel.send(JSON.stringify({ type: 'file-reject', transferId }));
            this.ui.incomingFileModal.style.display = 'none';
        };

        this.ui.acceptTransferBtn.addEventListener('click', accept, { once: true });
        this.ui.rejectTransferBtn.addEventListener('click', reject, { once: true });
    }

    handleFileReject(transferId) {
        this.updateTransferStatus(transferId, '❌ Rejected');
        this.activeTransfers.delete(transferId);
    }

    startFileSend(transferId) {
        const transfer = this.activeTransfers.get(transferId);
        if (!transfer) return;

        const { file, peerId } = transfer;
        const dataChannel = this.dataChannels.get(peerId);
        const chunkSize = 16384; // 16KB
        let offset = 0;

        const reader = new FileReader();
        reader.onload = (e) => {
            dataChannel.send(e.target.result);
            offset += e.target.result.byteLength;
            this.updateTransferProgress(transferId, offset / file.size);

            if (offset < file.size) {
                readSlice(offset);
            } else {
                this.completeTransfer(transferId);
            }
        };

        const readSlice = (o) => {
            const slice = file.slice(o, o + chunkSize);
            reader.readAsArrayBuffer(slice);
        };

        readSlice(0);
        console.log(`Started sending file ${file.name} with transfer ID ${transferId}`);
    }

    handleFileChunk(data) {
        // This is a bit tricky since we don't know which transfer this chunk belongs to without more info.
        // For now, we'll assume it belongs to the most recent incoming transfer.
        const incomingTransfers = Array.from(this.activeTransfers.entries()).filter(([id, t]) => t.type === 'incoming');
        if (incomingTransfers.length > 0) {
            const [transferId, transfer] = incomingTransfers[incomingTransfers.length - 1];
            transfer.chunks.push(data);
            transfer.receivedSize += data.byteLength;
            this.updateTransferProgress(transferId, transfer.receivedSize / transfer.fileSize);

            if (transfer.receivedSize === transfer.fileSize) {
                this.completeFileReceive(transferId);
            }
        }
    }

    completeFileReceive(transferId) {
        const transfer = this.activeTransfers.get(transferId);
        if (!transfer) return;

        const blob = new Blob(transfer.chunks, { type: transfer.fileType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = transfer.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        this.completeTransfer(transferId);
        console.log(`Finished receiving file ${transfer.fileName}`);
    }

    // UI Updates for Transfers
    addTransferToUI(transferId, fileName, fileSize, direction) {
        this.ui.transfersSection.style.display = 'block';
        const template = this.ui.transferItemTemplate.content.cloneNode(true);
        const item = template.querySelector('.transfer-item');
        item.id = `transfer-${transferId}`;

        item.querySelector('.file-icon').textContent = this.getFileIcon('');
        item.querySelector('.file-name').textContent = fileName;
        item.querySelector('.file-size').textContent = this.formatFileSize(fileSize);
        item.querySelector('.transfer-status').textContent = direction === 'incoming' ? '📥 Incoming' : '📤 Outgoing';
        item.querySelector('.cancel-btn').onclick = () => this.cancelTransfer(transferId);

        this.ui.transfersList.appendChild(template);
    }

    updateTransferProgress(transferId, progress) {
        const item = document.getElementById(`transfer-${transferId}`);
        if (item) {
            item.querySelector('.transfer-progress-bar').style.width = `${progress * 100}%`;
            item.querySelector('.transfer-status').textContent = `📡 ${Math.round(progress * 100)}%`;
        }
    }

    updateTransferStatus(transferId, status) {
        const item = document.getElementById(`transfer-${transferId}`);
        if (item) {
            item.querySelector('.transfer-status').textContent = status;
        }
    }

    completeTransfer(transferId) {
        this.updateTransferStatus(transferId, '✅ Completed');
        this.activeTransfers.delete(transferId);
    }

    cancelTransfer(transferId) {
        const transfer = this.activeTransfers.get(transferId);
        if (!transfer) return;

        // TODO: Send cancellation message to the other peer
        this.updateTransferStatus(transferId, '❌ Canceled');
        this.activeTransfers.delete(transferId);
    }

    // Utility Functions
    generateDeviceName() {
        const adjectives = ['Quick', 'Smart', 'Fast', 'Cool', 'Swift', 'Bright'];
        const nouns = ['Phone', 'Laptop', 'Desktop', 'Tablet', 'Device', 'Computer'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return `${adj} ${noun}`;
    }

    getPeerIcon(peer) {
        const name = peer.name.toLowerCase();
        if (name.includes('phone') || name.includes('mobile')) return '📱';
        if (name.includes('laptop')) return '💻';
        if (name.includes('desktop')) return '🖥️';
        return '📱';
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.startsWith('text/')) return '📄';
        if (mimeType.includes('pdf')) return '📕';
        return '📎';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateTransferId() {
        return Math.random().toString(36).substr(2, 9);
    }

    showNotification(message, type = 'info') {
        this.ui.notification.className = `notification ${type}`;
        this.ui.notification.textContent = message;
        this.ui.notification.style.display = 'block';
        setTimeout(() => this.ui.notification.style.display = 'none', 3000);
    }

    showConnectionError(message) {
        this.ui.connectionError.innerHTML = `<p>⚠️ ${message}</p><button onclick="location.reload()">Reload</button>`;
        this.ui.connectionError.style.display = 'block';
    }

    hideConnectionError() {
        this.ui.connectionError.style.display = 'none';
    }
}

let client;
document.addEventListener('DOMContentLoaded', () => {
    client = new ShareItClient();
});
