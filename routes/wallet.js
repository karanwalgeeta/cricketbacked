
const express = require('express');
const router = express.Router();
const axios = require('axios');

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// 🔥 YOUR USDT WALLET (TRC20)
// const USDT_WALLET_ADDRESS = "TQsEarYiyLzdtMS5CpitUb6jAdGsWxREBz";

const USDT_WALLET_ADDRESS = process.env.USDT_WALLET_ADDRESS;
const USDT_TO_INR = Number(process.env.USDT_TO_INR) || 80;


// 🔥 FIXED RATE (later dynamic kar sakta hai)
// const USDT_TO_INR = 80;

// ═══════════════════════════════════════════════
// 🔥 GET USDT ADDRESS (Frontend use karega)
// ═══════════════════════════════════════════════
router.get('/usdt-address', (req, res) => {
  res.json({
    success: true,
    address: USDT_WALLET_ADDRESS
  });
});



// ═══════════════════════════════════════════════
// 🔍 VERIFY USDT (TRON API)
// ═══════════════════════════════════════════════
const verifyUSDT = async (txHash) => {
  try {
    const res = await axios.get(
      `https://apilist.tronscan.org/api/transaction-info?hash=${txHash}`
    );

    const tx = res.data;

    if (!tx || tx.contractRet !== 'SUCCESS') {
      return { success: false };
    }

    return {
      success: true,
      amount: tx.contractData.amount / 1e6,
      to: tx.contractData.to_address,
      from: tx.ownerAddress,
    };

  } catch (err) {
    console.error("Verify Error:", err);
    return { success: false };
  }
};



// ═══════════════════════════════════════════════
// 💰 VERIFY + DEPOSIT (MAIN API)
// ═══════════════════════════════════════════════
router.post('/verify-usdt', auth, async (req, res) => {
  try {
    const { txHash } = req.body;

    if (!txHash) {
      return res.json({ success: false, message: 'txHash required' });
    }

    // 🔒 DUPLICATE CHECK
    const exists = await Transaction.findOne({ txHash });
    if (exists) {
      return res.json({ success: false, message: 'Already used txHash' });
    }

    const verify = await verifyUSDT(txHash);

    if (!verify.success) {
      return res.json({ success: false, message: 'Invalid or pending transaction' });
    }

    // 🔒 ADDRESS CHECK
    if (verify.to !== USDT_WALLET_ADDRESS) {
      return res.json({ success: false, message: 'Wrong wallet address' });
    }

    // 🔒 MINIMUM AMOUNT CHECK
    if (verify.amount <= 0) {
      return res.json({ success: false, message: 'Invalid amount' });
    }

    const user = await User.findById(req.user._id);

    const amountUSDT = verify.amount;
    const amountINR = amountUSDT * USDT_TO_INR;

    const before = user.wallet.realBalance;
    user.wallet.realBalance += amountINR * 100;

    await user.save();

    // 🔥 SAVE TRANSACTION
    await Transaction.create({
      userId: user._id,
      type: 'deposit',
      amount: amountINR * 100,
      currency: 'INR',
      status: 'completed',
      txHash,
      fromAddress: verify.from,
      toAddress: verify.to,
      network: 'TRC20',
      description: `USDT Deposit (${amountUSDT} USDT)`,
      balanceBefore: before,
      balanceAfter: user.wallet.realBalance,
    });

    res.json({
      success: true,
      message: `Deposit successful (${amountUSDT} USDT)`,
      newBalance: user.wallet.realBalance,
    });

  } catch (err) {
    console.error("Deposit Error:", err);
    res.status(500).json({ success: false });
  }
});



// ═══════════════════════════════════════════════
// 💸 WITHDRAW USDT (REQUEST)
// ═══════════════════════════════════════════════
router.post('/withdraw-usdt', auth, async (req, res) => {
  try {
    const { amount, address } = req.body;

    if (!amount || amount < 100) {
      return res.json({ success: false, message: 'Minimum ₹100 required' });
    }

    if (!address || address.length < 20) {
      return res.json({ success: false, message: 'Invalid USDT address' });
    }

    const user = await User.findById(req.user._id);

    if (user.wallet.realBalance < amount * 100) {
      return res.json({ success: false, message: 'Insufficient balance' });
    }

    const before = user.wallet.realBalance;
    user.wallet.realBalance -= amount * 100;

    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'withdrawal',
      amount: amount * 100,
      currency: 'INR',
      status: 'pending',
      withdrawAddress: address,
      network: 'TRC20',
      description: `USDT Withdrawal (${amount})`,
      balanceBefore: before,
      balanceAfter: user.wallet.realBalance,
    });

    res.json({
      success: true,
      message: 'Withdrawal request submitted',
    });

  } catch (err) {
    console.error("Withdraw Error:", err);
    res.status(500).json({ success: false });
  }
});



// ═══════════════════════════════════════════════
// 📜 USER TRANSACTIONS
// ═══════════════════════════════════════════════
router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      transactions,
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});



// ═══════════════════════════════════════════════
// 🔥 ADMIN: ALL PAYMENTS
// ═══════════════════════════════════════════════
router.get('/admin/all-payments', async (req, res) => {
  try {
    const payments = await Transaction.find({ type: 'deposit' })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments,
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});



module.exports = router;
