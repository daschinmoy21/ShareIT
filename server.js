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
import AdmZip from 'adm-zip';
import xml2js from 'xml2js';
import fs from 'fs';
import os from 'os';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// // app.use(helmet({
//     contentSecurityPolicy: {
//         directives: {
//             defaultSrc: ["'self'"],
//             scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
//             styleSrc: ["'self'", "'unsafe-inline'"],
//             imgSrc: ["'self'", "data:"],
//             connectSrc: ["'self'", "ws:", "https:"],
//         },
//     },
//     crossOriginOpenerPolicy: false,
//     crossOriginEmbedderPolicy: false,
// }));
app.use(cors());
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);
const server = createServer(app);
const wss = new WebSocketServer({ server });

// --- Configuration ---
const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || '0.0.0.0';
const PEER_TIMEOUT = 30000; // 30 seconds
const CLEANUP_INTERVAL = 10000; // 10 seconds

// --- File Upload Configuration ---
const upload = multer({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/vnd.oasis.opendocument.text',
            'application/vnd.oasis.opendocument.flat.text'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
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
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.fontSize(12);
        doc.text(text, {
            width: 500,
            align: 'left',
            lineGap: 5
        });
        doc.end();
    });
}

async function convertDocxToTxt(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}



async function convertTxtToPdf(text) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.fontSize(12);
        doc.text(text, {
            width: 500,
            align: 'left',
            lineGap: 5
        });
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
    try {
        const xmlContent = buffer.toString('utf8');
        const parser = new xml2js.Parser();
        let result;

        if (buffer[0] === 0x50 && buffer[1] === 0x4B) { // ZIP file (standard ODT)
            const zip = new AdmZip(buffer);
            const contentXml = zip.readAsText('content.xml');
            if (!contentXml) throw new Error('No content.xml in ODT');
            result = await parser.parseStringPromise(contentXml);
            const paragraphs = result['office:document-content']['office:body'][0]['office:text'][0]['text:p'] || [];
            return paragraphs.map(p => extractTextFromXml(p)).join('\n');
        } else {
            // Flat ODF
            result = await parser.parseStringPromise(xmlContent);
            const paragraphs = result['office:document']['office:body'][0]['office:text'][0]['text:p'] || [];
            return paragraphs.map(p => extractTextFromXml(p)).join('\n');
        }
    } catch (error) {
        console.error('ODT parsing error:', error);
        return 'Error parsing ODT file';
    }
}

function extractTextFromXml(p) {
    if (typeof p === 'string') return p;
    if (p._) return p._;
    if (p['text:span']) {
        return p['text:span'].map(span => span._ || span).join('');
    }
    return '';
}

async function convertOdtToPdf(buffer) {
    const text = await convertOdtToTxt(buffer);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.fontSize(12);
        doc.text(text, {
            width: 500,
            align: 'left',
            lineGap: 5
        });
        doc.end();
    });
}

async function convertOdtToDocx(buffer) {
    const text = await convertOdtToTxt(buffer);

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

async function convertOdtToPdf(buffer) {
    const text = await convertOdtToTxt(buffer);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.fontSize(12);
        doc.text(text, {
            width: 500,
            align: 'left',
            lineGap: 5
        });
        doc.end();
    });
}

async function convertOdtToDocx(buffer) {
    const text = await convertOdtToTxt(buffer);

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
    throw new Error('PDF to ODT conversion is not supported');
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
        peers: activePeers.map(p => ({ id: p.id, name: p.name, lastSeen: p.lastSeen })),
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
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
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
            case 'reject':
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
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

async function getPublicIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch (error) {
        return 'Unable to fetch public IP';
    }
}

server.listen(PORT, HOST, async () => {
    const localIP = getLocalIP();
    console.log(`🚀 ShareIt server running on http://${HOST}:${PORT}`);
    console.log(`🏠 Local access: http://${localIP}:${PORT}`);
    const publicIP = await getPublicIP();
    console.log(`🌐 Public IP: ${publicIP}`);
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
