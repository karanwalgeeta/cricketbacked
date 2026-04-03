const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Duel = require('../models/Duel');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// ══════════════════════════════════════════════════════════
// MIDDLEWARE — admin only
// ══════════════════════════════════════════════════════════
const adminOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch {
    res.status(500).json({ success: false });
  }
};

// ══════════════════════════════════════════════════════════
// 📊 DASHBOARD STATS
// GET /api/admin/dashboard
// ══════════════════════════════════════════════════════════
router.get('/dashboard', auth, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      newUsersToday,
      newUsersMonth,
      totalDuels,
      activeDuels,
      completedDuels,
      totalTransactions,
      deposits,
      withdrawals,
      pendingWithdrawals,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: thisMonth } }),
      Duel.countDocuments(),
      Duel.countDocuments({ status: { $in: ['waiting', 'prediction_phase', 'locked'] } }),
      Duel.countDocuments({ status: 'completed' }),
      Transaction.countDocuments(),
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.countDocuments({ type: 'withdrawal', status: 'pending' }),
    ]);

    // House commission earned
    const commissionData = await Duel.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$houseCommission' } } },
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          today: newUsersToday,
          thisMonth: newUsersMonth,
        },
        duels: {
          total: totalDuels,
          active: activeDuels,
          completed: completedDuels,
        },
        finance: {
          totalDeposits: deposits[0]?.total || 0,
          totalWithdrawals: withdrawals[0]?.total || 0,
          pendingWithdrawals,
          houseEarnings: commissionData[0]?.total || 0,
          totalTransactions,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// 👥 USERS
// ══════════════════════════════════════════════════════════
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email:    { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'banned') query.isBanned = true;
    if (status === 'active') query.isBanned = { $ne: true };

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      users,
      pagination: { page: Number(page), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Ban / Unban user
router.post('/users/:userId/ban', auth, adminOnly, async (req, res) => {
  try {
    const { ban, reason } = req.body; // ban: true/false
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isBanned = ban;
    user.banReason = ban ? (reason || 'Banned by admin') : null;
    await user.save();

    res.json({
      success: true,
      message: ban ? 'User banned' : 'User unbanned',
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Make admin / remove admin
router.post('/users/:userId/make-admin', auth, adminOnly, async (req, res) => {
  try {
    const { isAdmin } = req.body;
    await User.findByIdAndUpdate(req.params.userId, { isAdmin });
    res.json({ success: true, message: isAdmin ? 'Admin granted' : 'Admin removed' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Adjust user balance
router.post('/users/:userId/adjust-balance', auth, adminOnly, async (req, res) => {
  try {
    const { amount, type, note } = req.body; // type: 'coins' | 'real'
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const before = type === 'coins' ? user.wallet.coins : user.wallet.realBalance;

    if (type === 'coins') user.wallet.coins += Number(amount);
    else user.wallet.realBalance += Number(amount) * 100;

    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'bonus',
      amount: Math.abs(amount),
      currency: type === 'coins' ? 'coins' : 'INR',
      status: 'completed',
      description: note || `Admin adjustment`,
      balanceBefore: before,
      balanceAfter: type === 'coins' ? user.wallet.coins : user.wallet.realBalance,
    });

    res.json({ success: true, message: 'Balance adjusted' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// 💸 WITHDRAWALS
// ══════════════════════════════════════════════════════════
router.get('/withdrawals', auth, adminOnly, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { type: 'withdrawal' };
    if (status !== 'all') query.status = status;

    const [txs, total] = await Promise.all([
      Transaction.find(query)
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      withdrawals: txs,
      pagination: { page: Number(page), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Approve / Reject withdrawal
router.post('/withdrawals/:txId/action', auth, adminOnly, async (req, res) => {
  try {
    const { action, note } = req.body; // action: 'approve' | 'reject'
    const tx = await Transaction.findById(req.params.txId);
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (tx.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Already processed' });
    }

    if (action === 'approve') {
      tx.status = 'completed';
      tx.adminNote = note || 'Approved';
    } else if (action === 'reject') {
      tx.status = 'failed';
      tx.adminNote = note || 'Rejected';

      // Refund user
      const user = await User.findById(tx.userId);
      if (user) {
        if (tx.currency === 'coins') user.wallet.coins += tx.amount;
        else user.wallet.realBalance += tx.amount * 100;
        await user.save();

        await Transaction.create({
          userId: user._id,
          type: 'duel_refund',
          amount: tx.amount,
          currency: tx.currency,
          status: 'completed',
          description: `Withdrawal refund — ${note || 'Rejected by admin'}`,
          balanceBefore: tx.currency === 'coins'
            ? user.wallet.coins - tx.amount
            : user.wallet.realBalance - tx.amount * 100,
          balanceAfter: tx.currency === 'coins'
            ? user.wallet.coins
            : user.wallet.realBalance,
        });
      }
    }

    await tx.save();
    res.json({ success: true, message: `Withdrawal ${action}d` });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// 💰 DEPOSITS
// ══════════════════════════════════════════════════════════
router.get('/deposits', auth, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [txs, total] = await Promise.all([
      Transaction.find({ type: 'deposit' })
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments({ type: 'deposit' }),
    ]);

    res.json({
      success: true,
      deposits: txs,
      pagination: { page: Number(page), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// 📋 ALL TRANSACTIONS
// ══════════════════════════════════════════════════════════
router.get('/transactions', auth, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, userId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (type) query.type = type;
    if (userId) query.userId = userId;

    const [txs, total] = await Promise.all([
      Transaction.find(query)
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      transactions: txs,
      pagination: { page: Number(page), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// ⚔️ ROOMS / DUELS
// ══════════════════════════════════════════════════════════
router.get('/rooms', auth, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;

    const [duels, total] = await Promise.all([
      Duel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Duel.countDocuments(query),
    ]);

    res.json({
      success: true,
      rooms: duels,
      pagination: { page: Number(page), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Declare duel result
router.post('/rooms/:duelId/result', auth, adminOnly, async (req, res) => {
  try {
    const { correctAnswers } = req.body;
    const duel = await Duel.findById(req.params.duelId);
    if (!duel) return res.status(404).json({ success: false, message: 'Duel not found' });
    if (duel.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Already completed' });
    }

    const COMMISSION = parseFloat(process.env.HOUSE_COMMISSION) || 0.10;

    let highestScore = -1;
    let winners = [];

    for (const participant of duel.participants) {
      let score = 0;
      for (const pred of participant.predictions) {
        const correct = correctAnswers[pred.predictionType];
        pred.isCorrect = correct &&
          pred.predictedValue.toLowerCase() === correct.toLowerCase();
        if (pred.isCorrect) score++;
      }
      participant.score = score;
      if (score > highestScore) { highestScore = score; winners = [participant]; }
      else if (score === highestScore) { winners.push(participant); }
    }

    const commission     = Math.floor(duel.totalPool * COMMISSION);
    const prizePool      = duel.totalPool - commission;
    const prizePerWinner = Math.floor(prizePool / winners.length);

    duel.houseCommission = commission;
    duel.winnerPrize     = prizePerWinner;
    duel.status          = 'completed';
    duel.completedAt     = new Date();

    if (winners.length === 1) {
      duel.winnerId       = winners[0].userId;
      duel.winnerUsername = winners[0].username;
    }
    await duel.save();

    for (const winner of winners) {
      const winnerUser = await User.findById(winner.userId);
      if (!winnerUser) continue;

      const before = duel.stakeType === 'coins'
        ? winnerUser.wallet.coins
        : winnerUser.wallet.realBalance;

      if (duel.stakeType === 'coins') winnerUser.wallet.coins += prizePerWinner;
      else winnerUser.wallet.realBalance += prizePerWinner * 100;

      winnerUser.wallet.totalEarned = (winnerUser.wallet.totalEarned || 0) + prizePerWinner;
      winnerUser.stats.duelsWon     = (winnerUser.stats.duelsWon     || 0) + 1;
      winnerUser.stats.winStreak    = (winnerUser.stats.winStreak    || 0) + 1;
      winnerUser.stats.maxWinStreak = Math.max(
        winnerUser.stats.winStreak || 0,
        winnerUser.stats.maxWinStreak || 0
      );
      await winnerUser.save();

      await Transaction.create({
        userId: winnerUser._id,
        type: 'duel_win',
        amount: prizePerWinner,
        currency: duel.stakeType === 'coins' ? 'coins' : 'INR',
        status: 'completed',
        description: `Won duel ${duel.roomCode}! 🏆`,
        duelId: duel._id,
        balanceBefore: before,
        balanceAfter: duel.stakeType === 'coins'
          ? winnerUser.wallet.coins
          : winnerUser.wallet.realBalance,
      });
    }

    for (const participant of duel.participants) {
      const isWinner = winners.some(
        w => w.userId.toString() === participant.userId.toString()
      );
      const pUser = await User.findById(participant.userId);
      if (!pUser) continue;

      pUser.stats.duelsPlayed        = (pUser.stats.duelsPlayed        || 0) + 1;
      pUser.stats.totalPredictions   = (pUser.stats.totalPredictions   || 0) + participant.predictions.length;
      pUser.stats.correctPredictions = (pUser.stats.correctPredictions || 0) +
        participant.predictions.filter(p => p.isCorrect).length;

      if (!isWinner) {
        pUser.stats.duelsLost = (pUser.stats.duelsLost || 0) + 1;
        pUser.stats.winStreak = 0;
      }
      await pUser.save();
    }

    res.json({
      success: true,
      message: 'Result declared!',
      result: {
        winners: winners.map(w => ({ username: w.username, score: w.score })),
        prizePerWinner,
        commission,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Cancel duel + refund
router.post('/rooms/:duelId/cancel', auth, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;
    const duel = await Duel.findById(req.params.duelId);
    if (!duel) return res.status(404).json({ success: false, message: 'Duel not found' });
    if (duel.status === 'completed' || duel.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot cancel this duel' });
    }

    duel.status = 'cancelled';
    await duel.save();

    // Refund all participants
    for (const p of duel.participants) {
      const user = await User.findById(p.userId);
      if (!user) continue;

      if (p.stakeType === 'coins') user.wallet.coins += p.stakeAmount;
      else user.wallet.realBalance += p.stakeAmount * 100;
      await user.save();

      await Transaction.create({
        userId: user._id,
        type: 'duel_refund',
        amount: p.stakeAmount,
        currency: p.stakeType === 'coins' ? 'coins' : 'INR',
        status: 'completed',
        description: `Duel ${duel.roomCode} cancelled — ${reason || 'Admin cancelled'}`,
        duelId: duel._id,
        balanceBefore: p.stakeType === 'coins'
          ? user.wallet.coins - p.stakeAmount
          : user.wallet.realBalance - p.stakeAmount * 100,
        balanceAfter: p.stakeType === 'coins'
          ? user.wallet.coins
          : user.wallet.realBalance,
      });
    }

    res.json({ success: true, message: 'Duel cancelled and refunds processed' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// 📈 EARNINGS
// ══════════════════════════════════════════════════════════
router.get('/earnings', auth, adminOnly, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [commissions, depositTotal, withdrawTotal, dailyEarnings] = await Promise.all([
      Duel.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$houseCommission' } } },
      ]),
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'completed', createdAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      earnings: {
        houseCommission: commissions[0]?.total || 0,
        totalDeposits:   depositTotal[0]?.total || 0,
        totalWithdrawals: withdrawTotal[0]?.total || 0,
        netRevenue: (depositTotal[0]?.total || 0) - (withdrawTotal[0]?.total || 0),
        dailyDeposits: dailyEarnings,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// ⚙️ SETTINGS
// ══════════════════════════════════════════════════════════
router.get('/settings', auth, adminOnly, async (req, res) => {
  res.json({
    success: true,
    settings: {
      houseCommission: parseFloat(process.env.HOUSE_COMMISSION) || 0.10,
      usdtToInr:       parseFloat(process.env.USDT_TO_INR) || 80,
      trc20Address:    process.env.USDT_TRC20_ADDRESS || '',
      bep20Address:    process.env.USDT_BEP20_ADDRESS || '',
    },
  });
});

// ══════════════════════════════════════════════════════════
// 🔒 SECURITY — recent logins / suspicious activity
// ══════════════════════════════════════════════════════════
router.get('/security', auth, adminOnly, async (req, res) => {
  try {
    const [bannedUsers, recentUsers, bigWithdrawals] = await Promise.all([
      User.find({ isBanned: true }).select('username email banReason createdAt').limit(50),
      User.find().sort({ createdAt: -1 }).select('username email createdAt').limit(20),
      Transaction.find({ type: 'withdrawal', amount: { $gte: 10000 } })
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    res.json({
      success: true,
      security: {
        bannedUsers,
        recentSignups: recentUsers,
        largeWithdrawals: bigWithdrawals,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
