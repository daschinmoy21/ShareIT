import { WebSocketManager } from './websocket.js';
import { WebRTCManager } from './webrtc.js';
import { FileManager } from './file-manager.js';
import { UIManager } from './ui-manager.js';
import { Utils } from './utils.js';

// Main Application Coordinator
export class ShareItClient {
    constructor() {
        this.peerId = null;
        this.deviceName = '';
        this.peers = new Map();
        this.selectedPeer = null;

        // Initialize managers
        this.uiManager = new UIManager();
        this.fileManager = new FileManager(
            (message) => this.wsManager.sendMessage(message),
            (message, type) => this.uiManager.showNotification(message, type),
            this.uiManager
        );

        this.wsManager = new WebSocketManager(
            (message) => this.handleSignalingMessage(message),
            () => this.handleWsOpen(),
            (event) => this.handleWsClose(event),
            (error) => this.handleWsError(error)
        );

        this.webrtcManager = new WebRTCManager(
            (message) => this.wsManager.sendMessage(message),
            (peerId, state) => this.handleConnectionStateChange(peerId, state),
            (event, peerId) => this.handleDataChannelMessage(event, peerId),
            (peerId, offer) => this.handleOfferReceived(peerId, offer)
        );

        this.setupEventListeners();
        this.connect();
    }

