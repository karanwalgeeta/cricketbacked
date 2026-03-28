// const mongoose = require('mongoose');

// const transactionSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

//   type: {
//     type: String,
//     enum: ['deposit', 'withdrawal', 'duel_stake', 'duel_win', 'duel_refund', 'commission', 'bonus', 'referral'],
//     required: true,
//   },

//   amount:   { type: Number, required: true },         // coins OR paise (for INR)
//   currency: { type: String, enum: ['coins', 'INR'], default: 'coins' },
//   status:   { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },

//   description:       String,
//   duelId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Duel' },

//   // Razorpay payment fields
//   razorpayOrderId:   String,
//   razorpayPaymentId: String,
//   razorpaySignature: String,

//   // Balance snapshot
//   balanceBefore: Number,
//   balanceAfter:  Number,

//   createdAt: { type: Date, default: Date.now },
// });

// // Index for fast user transaction queries
// transactionSchema.index({ userId: 1, createdAt: -1 });

// module.exports = mongoose.model('Transaction', transactionSchema);





const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  type: {
    type: String,
    enum: [
      'deposit',
      'withdrawal',
      'duel_stake',
      'duel_win',
      'duel_refund',
      'commission',
      'bonus',
      'referral'
    ],
    required: true,
  },

  amount:   { type: Number, required: true },
  currency: { type: String, enum: ['coins', 'INR'], default: 'coins' },

  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },

  description: String,
  duelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Duel' },

  // 🔥 CRYPTO FIELDS (IMPORTANT)
  txHash: { type: String, unique: true, sparse: true },
  network: { type: String, enum: ['TRC20', 'BEP20'] },
  fromAddress: String,
  toAddress: String,
  withdrawAddress: String,

  // ✅ PayPal fields
  paypalOrderId: String,
  paypalPaymentId: String,
  paypalPayerId: String,

  balanceBefore: Number,
  balanceAfter: Number,

  createdAt: { type: Date, default: Date.now },
});

// 🔥 Index for fast queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ txHash: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
