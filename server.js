import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import mammoth from 'mammoth';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { TextDocument, Paragraph as ODTParagraph } from 'simple-odf';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PEER_TIMEOUT = 30000; // 30 seconds
const CLEANUP_INTERVAL = 10000; // 10 seconds

// --- File Upload Configuration ---
const upload = multer({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    dest: 'uploads/'
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// --- Data Structures ---
const peers = new Map();

class Peer {
    constructor(ws, id, ip) {
        this.ws = ws;
        this.id = id;
        this.name = `Device-${id.slice(0, 6)}`;
        this.ip = ip;
        this.lastSeen = Date.now();
    }

    updateActivity() {
        this.lastSeen = Date.now();
    }

    isActive() {
        return (Date.now() - this.lastSeen) < PEER_TIMEOUT;
    }
}

// --- Document Conversion Functions ---
async function convertDocxToPdf(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.fontSize(12);
        doc.text(text, 50, 50);
        doc.end();
    });
}

async function convertDocxToTxt(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}



async function convertTxtToPdf(text) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.fontSize(12);
        doc.text(text, 50, 50);
        doc.end();
    });
}

async function convertTxtToDocx(text) {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [new TextRun(text)],
                }),
            ],
        }],
    });

    return Packer.toBuffer(doc);
}

async function convertOdtToTxt(buffer) {
    const document = new TextDocument();
    document.loadFromBuffer(buffer);
    return document.getBody().getParagraphs().map(p => p.getText()).join('\n');
}

async function convertOdtToPdf(buffer) {
    const document = new TextDocument();
    document.loadFromBuffer(buffer);
    const text = document.getBody().getParagraphs().map(p => p.getText()).join('\n');

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.fontSize(12);
        doc.text(text, 50, 50);
        doc.end();
    });
}

async function convertOdtToDocx(buffer) {
    const document = new TextDocument();
    document.loadFromBuffer(buffer);
    const text = document.getBody().getParagraphs().map(p => p.getText()).join('\n');

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [new TextRun(text)],
                }),
            ],
        }],
    });

    return Packer.toBuffer(doc);
}

async function convertTxtToOdt(text) {
    const document = new TextDocument();
    const paragraph = new ODTParagraph();
    paragraph.addText(text);
    document.getBody().addParagraph(paragraph);

    // Return the Flat ODF XML as buffer
    return Buffer.from(document.toString());
}

async function convertDocxToOdt(docxBuffer) {
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    const text = result.value;

    const document = new TextDocument();
    const paragraph = new ODTParagraph();
    paragraph.addText(text);
    document.getBody().addParagraph(paragraph);

    // Return the Flat ODF XML as buffer
    return Buffer.from(document.toString());
}

async function convertPdfToOdt(pdfBuffer) {
    // Since we can't read PDF, we'll create an empty ODT for now
    // In a real implementation, you'd need PDF parsing
    const document = new TextDocument();
    const paragraph = new ODTParagraph();
    paragraph.addText('PDF content extraction not implemented');
    document.getBody().addParagraph(paragraph);

    // Return the Flat ODF XML as buffer
    return Buffer.from(document.toString());
}



// --- WebServer ---
app.use(express.static(join(__dirname, 'public')));

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        peers: peers.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    });
});

app.get('/api/stats', (req, res) => {
    const activePeers = Array.from(peers.values()).filter(p => p.isActive());
    res.json({
        totalPeers: peers.size,
        activePeers: activePeers.length,
        peers: activePeers.map(p => ({ id: p.id, name: p.name, ip: p.ip, lastSeen: p.lastSeen })),
    });
});

// --- Document Conversion API ---
app.post('/api/convert', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { fromFormat, toFormat } = req.body;
        const fileBuffer = fs.readFileSync(req.file.path);

        let convertedBuffer;
        const conversionKey = `${fromFormat}-to-${toFormat}`;

        switch (conversionKey) {
            case 'docx-to-pdf':
                convertedBuffer = await convertDocxToPdf(fileBuffer);
                break;
            case 'docx-to-txt':
                convertedBuffer = Buffer.from(await convertDocxToTxt(fileBuffer));
                break;
            case 'docx-to-odt':
                convertedBuffer = await convertDocxToOdt(fileBuffer);
                break;
            case 'txt-to-pdf':
                const text = fileBuffer.toString('utf8');
                convertedBuffer = await convertTxtToPdf(text);
                break;
            case 'txt-to-docx':
                const txtContent = fileBuffer.toString('utf8');
                convertedBuffer = await convertTxtToDocx(txtContent);
                break;
            case 'txt-to-odt':
                const txtContent2 = fileBuffer.toString('utf8');
                convertedBuffer = await convertTxtToOdt(txtContent2);
                break;
            case 'odt-to-pdf':
                convertedBuffer = await convertOdtToPdf(fileBuffer);
                break;
            case 'odt-to-txt':
                convertedBuffer = Buffer.from(await convertOdtToTxt(fileBuffer));
                break;
            case 'odt-to-docx':
                convertedBuffer = await convertOdtToDocx(fileBuffer);
                break;
            default:
                return res.status(400).json({ error: 'Unsupported conversion. Supported: DOCX↔TXT↔ODT, TXT→PDF, DOCX→PDF, ODT→PDF' });
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        // Set appropriate content type and filename
        let contentType, filename;
        switch (toFormat) {
            case 'pdf':
                contentType = 'application/pdf';
                filename = req.file.originalname.replace(/\.[^/.]+$/, '.pdf');
                break;
            case 'docx':
                contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                filename = req.file.originalname.replace(/\.[^/.]+$/, '.docx');
                break;
            case 'txt':
                contentType = 'text/plain';
                filename = req.file.originalname.replace(/\.[^/.]+$/, '.txt');
                break;
            case 'odt':
                contentType = 'application/vnd.oasis.opendocument.flat.text';
                filename = req.file.originalname.replace(/\.[^/.]+$/, '.fodf');
                break;
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(convertedBuffer);

    } catch (error) {
        console.error('Conversion error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Conversion failed' });
    }
});

