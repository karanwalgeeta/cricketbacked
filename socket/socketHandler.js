const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const Duel = require('../models/Duel');

/**
 * Socket.IO Handler
 * Handles all real-time events for:
 * - Duel rooms (join, leave, predictions, chat)
 * - Match score updates
 * - User-to-user challenges
 * - Online count broadcasting
 */
module.exports = (io) => {
  const rooms       = new Map();   // roomCode → Set<socketId>
  const userSockets = new Map();   // userId   → socketId

  // ── Auth middleware ────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication token required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.userId).select('-password');
      if (!user || !user.isActive) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection ─────────────────────────────────────────
  io.on('connection', (socket) => {
    const { username, _id } = socket.user;
    console.log(`🔌 ${username} connected (${socket.id})`);

    // Track user socket
    userSockets.set(_id.toString(), socket.id);

    // Broadcast online count
    io.emit('online_count', io.engine.clientsCount);

    // ── Duel Room Events ─────────────────────────────────

    /** Join a duel room */
    socket.on('join_duel_room', async ({ roomCode }) => {
      try {
        if (!roomCode) return;
        const code = roomCode.toUpperCase();
        const duel = await Duel.findOne({ roomCode: code });
        if (!duel) { socket.emit('error', { message: 'Duel not found' }); return; }

        // Join the socket room
        socket.join(code);
        if (!rooms.has(code)) rooms.set(code, new Set());
        rooms.get(code).add(socket.id);

        // Notify other players in room
        socket.to(code).emit('player_joined', {
          username: socket.user.username,
          avatar:   socket.user.avatar,
          count:    rooms.get(code).size,
        });

        // Send current duel state to the joining player
        socket.emit('duel_state', {
          duel: {
            roomCode:             duel.roomCode,
            status:               duel.status,
            matchName:            duel.matchName,
            stakeType:            duel.stakeType,
            totalPool:            duel.totalPool,
            predictionCategories: duel.predictionCategories,
            predictionDeadline:   duel.predictionDeadline,
            participants:         duel.participants.map(p => ({
              username: p.username,
              avatar:   p.avatar,
              isReady:  p.isReady,
              score:    p.score,
            })),
          },
        });
      } catch (err) {
        console.error('join_duel_room error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /** Leave a duel room */
    socket.on('leave_duel_room', ({ roomCode }) => {
      if (!roomCode) return;
      const code = roomCode.toUpperCase();
      socket.leave(code);
      rooms.get(code)?.delete(socket.id);
      socket.to(code).emit('player_left', { username: socket.user.username });
    });

    /** Notify room when a player submits predictions */
    socket.on('prediction_submitted', async ({ roomCode }) => {
      try {
        const code = roomCode?.toUpperCase();
        if (!code) return;

        const duel = await Duel.findOne({ roomCode: code });
        if (!duel) return;

        const readyCount = duel.participants.filter(p => p.isReady).length;

        io.to(code).emit('participant_ready', {
          username:   socket.user.username,
          readyCount,
          totalCount: duel.participants.length,
        });

        // If all players are ready, notify the room
        if (duel.status === 'locked') {
          io.to(code).emit('predictions_locked', {
            message: 'All predictions submitted! Waiting for match result…',
          });
        }
      } catch (err) {
        console.error('prediction_submitted error:', err);
      }
    });

    // ── Chat ─────────────────────────────────────────────

    /** Send a message in a duel room */
    socket.on('duel_message', ({ roomCode, message }) => {
      if (!roomCode || !message || message.trim().length === 0) return;
      if (message.length > 200) return;   // limit message size

      io.to(roomCode.toUpperCase()).emit('duel_message', {
        username:  socket.user.username,
        avatar:    socket.user.avatar,
        message:   message.trim(),
        timestamp: new Date(),
      });
    });

    // ── Match Watching ────────────────────────────────────

    /** Subscribe to live match score updates */
    socket.on('watch_match', ({ matchId }) => {
      if (matchId) socket.join(`match_${matchId}`);
    });

    socket.on('unwatch_match', ({ matchId }) => {
      if (matchId) socket.leave(`match_${matchId}`);
    });

    // ── Challenges ────────────────────────────────────────

    /** Send a duel challenge to another user */
    socket.on('send_challenge', async ({ targetUsername, matchId, stakeAmount }) => {
      try {
        const target = await User.findOne({ username: targetUsername });
        if (!target) { socket.emit('error', { message: 'User not found' }); return; }

        const targetSocketId = userSockets.get(target._id.toString());
        if (targetSocketId) {
          io.to(targetSocketId).emit('duel_challenge', {
            from:        socket.user.username,
            matchId,
            stakeAmount,
            message:     `${socket.user.username} is challenging you to a duel! 🏏`,
          });
          socket.emit('challenge_sent', { to: targetUsername, status: 'delivered' });
        } else {
          socket.emit('challenge_sent', { to: targetUsername, status: 'offline' });
        }
      } catch (err) {
        console.error('send_challenge error:', err);
        socket.emit('error', { message: 'Failed to send challenge' });
      }
    });

    // ── Disconnect ────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`❌ ${username} disconnected`);
      userSockets.delete(_id.toString());

      // Remove from all duel rooms
      rooms.forEach((sockets, roomCode) => {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          socket.to(roomCode).emit('player_disconnected', { username });
        }
      });

      io.emit('online_count', io.engine.clientsCount);
    });
  });

  // ── Simulate live match score updates every 30 seconds ─
  // In production: replace with real cricket API webhook/polling
  setInterval(() => {
    const balls    = ['0', '1', '2', '4', '6', 'W', 'NB'];
    const randBall = balls[Math.floor(Math.random() * balls.length)];
    const randRuns = Math.floor(Math.random() * 30);

    io.to('match_ipl2025_m01').emit('match_update', {
      matchId:    'ipl2025_m01',
      team2Score: `${148 + randRuns}/7`,
      recentBall: randBall,
    });
  }, 30_000);
};
