// WebRTC Peer Connection Management
export class WebRTCManager {
    constructor(onSignalingMessage, onConnectionStateChange, onDataChannelMessage, onOfferReceived) {
        this.connections = new Map();
        this.dataChannels = new Map();
        this.pendingConnections = new Map();
        this.onSignalingMessage = onSignalingMessage;
        this.onConnectionStateChange = onConnectionStateChange;
        this.onDataChannelMessage = onDataChannelMessage;
        this.onOfferReceived = onOfferReceived;
    }

    async connectToPeer(peerId) {
        if (this.connections.has(peerId)) {
            const dataChannel = this.dataChannels.get(peerId);
            if (dataChannel && dataChannel.readyState === 'open') {
                return this.connections.get(peerId);
            }
            // If connection exists but dataChannel not open, perhaps reconnect
        }

        const connection = this.createPeerConnection(peerId);
        const dataChannel = connection.createDataChannel('main');
        this.setupDataChannel(dataChannel, peerId);
        this.dataChannels.set(peerId, dataChannel);

        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        this.onSignalingMessage({ type: 'offer', target: peerId, offer });

        this.connections.set(peerId, connection);
        return connection;
    }

    createPeerConnection(peerId) {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
        const connection = new RTCPeerConnection(configuration);

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.onSignalingMessage({ type: 'ice-candidate', target: peerId, candidate: event.candidate });
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
        this.onConnectionStateChange(peerId, state);
    }

    setupDataChannel(dataChannel, peerId) {
        dataChannel.onopen = () => console.log(`Data channel with ${peerId} is open`);
        dataChannel.onmessage = (event) => this.onDataChannelMessage(event, peerId);
        dataChannel.onerror = (error) => console.error('Data channel error:', error);
        dataChannel.onclose = () => console.log(`Data channel with ${peerId} is closed`);
    }

    async handleOffer(message) {
        const connection = this.createPeerConnection(message.from);
        await connection.setRemoteDescription(message.offer);
        // Store the connection for later acceptance
        this.pendingConnections.set(message.from, connection);
        // Notify UI to show popup
        this.onOfferReceived(message.from, message);
    }

    async acceptOffer(peerId) {
        const connection = this.pendingConnections.get(peerId);
        if (!connection) return;

        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        this.onSignalingMessage({ type: 'answer', target: peerId, answer });
        this.connections.set(peerId, connection);
        this.pendingConnections.delete(peerId);
    }

    rejectOffer(peerId) {
        const connection = this.pendingConnections.get(peerId);
        if (connection) {
            connection.close();
            this.pendingConnections.delete(peerId);
        }
        // Send reject message
        this.onSignalingMessage({ type: 'reject', target: peerId });
    }

    async handleAnswer(message) {
        const connection = this.connections.get(message.from);
        if (connection) {
            await connection.setRemoteDescription(message.answer);
        }
    }

    handleReject(message) {
        const connection = this.pendingConnections.get(message.from);
        if (connection) {
            connection.close();
            this.pendingConnections.delete(message.from);
        }
        this.handleConnectionStateChange(message.from, 'rejected');
    }

    async handleIceCandidate(message) {
        const connection = this.connections.get(message.from);
        if (connection) {
            await connection.addIceCandidate(message.candidate);
        }
    }

    sendToPeer(peerId, data) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(data);
            return true;
        }
        return false;
    }

    disconnectPeer(peerId) {
        const connection = this.connections.get(peerId);
        if (connection) {
            connection.close();
        }
        this.connections.delete(peerId);
        this.dataChannels.delete(peerId);
    }

    isConnected(peerId) {
        const dataChannel = this.dataChannels.get(peerId);
        return dataChannel && dataChannel.readyState === 'open';
    }
}