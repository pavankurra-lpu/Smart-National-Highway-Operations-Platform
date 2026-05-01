const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const rateLimit = require('express-rate-limit');
app.use(rateLimit({ windowMs: 60000, max: 100 }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Store active sessions in memory
const activeJourneys = new Map();

// Clean up journeys older than 6 hours
setInterval(() => {
    const cutoff = Date.now() - (6 * 60 * 60 * 1000);
    for (const [tripId, data] of activeJourneys.entries()) {
        if (data.lastUpdate < cutoff) {
            activeJourneys.delete(tripId);
        }
    }
}, 30 * 60 * 1000);  // Run every 30 minutes

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a specific vehicle trip for updates
    socket.on('join-trip', (tripId) => {
        socket.join(tripId);
        console.log(`Socket ${socket.id} joined trip ${tripId}`);
    });

    // Handle SOS alerts from user to broadcast to admin
    socket.on('send-sos', (sosData) => {
        console.log('SOS Received:', sosData);
        io.emit('new-sos-alert', {
            ...sosData,
            serverTimestamp: new Date().toISOString()
        });
    });

    // Handle Admin Broadcasts (Traffic, Weather, etc)
    socket.on('admin-broadcast', (data) => {
        const validToken = process.env.ADMIN_TOKEN || 'NHAI_ADMIN';
        if (!data.token || data.token !== validToken) {
            socket.emit('error', 'Unauthorized');
            return;
        }
        console.log('Admin Broadcast:', data.alertData);
        io.emit('broadcast-alert', { ...data.alertData });
    });

    // Live Vehicle Position Tracking
    socket.on('update-position', (data) => {
        const { tripId, lat, lng } = data;
        activeJourneys.set(tripId, { lat, lng, lastUpdate: Date.now() });
        // Broadcast to anyone tracking this trip (like an Admin portal)
        socket.to(tripId).emit('vehicle-moved', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'NHAI Backend Live', sessions: activeJourneys.size });
});

server.listen(PORT, () => {
    console.log(`NHAI Real-time Server running on http://localhost:${PORT}`);
});
