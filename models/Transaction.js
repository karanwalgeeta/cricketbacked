
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

  // ✅ INR add kiya — crypto deposits INR mein store hote hain
  currency: { type: String, enum: ['coins', 'INR'], default: 'INR' },

  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },

  description: String,
  duelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Duel' },

  // 🔥 CRYPTO FIELDS
  txHash:          { type: String, unique: true, sparse: true },
  network:         { type: String, enum: ['TRC20', 'BEP20'] },
  fromAddress:     String,
  toAddress:       String,
  withdrawAddress: String,

  // 💰 USDT amount alag track karo (INR conversion ke alawa)
  usdtAmount: { type: Number },          // actual USDT value jo send hua
  usdtToInrRate: { type: Number },       // conversion rate at time of tx

  // ✅ PayPal fields
  paypalOrderId:   String,
  paypalPaymentId: String,
  paypalPayerId:   String,

  balanceBefore: Number,
  balanceAfter:  Number,

}, { timestamps: true });  // ← createdAt/updatedAt auto-manage hoga

// 🔥 Indexes
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ status: 1 });  // ← pending withdrawals filter ke liye useful

module.exports = mongoose.model('Transaction', transactionSchema);