    setupEventListeners() {
        // Device name
        this.uiManager.handleDeviceNameInput((name) => {
            this.deviceName = name;
        });
        this.uiManager.ui.deviceNameInput.addEventListener('blur', () => this.setDeviceName());

        // File handling
        this.uiManager.ui.selectFilesBtn.addEventListener('click', () => this.uiManager.triggerFileInput());
        this.uiManager.ui.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));

        // Messaging
        this.uiManager.ui.sendMessageBtn.addEventListener('click', () => this.sendMessageToPeer());

        // Conversion
        this.uiManager.ui.convertFromFormat.addEventListener('change', () => this.updateConversionUI());
        this.uiManager.ui.convertToFormat.addEventListener('change', () => this.updateConversionUI());
        this.uiManager.ui.convertBtn.addEventListener('click', () => this.convertFile());
        this.uiManager.ui.sendOriginalBtn.addEventListener('click', () => this.sendOriginalFiles());

        // Drag and drop
        this.uiManager.ui.dropZone.addEventListener('dragover', (e) => this.uiManager.handleDragOver(e));
        this.uiManager.ui.dropZone.addEventListener('dragleave', (e) => this.uiManager.handleDragLeave(e));
        this.uiManager.ui.dropZone.addEventListener('drop', (e) => this.handleDrop(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    connect() {
        this.wsManager.connect();
    }

    // WebSocket handlers
    handleWsOpen() {
        this.uiManager.hideConnectionError();
        this.setDeviceName();
    }

    handleWsClose(event) {
        // Handled by WebSocketManager
    }

    handleWsError(error) {
        this.uiManager.showConnectionError('Connection error. Please refresh the page.');
    }

    // Signaling
    handleSignalingMessage(message) {
        switch (message.type) {
            case 'peer-id':
                this.peerId = message.id;
                this.ip = message.ip;
                this.uiManager.updateDeviceId(this.peerId, this.ip);
                break;
            case 'peers-updated':
                this.updatePeersList(message.peers);
                break;
            case 'offer':
                this.webrtcManager.handleOffer(message);
                break;
            case 'answer':
                this.webrtcManager.handleAnswer(message);
                break;
            case 'ice-candidate':
                this.webrtcManager.handleIceCandidate(message);
                break;
            case 'reject':
                this.webrtcManager.handleReject(message);
                break;
            case 'error':
                this.uiManager.showNotification(`Error: ${message.message}`, 'error');
                break;
        }
    }

    // Peer management
    updatePeersList(peers) {
        console.log('updatePeersList called with peers:', peers);
        const otherPeers = peers.filter(peer => peer.id !== this.peerId);
        console.log('Filtered otherPeers:', otherPeers);
        this.peers.clear();
        otherPeers.forEach(peer => this.peers.set(peer.id, peer));

        if (otherPeers.length === 0) {
            console.log('No other peers found, hiding messaging section');
            this.uiManager.hideMessagingSection();
            this.selectedPeer = null;
            return;
        }

        console.log('Updating peers list UI with', otherPeers.length, 'peers');
        this.uiManager.updatePeersList(otherPeers, this.selectedPeer, (peerId) => this.handlePeerClick(peerId));

        if (this.selectedPeer && !this.peers.has(this.selectedPeer)) {
            this.selectedPeer = null;
            this.uiManager.hideMessagingSection();
        }
    }

    async handlePeerClick(peerId) {
        console.log('handlePeerClick called with peerId:', peerId);
        this.selectedPeer = peerId;
        console.log('Setting selectedPeer to:', this.selectedPeer);
        this.uiManager.updatePeersList(Array.from(this.peers.values()), this.selectedPeer, (peerId) => this.handlePeerClick(peerId));
        this.uiManager.showMessagingSection();
        console.log('Messaging section shown');

        // Always attempt to connect first
        console.log('Attempting to connect to peer:', peerId);
        await this.webrtcManager.connectToPeer(peerId);
        console.log('WebRTC connection attempt completed');

        if (this.fileManager.selectedFiles.length > 0) {
            console.log('Sending files to peer:', peerId);
            await this.sendFiles(peerId);
        } else {
            this.uiManager.showNotification(`Connection request sent to ${this.peers.get(peerId)?.name || 'Unknown Device'}. Waiting for response.`, 'info');
        }
    }

    handleOfferReceived(peerId, offer) {
        const peerName = this.peers.get(peerId)?.name || 'Unknown Device';
        this.uiManager.showConnectionRequestModal(`${peerName} (${peerId.slice(0, 6)})`, peerId, () => {
            this.webrtcManager.acceptOffer(peerId);
        }, () => {
            this.webrtcManager.rejectOffer(peerId);
        });
    }

    // WebRTC handlers
    handleConnectionStateChange(peerId, state) {
        switch (state) {
            case 'connected':
                this.uiManager.showNotification(`Connected to ${this.peers.get(peerId)?.name}`, 'success');
                this.uiManager.updatePeersList(Array.from(this.peers.values()), this.selectedPeer, (peerId) => this.handlePeerClick(peerId));
                break;
            case 'disconnected':
            case 'failed':
                this.webrtcManager.disconnectPeer(peerId);
                this.uiManager.updatePeersList(Array.from(this.peers.values()), this.selectedPeer, (peerId) => this.handlePeerClick(peerId));
                this.uiManager.showNotification(`Disconnected from ${this.peers.get(peerId)?.name}`, 'warning');
                if (this.selectedPeer === peerId) {
                    this.selectedPeer = null;
                    this.uiManager.hideMessagingSection();
                }
                break;
            case 'rejected':
                this.uiManager.showNotification(`${this.peers.get(peerId)?.name || 'Unknown Device'} rejected the connection request`, 'warning');
                break;
        }
    }

    handleDataChannelMessage(event, peerId) {
        if (typeof event.data === 'string') {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'text':
                    this.uiManager.addMessage(message.content, 'received');
                    break;
                case 'file-offer':
                    this.handleFileOffer(message, peerId);
                    break;
                case 'file-accept':
                    this.fileManager.startFileSend(message.transferId, this.webrtcManager);
                    break;
                case 'file-reject':
                    this.fileManager.completeTransfer(message.transferId);
                    break;
            }
        } else {
            this.fileManager.handleFileChunk(event.data);
        }
    }

    // Messaging
    sendMessageToPeer() {
        const message = this.uiManager.getMessageInput();
        if (!message || !this.selectedPeer) return;

        if (this.webrtcManager.sendToPeer(this.selectedPeer, JSON.stringify({ type: 'text', content: message }))) {
            this.uiManager.addMessage(message, 'sent');
            this.uiManager.clearMessageInput();
        } else {
            this.uiManager.showNotification('Not connected to peer. Please select a peer.', 'warning');
        }
    }

    // File handling
    handleFileSelection(e) {
        const files = this.uiManager.getSelectedFiles();
        this.fileManager.handleFileSelection(files);
        this.updateSelectedFilesUI();
        this.updateConversionUI();
    }

    handleDrop(e) {
        const files = this.uiManager.handleDrop(e);
        if (files.length > 0) {
            this.fileManager.handleFileSelection(files);
            this.updateSelectedFilesUI();
            this.updateConversionUI();
        }
    }

    updateSelectedFilesUI() {
        this.fileManager.updateSelectedFilesUI(
            this.uiManager.ui,
            (index) => this.removeFile(index),
            () => this.clearSelectedFiles()
        );
    }

    removeFile(index) {
        this.fileManager.removeFile(index);
        this.updateSelectedFilesUI();
        this.updateConversionUI();
    }

    clearSelectedFiles() {
        this.fileManager.clearSelectedFiles();
        this.updateSelectedFilesUI();
        this.updateConversionUI();
    }

    downloadFile(index) {
        this.fileManager.downloadFile(index);
    }

    // Conversion
    updateConversionUI() {
        this.uiManager.updateConversionUI(
            this.fileManager.hasConvertibleFiles(),
            this.fileManager.selectedFiles
        );
    }

    async convertFile() {
        const fromFormat = this.uiManager.ui.convertFromFormat.value;
        const toFormat = this.uiManager.ui.convertToFormat.value;

        const convertedFile = await this.fileManager.convertFile(fromFormat, toFormat, (status) => {
            this.uiManager.setConvertButtonState(status === 'Converting...', status === 'Converting...');
        });

        if (convertedFile) {
            this.updateSelectedFilesUI();
            this.updateConversionUI();
        }
    }

    async sendOriginalFiles() {
        console.log('sendOriginalFiles called');
        console.log('selectedPeer:', this.selectedPeer);
        console.log('selectedFiles:', this.fileManager.selectedFiles.length);

        if (this.selectedPeer && this.fileManager.selectedFiles.length > 0) {
            // Ensure we have an active connection before sending
            if (!this.webrtcManager.isConnected(this.selectedPeer)) {
                console.log('Reconnecting to peer...');
                try {
                    await this.webrtcManager.connectToPeer(this.selectedPeer);
                    console.log('Reconnected, now sending files');
                } catch (error) {
                    console.error('Failed to reconnect:', error);
                    this.uiManager.showNotification('Connection lost. Please reconnect to the device.', 'error');
                    return;
                }
            }

            await this.fileManager.sendFiles(this.selectedPeer, this.webrtcManager);
            this.clearSelectedFiles();
        } else {
            this.uiManager.showNotification('No peer selected or no files to send', 'warning');
        }
    }

    async sendFiles(peerId) {
        await this.fileManager.sendFiles(peerId, this.webrtcManager);
        this.clearSelectedFiles();
    }

    // File transfer
    handleFileOffer(offer, peerId) {
        const { transferId, fileName, fileSize } = offer;
        this.fileManager.handleFileOffer(offer, peerId, this.webrtcManager);

        // Show modal
        this.uiManager.showIncomingFileModal(
            this.peers.get(peerId)?.name,
            fileSize,
            fileName,
            () => {
                this.uiManager.addTransferToUI(transferId, fileName, fileSize, 'incoming');
            },
            () => {
                this.webrtcManager.sendToPeer(peerId, JSON.stringify({ type: 'file-reject', transferId }));
            }
        );
    }

    // Device name
    setDeviceName() {
        if (this.deviceName.trim()) {
            this.wsManager.sendMessage({ type: 'set-name', name: this.deviceName.trim() });
        }
    }

    // Keyboard shortcuts
    handleKeyDown(e) {
        if (e.key === 'Enter' && this.uiManager.ui.messageInput === document.activeElement) {
            this.sendMessageToPeer();
        }
    }
}