// --- WebSocket Server ---
wss.on('connection', (ws, req) => {
    const peerId = generatePeerId();
    const clientIP = getClientIP(req);
    const peer = new Peer(ws, peerId, clientIP);
    peers.set(peerId, peer);

    console.log(`[Connection] Peer connected: ${peerId} from ${clientIP}`);

    ws.send(JSON.stringify({
        type: 'peer-id',
        id: peerId,
        name: peer.name,
        ip: peer.ip,
        // TODO: Add TURN server configuration here
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }));

    broadcastPeerList();

    ws.on('message', (data) => handleMessage(peer, data));
    ws.on('close', () => handleDisconnect(peerId));
    ws.on('error', (error) => handleError(peerId, error));
    ws.on('pong', () => peer.updateActivity());
});

function handleMessage(sender, data) {
    try {
        const message = JSON.parse(data.toString());
        sender.updateActivity();

        switch (message.type) {
            case 'set-name':
                if (message.name && message.name.length <= 50) {
                    sender.name = message.name.trim();
                    broadcastPeerList();
                    console.log(`[Info] ${sender.id} renamed to: ${sender.name}`);
                }
                break;
            case 'offer':
            case 'answer':
            case 'ice-candidate':
            case 'cancel-transfer':
            case 'text': // Added for text messaging
                forwardSignalingMessage(sender.id, message);
                break;
            case 'heartbeat':
                // Activity already updated
                break;
            default:
                console.warn(`[Warning] Unknown message type: ${message.type} from ${sender.id}`);
        }
    } catch (error) {
        console.error(`[Error] Invalid message from ${sender.id}:`, error);
    }
}

function handleDisconnect(peerId) {
    console.log(`[Connection] Peer disconnected: ${peerId}`);
    peers.delete(peerId);
    broadcastPeerList();
}

function handleError(peerId, error) {
    console.error(`[Error] WebSocket error for ${peerId}:`, error);
    peers.delete(peerId);
    broadcastPeerList();
}

// --- Signaling Logic ---
function forwardSignalingMessage(senderId, message) {
    const targetPeer = peers.get(message.target);

    if (!targetPeer || !targetPeer.isActive()) {
        const sender = peers.get(senderId);
        if (sender && sender.ws.readyState === sender.ws.OPEN) {
            sender.ws.send(JSON.stringify({ type: 'error', message: 'Target peer not available' }));
        }
        console.warn(`[Warning] Target peer not available: ${message.target}`);
        return;
    }

    if (targetPeer.ws.readyState === targetPeer.ws.OPEN) {
        const forwardedMessage = { ...message, from: senderId };
        targetPeer.ws.send(JSON.stringify(forwardedMessage));
        console.log(`[Signaling] Forwarded ${message.type} from ${senderId} to ${message.target}`);
    }
}

// --- Peer Management ---
function broadcastPeerList() {
    const activePeers = Array.from(peers.values())
        .filter(peer => peer.isActive())
        .map(peer => ({ id: peer.id, name: peer.name, ip: peer.ip.replace(/^::ffff:/, '') }));

    const message = JSON.stringify({ type: 'peers-updated', peers: activePeers });

    peers.forEach(peer => {
        if (peer.ws.readyState === peer.ws.OPEN) {
            peer.ws.send(message);
        }
    });
}

function cleanupInactivePeers() {
    const inactivePeers = [];
    for (const [id, peer] of peers.entries()) {
        if (!peer.isActive()) {
            inactivePeers.push(id);
        }
    }

    if (inactivePeers.length > 0) {
        inactivePeers.forEach(id => peers.delete(id));
        console.log(`[Cleanup] Removed ${inactivePeers.length} inactive peers.`);
        broadcastPeerList();
    }
}

// --- Utility ---
function generatePeerId() {
    return Math.random().toString(36).substr(2, 9);
}

function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

// --- Server Start & Shutdown ---
server.listen(PORT, HOST, () => {
    console.log(`🚀 ShareIt server running on http://${HOST}:${PORT}`);
    setInterval(cleanupInactivePeers, CLEANUP_INTERVAL);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down ShareIt server...');
    wss.clients.forEach(ws => ws.close());
    server.close(() => {
        console.log('✅ Server shut down gracefully');
        process.exit(0);
    });
});
