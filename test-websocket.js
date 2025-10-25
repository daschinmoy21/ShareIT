// Test WebSocket connection and peer discovery
import WebSocket from 'ws';

console.log('Testing WebSocket connection...');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
    console.log('✅ WebSocket connected');
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received message:', message);

    if (message.type === 'peer-id') {
        console.log('Got peer ID:', message.id);
    }

    if (message.type === 'peers-updated') {
        console.log('Peers updated:', message.peers);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
    console.log('WebSocket closed');
});

// Keep the script running for a bit
setTimeout(() => {
    ws.close();
    console.log('Test completed');
}, 10000);