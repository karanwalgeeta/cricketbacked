const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchId:  { type: String, unique: true, required: true },

  team1: {
    name:      String,
    shortName: String,
    logo:      String,
    score:     String,
    wickets:   Number,
    overs:     String,
  },
  team2: {
    name:      String,
    shortName: String,
    logo:      String,
    score:     String,
    wickets:   Number,
    overs:     String,
  },

  venue:  String,
  date:   Date,
  status: { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming' },
  result: String,
  winnerShortName: String,

  currentBatsmen: [{
    name:  String,
    runs:  Number,
    balls: Number,
    fours: Number,
    sixes: Number,
  }],
  currentBowler: {
    name:    String,
    overs:   String,
    wickets: Number,
    runs:    Number,
  },

  recentBalls:  [String],
  tossWinner:   String,
  tossDecision: String,

  topBatsmen: [{ name: String, team: String, runs: Number, balls: Number }],
  topBowlers: [{ name: String, team: String, wickets: Number, runs: Number, overs: String }],

  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Match', matchSchema);
