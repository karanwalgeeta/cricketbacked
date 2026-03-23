const express     = require('express');
const router      = express.Router();
const crypto      = require('crypto');
const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const auth        = require('../middleware/auth');

// Razorpay — only initialise when API keys are present
const getRazorpay = () => {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || keyId === 'your_razorpay_key_id_here') return null;
  try {
    const Razorpay = require('razorpay');
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch { return null; }
};

// ══════════════════════════════════════════════════════════
// POST /api/wallet/create-order  — initiate Razorpay deposit
// ══════════════════════════════════════════════════════════
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount } = req.body;  // amount in INR rupees

    if (!amount || amount < 10 || amount > 10000) {
      return res.status(400).json({ success: false, message: 'Amount must be between ₹10 and ₹10,000' });
    }

    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(400).json({
        success: false,
        message: 'Payment gateway not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env',
      });
    }

    const order = await razorpay.orders.create({
      amount:   amount * 100,   // convert to paise
      currency: 'INR',
      receipt:  `rcpt_${Date.now()}`,
      notes:    { userId: req.user._id.toString() },
    });

    // Save pending transaction
    await Transaction.create({
      userId:          req.user._id,
      type:            'deposit',
      amount:          amount * 100,
      currency:        'INR',
      status:          'pending',
      description:     `Deposit ₹${amount} via Razorpay`,
      razorpayOrderId: order.id,
      balanceBefore:   req.user.wallet.realBalance,
    });

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Create order:', err);
    res.status(500).json({ success: false, message: 'Payment gateway error' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/wallet/verify-payment  — confirm Razorpay payment
// ══════════════════════════════════════════════════════════
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Find pending transaction
    const tx = await Transaction.findOne({ razorpayOrderId: razorpay_order_id });
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (tx.status === 'completed') return res.status(400).json({ success: false, message: 'Payment already verified' });

    // Credit user balance
    const user = await User.findById(req.user._id);
    user.wallet.realBalance += tx.amount;  // amount is already in paise
    await user.save();

    // Update transaction
    tx.status              = 'completed';
    tx.razorpayPaymentId   = razorpay_payment_id;
    tx.razorpaySignature   = razorpay_signature;
    tx.balanceAfter        = user.wallet.realBalance;
    await tx.save();

    res.json({
      success:    true,
      message:    `₹${tx.amount / 100} added to your wallet!`,
      newBalance: user.wallet.realBalance,
    });
  } catch (err) {
    console.error('Verify payment:', err);
    res.status(500).json({ success: false, message: 'Payment verification error' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/wallet/withdraw  — UPI withdrawal request
// ══════════════════════════════════════════════════════════
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, upiId } = req.body;  // amount in INR rupees

    if (!amount || amount < 100) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is ₹100' });
    }
    if (!upiId || !upiId.includes('@')) {
      return res.status(400).json({ success: false, message: 'Invalid UPI ID format' });
    }

    const user = await User.findById(req.user._id);
    if (user.wallet.realBalance < amount * 100) {
      return res.status(400).json({ success: false, message: `Insufficient balance. You have ₹${user.wallet.realBalance / 100}` });
    }

    const before = user.wallet.realBalance;
    user.wallet.realBalance -= amount * 100;
    await user.save();

    await Transaction.create({
      userId:        user._id,
      type:          'withdrawal',
      amount:        amount * 100,
      currency:      'INR',
      status:        'pending',   // process manually or via payout API
      description:   `Withdrawal to UPI: ${upiId}`,
      balanceBefore: before,
      balanceAfter:  user.wallet.realBalance,
    });

    res.json({
      success:    true,
      message:    'Withdrawal request submitted! Processed within 24 hours.',
      newBalance: user.wallet.realBalance,
    });
  } catch (err) {
    console.error('Withdraw:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/wallet/coins-to-cash  — convert coins to real money
// ══════════════════════════════════════════════════════════
router.post('/coins-to-cash', auth, async (req, res) => {
  try {
    const { coins } = req.body;

    if (!coins || coins < 500) {
      return res.status(400).json({ success: false, message: 'Minimum conversion is 500 coins' });
    }

    const user = await User.findById(req.user._id);
    if (user.wallet.coins < coins) {
      return res.status(400).json({ success: false, message: `Insufficient coins. You have ${user.wallet.coins}` });
    }

    // Conversion rate: 100 coins = ₹1 = 100 paise
    const paise  = Math.floor(coins / 100) * 100;
    const before = user.wallet.realBalance;

    user.wallet.coins       -= coins;
    user.wallet.realBalance += paise;
    await user.save();

    await Transaction.create({
      userId:        user._id,
      type:          'bonus',
      amount:        paise,
      currency:      'INR',
      status:        'completed',
      description:   `Converted ${coins} coins → ₹${paise / 100}`,
      balanceBefore: before,
      balanceAfter:  user.wallet.realBalance,
    });

    res.json({
      success: true,
      message: `${coins} coins converted to ₹${paise / 100}!`,
      wallet:  user.wallet,
    });
  } catch (err) {
    console.error('Coins to cash:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/wallet/transactions  — transaction history
// ══════════════════════════════════════════════════════════
router.get('/transactions', auth, async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments({ userId: req.user._id }),
    ]);

    res.json({
      success: true,
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
