
const mongoose = require('mongoose');

// ── Prediction sub-schema ──────────────────────────────────
const predictionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: String,
  predictionType: {
    type: String,
    enum: ['match_winner', 'top_batsman', 'top_bowler', 'next_wicket', 'over_runs', 'player_runs'],
    required: true,
  },
  predictedValue: { type: String, required: true },
  confidence:     { type: Number, min: 1, max: 100, default: 50 },
  isCorrect:      { type: Boolean, default: null },   // null = result pending
  submittedAt:    { type: Date, default: Date.now },
});

// ── Participant sub-schema ─────────────────────────────────
const participantSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username:    String,
  avatar:      String,
  stakeAmount: Number,
  stakeType:   { type: String, enum: ['coins', 'real'], default: 'coins' },
  predictions: [predictionSchema],
  score:       { type: Number, default: 0 },
  isReady:     { type: Boolean, default: false },
  joinedAt:    { type: Date, default: Date.now },
});

// ── Duel schema ────────────────────────────────────────────
const duelSchema = new mongoose.Schema({
  roomCode: { type: String, unique: true, required: true, uppercase: true },
  duelType: { type: String, enum: ['1v1', 'group'], default: '1v1' },
  status: {
    type: String,
    enum: ['waiting', 'active', 'prediction_phase', 'locked', 'completed', 'cancelled'],
    default: 'waiting',
  },

  // 🔥 NEW: Public/Private visibility
  isPrivate: { 
    type: Boolean, 
    default: false,
    index: true  // For faster queries on public duels
  },

  // Match info
  matchId:   { type: String, required: true },
  matchName: String,
  matchDate: Date,

  // Players
  participants:    [participantSchema],
  maxParticipants: { type: Number, default: 2 },

  // Settings
  stakeType:            { type: String, enum: ['coins', 'real'], default: 'coins' },
  stakeAmount:          { type: Number, default: 100 }, // 🔥 NEW: Store stake amount
  predictionCategories: [String],

  // Financial
  totalPool:       { type: Number, default: 0 },
  houseCommission: { type: Number, default: 0 },
  winnerPrize:     { type: Number, default: 0 },

  // Result
  winnerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winnerUsername: String,

  // Creator info
  createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByUsername:  { type: String, required: true }, // 🔥 NEW: For public list display



  // Timestamps
  predictionDeadline: Date,
  createdAt:          { type: Date, default: Date.now },
  completedAt:        Date,
});

// ── Static: generate unique room code ─────────────────────
duelSchema.statics.generateRoomCode = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// 🔥 NEW: Static method to get public duels
duelSchema.statics.getPublicDuels = function (limit = 50) {
  return this.find({ 
    isPrivate: false,
    status: 'waiting'
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// 🔥 Add index for better performance
duelSchema.index({ isPrivate: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Duel', duelSchema);
