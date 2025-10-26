import { Utils } from './utils.js';

// File Management and Transfer
export class FileManager {
    constructor(onSendMessage, onNotification, uiManager) {
        this.selectedFiles = [];
        this.activeTransfers = new Map();
        this.onSendMessage = onSendMessage;
        this.onNotification = onNotification;
        this.uiManager = uiManager;
    }

    handleFileSelection(files) {
        console.log('handleFileSelection called with files:', files.map(f => f.name));
        this.selectedFiles = files.filter(file => {
            if (file.size > 100 * 1024 * 1024) { // 100MB limit
                this.onNotification(`File ${file.name} is too large (max 100MB)`, 'warning');
                return false;
            }
            return true;
        });
        console.log('Filtered selected files:', this.selectedFiles.map(f => f.name));
        return this.selectedFiles;
    }

    updateSelectedFilesUI(ui, onRemoveFile, onClearFiles) {
        if (this.selectedFiles.length === 0) {
            ui.selectedFiles.innerHTML = '';
            return;
        }

        ui.selectedFiles.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-lg font-medium text-gray-100">Selected Files (${this.selectedFiles.length})</h3>
                <button onclick="${onClearFiles}()" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md transition text-sm">Clear All</button>
            </div>
            <div class="space-y-1">
                ${this.selectedFiles.map((file, index) => `
                    <div class="flex items-center justify-between p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition ${file.converted ? 'bg-green-900 border border-green-600' : ''}">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            <span class="text-base flex-shrink-0">${Utils.getFileIcon(file.name.split('.').pop())}</span>
                            <span class="file-name font-medium truncate">${Utils.escapeHtml(file.name)}${file.converted ? ' (converted)' : ''}</span>
                            <span class="file-size text-xs flex-shrink-0">${Utils.formatFileSize(file.size)}</span>
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
    }

    clearSelectedFiles() {
        this.selectedFiles = [];
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

    hasConvertibleFiles() {
        return this.selectedFiles.some(file => Utils.isConvertibleFile(file.name));
    }

    getConvertibleFiles() {
        return this.selectedFiles.filter(file => Utils.isConvertibleFile(file.name));
    }

    replaceFile(oldFile, newFile) {
        const index = this.selectedFiles.indexOf(oldFile);
        if (index !== -1) {
            this.selectedFiles[index] = newFile;
        }
    }

    async convertFile(fromFormat, toFormat, onProgress) {
        const fileToConvert = this.selectedFiles.find(file => {
            const fileExt = Utils.getFileExtension(file.name);
            return fileExt === fromFormat;
        });

        if (!fileToConvert) {
            this.onNotification(`No ${fromFormat.toUpperCase()} file selected`, 'warning');
            return null;
        }

        onProgress('Converting...');

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

            this.replaceFile(fileToConvert, convertedFile);

            this.onNotification(`File converted to ${toFormat.toUpperCase()}!`, 'success');
            return convertedFile;

        } catch (error) {
            console.error('Conversion error:', error);
            this.onNotification('Conversion failed. Please try again.', 'error');
            return null;
        }
    }

    async sendFiles(peerId, webRTCManager) {
        console.log('sendFiles called for peer:', peerId);
        const dataChannel = webRTCManager.dataChannels.get(peerId);
        console.log('dataChannel exists:', !!dataChannel);
        console.log('dataChannel readyState:', dataChannel ? dataChannel.readyState : 'N/A');

        if (!dataChannel || dataChannel.readyState !== 'open') {
            console.log('Data channel not ready, attempting to reconnect...');
            this.onNotification('Connection not ready. Please try again.', 'warning');
            return;
        }

        for (const file of this.selectedFiles) {
            const transferId = Utils.generateTransferId();
            this.activeTransfers.set(transferId, { file, peerId, type: 'outgoing' });

            // Add transfer to UI (this would need to be passed as callback)
            webRTCManager.sendToPeer(peerId, JSON.stringify({
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

    startFileSend(transferId, webRTCManager) {
        const transfer = this.activeTransfers.get(transferId);
        if (!transfer) return;

        const { file, peerId } = transfer;
        const chunkSize = 16384; // 16KB
        let offset = 0;

        const reader = new FileReader();
        reader.onload = (e) => {
            webRTCManager.sendToPeer(peerId, e.target.result);
            offset += e.target.result.byteLength;

            // Update progress (callback needed)
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

    handleFileOffer(offer, peerId, webRTCManager) {
        const { transferId, fileName, fileSize } = offer;
        this.activeTransfers.set(transferId, {
            fileName,
            fileSize,
            peerId,
            type: 'incoming',
            chunks: [],
            receivedSize: 0
        });

        webRTCManager.sendToPeer(peerId, JSON.stringify({ type: 'file-accept', transferId }));
    }

    handleFileChunk(data) {
        const incomingTransfers = Array.from(this.activeTransfers.entries())
            .filter(([id, t]) => t.type === 'incoming');

        if (incomingTransfers.length > 0) {
            const [transferId, transfer] = incomingTransfers[incomingTransfers.length - 1];
            transfer.chunks.push(data);
            transfer.receivedSize += data.byteLength;

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
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.completeTransfer(transferId);
        console.log(`Finished receiving file ${transfer.fileName}`);
    }

    completeTransfer(transferId) {
        const transfer = this.activeTransfers.get(transferId);
        if (transfer) {
            const status = transfer.type === 'incoming' ? 'Completed' : 'Sent';
            this.uiManager.updateTransferStatus(transferId, status);
        }
        this.activeTransfers.delete(transferId);
    }

    cancelTransfer(transferId, webRTCManager) {
        const transfer = this.activeTransfers.get(transferId);
        if (!transfer) return;

        // TODO: Send cancellation message to the other peer
        this.activeTransfers.delete(transferId);
    }
}