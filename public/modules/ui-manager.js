import { Utils } from './utils.js';

// UI Management
export class UIManager {
    constructor() {
        this.ui = {};
        this.initializeUI();
        this.addEventListeners();
    }

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
            connectionRequestModal: document.getElementById('connection-request-modal'),
            connectionRequestInfo: document.getElementById('connection-request-info'),
            acceptConnectionBtn: document.getElementById('accept-connection'),
            rejectConnectionBtn: document.getElementById('reject-connection'),
            transferItemTemplate: document.getElementById('transfer-item-template'),
            conversionSection: document.getElementById('conversion-section'),
            conversionMessage: document.getElementById('conversion-message'),
            convertFromFormat: document.getElementById('convert-from-format'),
            convertToFormat: document.getElementById('convert-to-format'),
            convertBtn: document.getElementById('convert-btn'),
            sendOriginalBtn: document.getElementById('send-original-btn'),
        };

        this.ui.deviceNameInput.value = Utils.generateDeviceName();
    }

    addEventListeners() {
        // Event listeners will be set up by the main app
    }

    // Device management
    handleDeviceNameInput(callback) {
        this.ui.deviceNameInput.addEventListener('input', (e) => {
            callback(e.target.value.slice(0, 50));
        });
    }

    updateDeviceId(peerId, ip) {
        this.ui.deviceId.textContent = `ID: ${peerId} | IP: ${ip}`;
    }

    setDeviceName(name) {
        this.ui.deviceNameInput.value = name;
    }

    updateDeviceId(id) {
        this.ui.deviceId.textContent = `ID: ${id.slice(0, 8)}`;
    }

    // Peer management
    updatePeersList(peers, selectedPeer, onPeerClick) {
        const otherPeers = peers.filter(peer => peer.id !== selectedPeer);
        this.peers = new Map(otherPeers.map(peer => [peer.id, peer]));

        if (otherPeers.length === 0) {
            this.ui.peersList.innerHTML = '<div class="no-peers text-white">Searching for devices on your network...</div>';
            this.ui.messagingSection.style.display = 'none';
            return;
        }

        this.ui.peersList.innerHTML = otherPeers.map(peer => this.createPeerCard(peer, selectedPeer)).join('');

        // Attach click handlers to peer cards
        const peerCards = this.ui.peersList.querySelectorAll('.peer-card');
        console.log(`Attaching click handlers to ${peerCards.length} peer cards`);
        peerCards.forEach((card) => {
            const peerId = card.getAttribute('data-peer-id');
            console.log(`Attaching click handler to peer card with ID: ${peerId}`);
            card.addEventListener('click', (event) => {
                console.log(`Peer card clicked: ${peerId}`, event);
                event.preventDefault();
                event.stopPropagation();
                onPeerClick(peerId);
            });
        });
    }

    createPeerCard(peer, selectedPeer) {
        const isSelected = selectedPeer === peer.id;
        console.log(`Creating peer card for peer:`, peer, `selected: ${isSelected}`);
        return `
            <button class="peer-card w-full text-left bg-orange-600 hover:bg-orange-700 border border-orange-500 rounded-lg p-4 cursor-pointer transition ${isSelected ? 'ring-2 ring-white bg-orange-700' : ''}" data-peer-id="${peer.id}">
                <div class="text-2xl mb-2 pointer-events-none">${Utils.getPeerIcon(peer)}</div>
                <div class="font-medium pointer-events-none">${Utils.escapeHtml(peer.name)}</div>
                <div class="text-sm pointer-events-none">🔵 Available</div>
            </button>
        `;
    }

    // Messaging
    showMessagingSection() {
        this.ui.messagingSection.style.display = 'block';
    }

    hideMessagingSection() {
        this.ui.messagingSection.style.display = 'none';
    }

    addMessage(message, type) {
        const messageElement = document.createElement('div');
        if (type === 'sent') {
            messageElement.className = 'p-3 rounded-2xl rounded-br-none bg-orange-500 text-white self-end';
        } else {
            messageElement.className = 'p-3 rounded-2xl rounded-bl-none bg-gray-300 text-black self-start';
        }
        messageElement.textContent = message;
        this.ui.messagesList.appendChild(messageElement);
        this.ui.messagesList.scrollTop = this.ui.messagesList.scrollHeight;
    }

    getMessageInput() {
        return this.ui.messageInput.value.trim();
    }

    clearMessageInput() {
        this.ui.messageInput.value = '';
    }

    // File handling
    triggerFileInput() {
        this.ui.fileInput.click();
    }

    getSelectedFiles() {
        return Array.from(this.ui.fileInput.files);
    }

    clearFileInput() {
        this.ui.fileInput.value = '';
    }

    // Drag and drop
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
        return Array.from(e.dataTransfer.files);
    }

    // Conversion UI
    updateConversionUI(hasConvertibleFiles, selectedFiles, onConvert) {
        if (hasConvertibleFiles) {
            this.ui.conversionSection.style.display = 'block';
            this.ui.conversionMessage.style.display = 'none';
        } else {
            this.ui.conversionSection.style.display = 'none';
            return;
        }

        // Auto-detect source format
        const convertibleFiles = selectedFiles.filter(file => Utils.isConvertibleFile(file.name));
        if (convertibleFiles.length > 0) {
            const firstConvertibleFile = convertibleFiles[0];
            const detectedFormat = Utils.getFileExtension(firstConvertibleFile.name);
            if (['docx', 'odt', 'txt'].includes(detectedFormat)) {
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

    setConvertButtonState(disabled, text = 'Convert') {
        this.ui.convertBtn.disabled = disabled;
        this.ui.convertBtn.textContent = text;
    }

    // Transfer UI
    addTransferToUI(transferId, fileName, fileSize, direction) {
        this.ui.transfersSection.style.display = 'block';
        const template = this.ui.transferItemTemplate.content.cloneNode(true);
        const item = template.querySelector('.transfer-item');
        item.id = `transfer-${transferId}`;

        item.querySelector('.file-icon').textContent = Utils.getFileIcon('');
        item.querySelector('.file-name').textContent = fileName;
        item.querySelector('.file-size').textContent = Utils.formatFileSize(fileSize);
        item.querySelector('.transfer-status').textContent = direction === 'incoming' ? '📥 Incoming' : '📤 Outgoing';

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

    // Notifications
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

    // Modal
    showIncomingFileModal(peerName, fileSize, fileName, onAccept, onReject) {
        this.ui.incomingFileInfo.textContent = `From: ${peerName} (${Utils.formatFileSize(fileSize)}) - ${fileName}`;
        this.ui.incomingFileModal.style.display = 'flex';

        const accept = () => {
            onAccept();
            this.ui.incomingFileModal.style.display = 'none';
        };

        const reject = () => {
            onReject();
            this.ui.incomingFileModal.style.display = 'none';
        };

        this.ui.acceptTransferBtn.addEventListener('click', accept, { once: true });
        this.ui.rejectTransferBtn.addEventListener('click', reject, { once: true });
    }

    showConnectionRequestModal(peerName, peerId, onAccept, onReject) {
        this.ui.connectionRequestInfo.textContent = `${peerName} wants to connect with you.`;
        this.ui.connectionRequestModal.style.display = 'flex';

        const accept = () => {
            onAccept();
            this.ui.connectionRequestModal.style.display = 'none';
        };

        const reject = () => {
            onReject();
            this.ui.connectionRequestModal.style.display = 'none';
        };

        this.ui.acceptConnectionBtn.addEventListener('click', accept, { once: true });
        this.ui.rejectConnectionBtn.addEventListener('click', reject, { once: true });
    }
}