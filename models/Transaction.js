
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
      'referral',
    ],
    required: true,
  },

  amount:   { type: Number, required: true },
  currency: { type: String, enum: ['coins', 'INR'], default: 'INR' },

  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },

  description: String,
  adminNote:   { type: String, default: null }, // ✅ sahi jagah
  duelId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Duel' },

  // 🔥 CRYPTO FIELDS
  txHash:          { type: String, unique: true, sparse: true },
  network:         { type: String, enum: ['TRC20', 'BEP20'] },
  fromAddress:     String,
  toAddress:       String,
  withdrawAddress: String,

  // 💰 USDT tracking
  usdtAmount:    { type: Number }, // actual USDT value
  usdtToInrRate: { type: Number }, // rate at time of tx

  // ✅ PayPal fields
  paypalOrderId:   String,
  paypalPaymentId: String,
  paypalPayerId:   String,

  balanceBefore: Number,
  balanceAfter:  Number,

}, { timestamps: true });

// 🔥 Indexes
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1, status: 1 }); // ✅ admin filter ke liye

module.exports = mongoose.model('Transaction', transactionSchema);


