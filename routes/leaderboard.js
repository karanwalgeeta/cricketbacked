const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const auth    = require('../middleware/auth');

// ══════════════════════════════════════════════════════════
// GET /api/leaderboard?type=earnings|wins|accuracy
// ══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { type = 'earnings' } = req.query;

    const sortMap = {
      earnings: 'wallet.totalEarned',
      wins:     'stats.duelsWon',
      accuracy: 'stats.correctPredictions',
    };

    const sortField = sortMap[type] || 'wallet.totalEarned';

    const users = await User.find({ isActive: true })
      .select('username avatar stats wallet badges isPremium')
      .sort({ [sortField]: -1 })
      .limit(50);

    const leaderboard = users.map((u, i) => ({
      rank:      i + 1,
      username:  u.username,
      avatar:    u.avatar,
      isPremium: u.isPremium,
      badges:    u.badges,
      stats: {
        duelsWon:           u.stats.duelsWon,
        duelsPlayed:        u.stats.duelsPlayed,
        winRate:            u.stats.duelsPlayed > 0
                              ? Math.round((u.stats.duelsWon / u.stats.duelsPlayed) * 100)
                              : 0,
        totalEarned:        u.wallet.totalEarned,
        winStreak:          u.stats.winStreak,
        maxWinStreak:       u.stats.maxWinStreak,
        correctPredictions: u.stats.correctPredictions,
        totalPredictions:   u.stats.totalPredictions,
      },
    }));

    res.json({ success: true, leaderboard, type });
  } catch (err) {
    console.error('Leaderboard:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/leaderboard/me  — caller's rank
// ══════════════════════════════════════════════════════════
router.get('/me', auth, async (req, res) => {
  try {
    const allUsers = await User.find({ isActive: true })
      .select('_id wallet.totalEarned')
      .sort({ 'wallet.totalEarned': -1 });

    const rank = allUsers.findIndex(u => u._id.toString() === req.user._id.toString()) + 1;

    res.json({ success: true, rank, total: allUsers.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
