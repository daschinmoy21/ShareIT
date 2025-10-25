// Simple test to check if modules can be imported
import('./public/modules/app.js').then(module => {
    console.log('✅ App module imported successfully');
    console.log('ShareItClient:', typeof module.ShareItClient);
}).catch(error => {
    console.error('❌ Failed to import app module:', error);
});

import('./public/modules/ui-manager.js').then(module => {
    console.log('✅ UI Manager module imported successfully');
    console.log('UIManager:', typeof module.UIManager);
}).catch(error => {
    console.error('❌ Failed to import ui-manager module:', error);
});

import('./public/modules/webrtc.js').then(module => {
    console.log('✅ WebRTC module imported successfully');
    console.log('WebRTCManager:', typeof module.WebRTCManager);
}).catch(error => {
    console.error('❌ Failed to import webrtc module:', error);
});

import('./public/modules/websocket.js').then(module => {
    console.log('✅ WebSocket module imported successfully');
    console.log('WebSocketManager:', typeof module.WebSocketManager);
}).catch(error => {
    console.error('❌ Failed to import websocket module:', error);
});

import('./public/modules/file-manager.js').then(module => {
    console.log('✅ File Manager module imported successfully');
    console.log('FileManager:', typeof module.FileManager);
}).catch(error => {
    console.error('❌ Failed to import file-manager module:', error);
});

import('./public/modules/utils.js').then(module => {
    console.log('✅ Utils module imported successfully');
    console.log('Utils:', typeof module.Utils);
}).catch(error => {
    console.error('❌ Failed to import utils module:', error);
});