

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
