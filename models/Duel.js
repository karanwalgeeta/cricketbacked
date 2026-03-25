// const mongoose = require('mongoose');

// // ── Prediction sub-schema ──────────────────────────────────
// const predictionSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   username: String,
//   predictionType: {
//     type: String,
//     enum: ['match_winner', 'top_batsman', 'top_bowler', 'next_wicket', 'over_runs', 'player_runs'],
//     required: true,
//   },
//   predictedValue: { type: String, required: true },
//   confidence:     { type: Number, min: 1, max: 100, default: 50 },
//   isCorrect:      { type: Boolean, default: null },   // null = result pending
//   submittedAt:    { type: Date, default: Date.now },
// });

// // ── Participant sub-schema ─────────────────────────────────
// const participantSchema = new mongoose.Schema({
//   userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   username:    String,
//   avatar:      String,
//   stakeAmount: Number,
//   stakeType:   { type: String, enum: ['coins', 'real'], default: 'coins' },
//   predictions: [predictionSchema],
//   score:       { type: Number, default: 0 },
//   isReady:     { type: Boolean, default: false },
//   joinedAt:    { type: Date, default: Date.now },
// });

// // ── Duel schema ────────────────────────────────────────────
// const duelSchema = new mongoose.Schema({
//   roomCode: { type: String, unique: true, required: true, uppercase: true },
//   duelType: { type: String, enum: ['1v1', 'group'], default: '1v1' },
//   status: {
//     type: String,
//     enum: ['waiting', 'active', 'prediction_phase', 'locked', 'completed', 'cancelled'],
//     default: 'waiting',
//   },

//   // Match info
//   matchId:   { type: String, required: true },
//   matchName: String,
//   matchDate: Date,

//   // Players
//   participants:    [participantSchema],
//   maxParticipants: { type: Number, default: 2 },

//   // Settings
//   stakeType:            { type: String, enum: ['coins', 'real'], default: 'coins' },
//   predictionCategories: [String],

//   // Financial
//   totalPool:       { type: Number, default: 0 },
//   houseCommission: { type: Number, default: 0 },
//   winnerPrize:     { type: Number, default: 0 },

//   // Result
//   winnerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   winnerUsername: String,

//   // Timestamps
//   predictionDeadline: Date,
//   createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   createdAt:          { type: Date, default: Date.now },
//   completedAt:        Date,
// });

// // ── Static: generate unique room code ─────────────────────
// duelSchema.statics.generateRoomCode = function () {
//   return 'IPL' + Math.random().toString(36).substr(2, 6).toUpperCase();
// };

// module.exports = mongoose.model('Duel', duelSchema);







const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchId: { type: String, unique: true, required: true },

  // Team 1 details
  team1: {
    name: { type: String, default: "TBD" },
    shortName: { type: String, default: "TBD" },
    logo: { type: String, default: "" },
    score: { type: String, default: "0" },
    wickets: { type: Number, default: 0 },
    overs: { type: String, default: "0.0" },
  },

  // Team 2 details
  team2: {
    name: { type: String, default: "TBD" },
    shortName: { type: String, default: "TBD" },
    logo: { type: String, default: "" },
    score: { type: String, default: "0" },
    wickets: { type: Number, default: 0 },
    overs: { type: String, default: "0.0" },
  },

  // Match info
  venue: { type: String, default: "TBA" },
  date: Date,

  status: {
    type: String,
    enum: ['upcoming', 'live', 'completed'],
    default: 'upcoming'
  },

  result: { type: String, default: null },
  winnerShortName: { type: String, default: null },

  // Current batting players (for live matches)
  currentBatsmen: [{
    name: { type: String, default: "" },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
  }],

  // Current bowler (for live matches)
  currentBowler: {
    name: { type: String, default: "" },
    overs: { type: String, default: "0.0" },
    wickets: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
  },

  // Recent balls for live score widget
  recentBalls: [{ type: String }],  // e.g., ["4", "6", "W", "1", "2"]

  // Toss info
  tossWinner: { type: String, default: null },
  tossDecision: { type: String, default: null },

  // Top performers (for post-match)
  topBatsmen: [{
    name: String,
    team: String,
    runs: Number,
    balls: Number,
  }],
  topBowlers: [{
    name: String,
    team: String,
    wickets: Number,
    runs: Number,
    overs: String,
  }],

  // Tournament info
  series: { type: String, default: "Unknown" },
  tournament: { type: String, enum: ['IPL', 'PSL', 'Other'], default: 'Other' },

}, { timestamps: true });

// Index for faster queries
matchSchema.index({ status: 1, date: -1 });
matchSchema.index({ matchId: 1 });

module.exports = mongoose.model('Match', matchSchema);
