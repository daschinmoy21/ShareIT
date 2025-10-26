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
            conversionSection: document.getElementById('conversion-section'),
            conversionMessage: document.getElementById('conversion-message'),
            convertFromFormat: document.getElementById('convert-from-format'),
            convertToFormat: document.getElementById('convert-to-format'),
            convertBtn: document.getElementById('convert-btn'),
            sendOriginalBtn: document.getElementById('send-original-btn'),
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
        this.ui.convertFromFormat.addEventListener('change', () => this.updateConversionUI());
        this.ui.convertToFormat.addEventListener('change', () => this.updateConversionUI());
        this.ui.convertBtn.addEventListener('click', () => this.convertFile());
        this.ui.sendOriginalBtn.addEventListener('click', () => this.sendOriginalFiles());

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
        if (this.deviceName.trim()) {
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
            <button class="w-full text-left bg-orange-600 hover:bg-orange-700 border border-orange-500 rounded-lg p-4 cursor-pointer transition ${isSelected ? 'ring-2 ring-white bg-orange-700' : ''}" onclick="client.handlePeerClick('${peer.id}')">
                <div class="text-2xl mb-2">${this.getPeerIcon(peer)}</div>
                <div class="font-medium">${this.escapeHtml(peer.name)}</div>
                <div class="text-sm">${isConnected ? '🟢 Connected' : '🔵 Available'}</div>
            </button>
        `;
    }

    async handlePeerClick(peerId) {
        this.selectedPeer = peerId;
        this.updatePeersList(Array.from(this.peers.values()));
        this.ui.messagingSection.style.display = 'block';

        await this.connectToPeer(peerId);

        // Auto-send files if they exist (conversion UI is optional)
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
        if (type === 'sent') {
            messageElement.className = 'p-3 rounded-2xl rounded-br-none bg-orange-500 text-white self-end max-w-xs mb-2';
        } else {
            messageElement.className = 'p-3 rounded-2xl rounded-bl-none bg-gray-600 text-white self-start max-w-xs mb-2';
        }
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
        this.updateConversionUI();

        // Don't auto-send if there are convertible files - let user choose to convert or send
        const hasConvertibleFiles = this.selectedFiles.some(file => {
            const fileName = file.name.toLowerCase();
            const lastDotIndex = fileName.lastIndexOf('.');
            const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1) : '';
            return ext === 'docx' || ext === 'odt' || ext === 'txt';
        });

        // Files will be sent when a peer is selected (in handlePeerClick)
        // This prevents double-sending
    }

    updateSelectedFilesUI() {
        if (this.selectedFiles.length === 0) {
            this.ui.selectedFiles.innerHTML = '';
            return;
        }

        this.ui.selectedFiles.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-lg font-medium text-gray-100">Selected Files (${this.selectedFiles.length})</h3>
                <button onclick="client.clearSelectedFiles()" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md transition text-sm">Clear All</button>
            </div>
            <div class="space-y-1">
                ${this.selectedFiles.map((file, index) => `
                    <div class="flex items-center justify-between p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition ${file.converted ? 'bg-green-900 border border-green-600' : ''}">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            <span class="text-base flex-shrink-0">${this.getFileIcon(file.name.split('.').pop())}</span>
                            <span class="file-name font-medium truncate">${this.escapeHtml(file.name)}${file.converted ? ' (converted)' : ''}</span>
                            <span class="file-size text-xs flex-shrink-0">${this.formatFileSize(file.size)}</span>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0 ml-2">
                            <button onclick="client.downloadFile(${index})" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition text-sm">Download</button>
                            <button onclick="client.removeFile(${index})" class="text-red-400 hover:text-red-300 transition">×</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateSelectedFilesUI();
    }

    clearSelectedFiles() {
        this.selectedFiles = [];
        this.updateSelectedFilesUI();
    }

    downloadFile(index) {
        const file = this.selectedFiles[index];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Conversion Methods
    updateConversionUI() {
        const hasConvertibleFiles = this.selectedFiles.some(file => {
            const fileName = file.name.toLowerCase();
            const lastDotIndex = fileName.lastIndexOf('.');
            const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1) : '';
            return ext === 'docx' || ext === 'odt' || ext === 'txt';
        });

        if (hasConvertibleFiles) {
            this.ui.conversionSection.style.display = 'block';
        } else {
            this.ui.conversionSection.style.display = 'none';
            return;
        }

        // Show message if no convertible files
        if (!hasConvertibleFiles) {
            this.ui.conversionMessage.style.display = 'block';
            this.ui.convertBtn.disabled = true;
            return;
        } else {
            this.ui.conversionMessage.style.display = 'none';
        }

        // Auto-detect source format from selected files
        const convertibleFiles = this.selectedFiles.filter(file => {
            const fileName = file.name.toLowerCase();
            const lastDotIndex = fileName.lastIndexOf('.');
            const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1) : '';
            return ext === 'docx' || ext === 'odt' || ext === 'txt';
        });

        if (convertibleFiles.length > 0) {
            const firstConvertibleFile = convertibleFiles[0];
            const fileName = firstConvertibleFile.name.toLowerCase();
            const lastDotIndex = fileName.lastIndexOf('.');
            const detectedFormat = lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1) : '';

            // Auto-select the detected format
            if (detectedFormat && ['docx', 'odt', 'txt'].includes(detectedFormat)) {
                this.ui.convertFromFormat.value = detectedFormat;
            }
        }

        const fromFormat = this.ui.convertFromFormat.value;
        const toFormat = this.ui.convertToFormat.value;

        // Supported conversions: docx↔txt↔odt, txt→pdf, docx→pdf, odt→pdf
        const validConversions = [
            'docx-to-pdf', 'docx-to-txt', 'docx-to-odt',
            'txt-to-pdf', 'txt-to-docx', 'txt-to-odt',
            'odt-to-pdf', 'odt-to-txt', 'odt-to-docx'
        ];
        const conversionKey = `${fromFormat}-to-${toFormat}`;

        this.ui.convertBtn.disabled = !fromFormat || !toFormat || !validConversions.includes(conversionKey);
    }

    async convertFile() {
        const fromFormat = this.ui.convertFromFormat.value;
        const toFormat = this.ui.convertToFormat.value;

        // Supported conversions: docx↔txt↔odt, txt→pdf, docx→pdf, odt→pdf
        const validConversions = [
            'docx-to-pdf', 'docx-to-txt', 'docx-to-odt',
            'txt-to-pdf', 'txt-to-docx', 'txt-to-odt',
            'odt-to-pdf', 'odt-to-txt', 'odt-to-docx'
        ];
        const conversionKey = `${fromFormat}-to-${toFormat}`;

        if (!validConversions.includes(conversionKey)) {
            this.showNotification('Unsupported conversion. Supported: DOCX↔TXT↔ODT, TXT→PDF, DOCX→PDF, ODT→PDF', 'warning');
            return;
        }

        // Find a file with the selected format
        const fileToConvert = this.selectedFiles.find(file => {
            const fileExt = file.name.toLowerCase().split('.').pop();
            return fileExt === fromFormat;
        });

        if (!fileToConvert) {
            this.showNotification(`No ${fromFormat.toUpperCase()} file selected`, 'warning');
            return;
        }

        this.ui.convertBtn.disabled = true;
        this.ui.convertBtn.textContent = 'Converting...';

        try {
            const formData = new FormData();
            formData.append('file', fileToConvert);
            formData.append('fromFormat', fromFormat);
            formData.append('toFormat', toFormat);

            const response = await fetch('/api/convert', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Conversion failed');
            }

            const blob = await response.blob();
            const filename = fileToConvert.name.replace(/\.[^/.]+$/, `.${toFormat}`);

            // Replace the original file with the converted file
            const convertedFile = new File([blob], filename, { type: blob.type });
            convertedFile.converted = true; // Mark as converted
            const fileIndex = this.selectedFiles.indexOf(fileToConvert);
            if (fileIndex !== -1) {
                this.selectedFiles[fileIndex] = convertedFile;
                this.updateSelectedFilesUI();
                this.updateConversionUI();
            }

            this.showNotification(`File converted to ${toFormat.toUpperCase()}!`, 'success');

        } catch (error) {
            console.error('Conversion error:', error);
            this.showNotification('Conversion failed. Please try again.', 'error');
        } finally {
            this.ui.convertBtn.disabled = false;
            this.ui.convertBtn.textContent = 'Convert';
        }
    }



    sendOriginalFiles() {
        console.log('sendOriginalFiles called');
        console.log('selectedPeer:', this.selectedPeer);
        console.log('selectedFiles:', this.selectedFiles.length);

        if (this.selectedPeer && this.selectedFiles.length > 0) {
            // Ensure we have an active connection before sending
            const dataChannel = this.dataChannels.get(this.selectedPeer);
            console.log('dataChannel state:', dataChannel ? dataChannel.readyState : 'no dataChannel');

            if (!dataChannel || dataChannel.readyState !== 'open') {
                console.log('Reconnecting to peer...');
                this.connectToPeer(this.selectedPeer).then(() => {
                    console.log('Reconnected, now sending files');
                    this.sendFiles(this.selectedPeer, this.selectedFiles);
                    this.clearSelectedFiles();
                }).catch(error => {
                    console.error('Failed to reconnect:', error);
                    this.showNotification('Connection lost. Please reconnect to the device.', 'error');
                });
            } else {
                this.sendFiles(this.selectedPeer, this.selectedFiles);
                this.clearSelectedFiles();
            }
        } else {
            this.showNotification('No peer selected or no files to send', 'warning');
        }
    }

    async sendFiles(peerId, files) {
        console.log('sendFiles called for peer:', peerId);
        const dataChannel = this.dataChannels.get(peerId);
        console.log('dataChannel exists:', !!dataChannel);
        console.log('dataChannel readyState:', dataChannel ? dataChannel.readyState : 'N/A');

        if (!dataChannel || dataChannel.readyState !== 'open') {
            console.log('Data channel not ready, attempting to reconnect...');
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

        // Remove any existing event listeners to prevent conflicts
        const acceptBtn = this.ui.acceptTransferBtn;
        const rejectBtn = this.ui.rejectTransferBtn;

        const newAcceptBtn = acceptBtn.cloneNode(true);
        const newRejectBtn = rejectBtn.cloneNode(true);

        acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
        rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);

        this.ui.acceptTransferBtn = newAcceptBtn;
        this.ui.rejectTransferBtn = newRejectBtn;

        const accept = () => {
            console.log('Accepting file transfer:', transferId);
            // Immediately close modal and disable buttons
            this.ui.incomingFileModal.style.display = 'none';
            this.ui.acceptTransferBtn.disabled = true;
            this.ui.rejectTransferBtn.disabled = true;

            this.activeTransfers.set(transferId, { fileName, fileSize, peerId, type: 'incoming', chunks: [], receivedSize: 0 });
            this.addTransferToUI(transferId, fileName, fileSize, 'incoming');
            const dataChannel = this.dataChannels.get(peerId);
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify({ type: 'file-accept', transferId }));
                console.log('Sent file-accept message');
                this.showNotification('File transfer accepted', 'info');
            } else {
                console.error('Data channel not available for accepting transfer');
                this.showNotification('Connection lost. Transfer may fail.', 'warning');
            }
        };

        const reject = () => {
            console.log('Rejecting file transfer:', transferId);
            const dataChannel = this.dataChannels.get(peerId);
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify({ type: 'file-reject', transferId }));
            }
            this.ui.incomingFileModal.style.display = 'none';
        };

        this.ui.acceptTransferBtn.addEventListener('click', accept);
        this.ui.rejectTransferBtn.addEventListener('click', reject);
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

    getFileIcon(mimeTypeOrFormat) {
        const format = mimeTypeOrFormat.toLowerCase();
        if (format.startsWith('image/')) return '🖼️';
        if (format.startsWith('video/')) return '🎥';
        if (format.startsWith('audio/')) return '🎵';
        if (format.startsWith('text/') || format === 'txt') return '📄';
        if (format.includes('pdf') || format === 'pdf') return '📕';
        if (format === 'docx') return '📝';
        if (format === 'odt' || format === 'fodf') return '📄';
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
    window.client = client;
});
