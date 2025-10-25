// Utility Functions
export class Utils {
    static generateDeviceName() {
        const adjectives = ['Quick', 'Smart', 'Fast', 'Cool', 'Swift', 'Bright'];
        const nouns = ['Phone', 'Laptop', 'Desktop', 'Tablet', 'Device', 'Computer'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return `${adj} ${noun}`;
    }

    static getPeerIcon(peer) {
        const name = peer.name.toLowerCase();
        if (name.includes('phone') || name.includes('mobile')) return '📱';
        if (name.includes('laptop')) return '💻';
        if (name.includes('desktop')) return '🖥️';
        return '📱';
    }

    static getFileIcon(mimeTypeOrFormat) {
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

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static generateTransferId() {
        return Math.random().toString(36).substr(2, 9);
    }

    static isConvertibleFile(filename) {
        const fileName = filename.toLowerCase();
        const lastDotIndex = fileName.lastIndexOf('.');
        const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1) : '';
        return ext === 'docx' || ext === 'odt' || ext === 'txt';
    }

    static getFileExtension(filename) {
        const fileName = filename.toLowerCase();
        const lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1) : '';
    }
}