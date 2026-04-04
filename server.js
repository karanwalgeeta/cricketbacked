
require('dotenv').config();
const express   = require('express');
const http      = require('http');
const socketIo  = require('socket.io');
const mongoose  = require('mongoose');
const cors      = require('cors');

// ── Route imports ──────────────────────────────────────────
const authRoutes        = require('./routes/auth');
const duelRoutes        = require('./routes/duel');
const walletRoutes      = require('./routes/wallet');
const matchRoutes       = require('./routes/match');
const leaderboardRoutes = require('./routes/leaderboard');
const socketHandler     = require('./socket/socketHandler');



const app    = express();
const server = http.createServer(app);

// ── Allowed Origins (FIXED CORS 🔥) ────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:3000",
  "https://frontendcrick.onrender.com",
  process.env.CLIENT_URL
];

// ── Socket.IO setup ────────────────────────────────────────
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});


// const io = socketIo(server, {
//   cors: {
//     origin:      process.env.CLIENT_URL || 'http://localhost:3000',
//     methods:     ['GET', 'POST'],
//     credentials: true,
//   },
// });


// ── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  credentials: true,
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// app.use(cors({
//   origin:      process.env.CLIENT_URL || 'http://localhost:3000',
//   credentials: true,
// }));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));




// ── MongoDB Connection ─────────────────────────────────────
mongoose.set("strictQuery", false);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/duel',        duelRoutes);
app.use('/api/wallet',      walletRoutes);
app.use('/api/match',       matchRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', require('./routes/admin'));

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    message: '🏏 IPL Fantasy Duel API is running!',
    timestamp: new Date().toISOString(),
  });
});

// ── Root route (optional but useful) ───────────────────────
app.get('/', (_req, res) => {
  res.send('🚀 IPL Fantasy Backend is LIVE');
});

// ── 404 handler ────────────────────────────────────────────
app.use('*', (_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Socket.IO ─────────────────────────────────────────────
socketHandler(io);

// ── Start server with AUTO PORT SWITCH 🔥 ──────────────────
const startServer = (port) => {
  const serverInstance = server.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🌐 Allowed origins:`, allowedOrigins);
  });



  serverInstance.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️ Port ${port} busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error("❌ Server error:", err);
    }
  });
};

// ── Start ─────────────────────────────────────────────────
startServer(parseInt(process.env.PORT) || 5000);

module.exports = { app, io };
