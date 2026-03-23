const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String, required: true, unique: true,
    trim: true, minlength: 3, maxlength: 20,
  },
  email: {
    type: String, required: true, unique: true, lowercase: true, trim: true,
  },
  password:  { type: String, required: true, minlength: 6 },
  phone:     { type: String, required: true },
  avatar:    { type: String, default: 'avatar1' },

  wallet: {
    coins:       { type: Number, default: 1000 },   // welcome bonus
    realBalance: { type: Number, default: 0 },       // stored in paise (₹1 = 100 paise)
    totalEarned: { type: Number, default: 0 },
    totalSpent:  { type: Number, default: 0 },
  },

  stats: {
    duelsPlayed:        { type: Number, default: 0 },
    duelsWon:           { type: Number, default: 0 },
    duelsLost:          { type: Number, default: 0 },
    totalPredictions:   { type: Number, default: 0 },
    correctPredictions: { type: Number, default: 0 },
    winStreak:          { type: Number, default: 0 },
    maxWinStreak:       { type: Number, default: 0 },
  },

  badges:           [String],
  isPremium:        { type: Boolean, default: false },
  premiumExpiry:    Date,
  lastLoginBonus:   Date,
  loginStreak:      { type: Number, default: 0 },
  referralCode:     { type: String, unique: true, sparse: true },
  referredBy:       String,
  referralEarnings: { type: Number, default: 0 },
  isActive:         { type: Boolean, default: true },
  createdAt:        { type: Date, default: Date.now },
});

// ── Pre-save: hash password + generate referral code ───────
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (!this.referralCode) {
    this.referralCode =
      this.username.toUpperCase().slice(0, 4) +
      Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  next();
});

// ── Instance methods ───────────────────────────────────────
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Virtuals ───────────────────────────────────────────────
userSchema.virtual('winRate').get(function () {
  if (!this.stats.duelsPlayed) return 0;
  return Math.round((this.stats.duelsWon / this.stats.duelsPlayed) * 100);
});

userSchema.virtual('predictionAccuracy').get(function () {
  if (!this.stats.totalPredictions) return 0;
  return Math.round((this.stats.correctPredictions / this.stats.totalPredictions) * 100);
});

module.exports = mongoose.model('User', userSchema);
