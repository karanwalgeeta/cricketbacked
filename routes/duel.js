

const express = require('express');
const router = express.Router();
const Duel = require('../models/Duel');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const COMMISSION = parseFloat(process.env.HOUSE_COMMISSION) || 0.10;

// ══════════════════════════════════════════════════════════
// POST /api/duel/create
// ══════════════════════════════════════════════════════════
router.post('/create', auth, async (req, res) => {
  try {
    const {
      matchId, matchName, stakeAmount, stakeType,
      duelType, predictionCategories, maxParticipants,
      isPrivate,
    } = req.body;

    if (!matchId) {
      return res.status(400).json({ success: false, message: 'Match ID is required' });
    }
    if (!stakeAmount || stakeAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid stake amount required' });
    }

    const user = await User.findById(req.user._id);

    // ✅ Balance check
    if (stakeType === 'coins' && user.wallet.coins < stakeAmount) {
      return res.status(400).json({ success: false, message: `Insufficient coins! You have ${user.wallet.coins} coins` });
    }
    if (stakeType === 'real' && user.wallet.realBalance < stakeAmount * 100) {
      return res.status(400).json({ success: false, message: 'Insufficient real balance' });
    }

    // Deduct stake
    const balanceBefore = stakeType === 'coins' ? user.wallet.coins : user.wallet.realBalance;
    if (stakeType === 'coins') user.wallet.coins -= stakeAmount;
    else user.wallet.realBalance -= stakeAmount * 100;
    user.wallet.totalSpent = (user.wallet.totalSpent || 0) + stakeAmount;
    await user.save();

    const roomCode = Duel.generateRoomCode();

    const duel = await Duel.create({
      roomCode,
      matchId,
      matchName,
      duelType: duelType || '1v1',
      stakeType: stakeType || 'coins',
      stakeAmount,
      maxParticipants: maxParticipants || 2,
      predictionCategories: predictionCategories || ['match_winner', 'top_batsman'],
      predictionDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
      createdBy: user._id,
      createdByUsername: user.username,
      isPrivate: isPrivate || false,
      participants: [{
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        stakeAmount,
        stakeType,
        isReady: false,
      }],
      totalPool: stakeAmount,
    });

    await Transaction.create({
      userId: user._id,
      type: 'duel_stake',
      amount: stakeAmount,
      currency: stakeType === 'coins' ? 'coins' : 'INR',
      status: 'completed',
      description: `Stake for duel ${roomCode}`,
      duelId: duel._id,
      balanceBefore,
      balanceAfter: stakeType === 'coins' ? user.wallet.coins : user.wallet.realBalance,
    });

    res.status(201).json({
      success: true,
      message: `Duel created! Room code: ${roomCode}`,
      duel: {
        id: duel._id,
        roomCode: duel.roomCode,
        matchId: duel.matchId,
        matchName: duel.matchName,
        status: duel.status,
        stakeType: duel.stakeType,
        stakeAmount: duel.stakeAmount,
        totalPool: duel.totalPool,
        predictionCategories: duel.predictionCategories,
        predictionDeadline: duel.predictionDeadline,
        maxParticipants: duel.maxParticipants,
        isPrivate: duel.isPrivate,
      },
    });

  } catch (err) {
    console.error('Create duel:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/duel/public
// ✅ Must be BEFORE /:roomCode
// ══════════════════════════════════════════════════════════
router.get('/public', auth, async (req, res) => {
  try {
    const publicDuels = await Duel.find({
      isPrivate: false,
      status: 'waiting',
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('roomCode matchName stakeType stakeAmount totalPool maxParticipants participants predictionCategories predictionDeadline createdByUsername status')
      .lean();

    const formattedDuels = publicDuels.map(duel => ({
      _id: duel._id,
      roomCode: duel.roomCode,
      matchName: duel.matchName,
      stakeType: duel.stakeType,
      stakeAmount: duel.stakeAmount,
      totalPool: duel.totalPool,
      maxParticipants: duel.maxParticipants,
      currentPlayers: duel.participants?.length || 0,
      participants: duel.participants?.map(p => ({
        username: p.username,
        userId: p.userId,
      })) || [],
      predictionCategories: duel.predictionCategories,
      predictionDeadline: duel.predictionDeadline,
      createdByUsername: duel.createdByUsername,
      status: duel.status,
    }));

    res.json({ success: true, duels: formattedDuels });

  } catch (err) {
    console.error('Get public duels:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/duel/my-duels
// ✅ Must be BEFORE /:roomCode
// ══════════════════════════════════════════════════════════
router.get('/my-duels', auth, async (req, res) => {
  try {
    const duels = await Duel.find({ 'participants.userId': req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    res.json({ success: true, duels });

  } catch (err) {
    console.error('My duels error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/duel/predict
// ✅ Must be BEFORE /:roomCode
// ══════════════════════════════════════════════════════════
router.post('/predict', auth, async (req, res) => {
  try {
    const { duelId, predictions } = req.body;

    if (!duelId || !predictions?.length) {
      return res.status(400).json({ success: false, message: 'duelId and predictions are required' });
    }

    const duel = await Duel.findById(duelId);
    if (!duel) return res.status(404).json({ success: false, message: 'Duel not found' });

    if (!['prediction_phase', 'active'].includes(duel.status)) {
      return res.status(400).json({ success: false, message: 'Predictions are not open right now' });
    }

    if (duel.predictionDeadline && new Date() > duel.predictionDeadline) {
      return res.status(400).json({ success: false, message: 'Prediction deadline has passed' });
    }

    const idx = duel.participants.findIndex(
      p => p.userId.toString() === req.user._id.toString()
    );
    if (idx === -1) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this duel' });
    }
    if (duel.participants[idx].isReady) {
      return res.status(400).json({ success: false, message: 'You have already submitted predictions' });
    }

    duel.participants[idx].predictions = predictions.map(p => ({
      userId: req.user._id,
      username: req.user.username,
      predictionType: p.type,
      predictedValue: p.value,
      confidence: p.confidence || 50,
    }));
    duel.participants[idx].isReady = true;

    if (duel.participants.every(p => p.isReady)) {
      duel.status = 'locked';
    }
    await duel.save();

    res.json({ success: true, message: 'Predictions submitted successfully!' });

  } catch (err) {
    console.error('Predict:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/duel/join
// ══════════════════════════════════════════════════════════
router.post('/join', auth, async (req, res) => {
  try {
    const { roomCode } = req.body;
    if (!roomCode) return res.status(400).json({ success: false, message: 'Room code required' });

    const user = await User.findById(req.user._id);
    const duel = await Duel.findOne({ roomCode: roomCode.toUpperCase() });

    if (!duel) return res.status(404).json({ success: false, message: 'Duel not found' });
    if (duel.status !== 'waiting') {
      return res.status(400).json({ success: false, message: 'Duel is not accepting new players' });
    }
    if (duel.participants.length >= duel.maxParticipants) {
      return res.status(400).json({ success: false, message: 'Duel is full' });
    }

    const alreadyIn = duel.participants.find(
      p => p.userId.toString() === user._id.toString()
    );
    if (alreadyIn) {
      return res.status(400).json({ success: false, message: 'You are already in this duel' });
    }

    const stakeAmount = duel.stakeAmount;
    const stakeType   = duel.stakeType;

    // ✅ Balance check
    if (stakeType === 'coins' && user.wallet.coins < stakeAmount) {
      return res.status(400).json({ success: false, message: `Insufficient coins! Need ${stakeAmount} coins` });
    }
    if (stakeType === 'real' && user.wallet.realBalance < stakeAmount * 100) {
      return res.status(400).json({ success: false, message: 'Insufficient real balance' });
    }

    // Deduct stake
    const balanceBefore = stakeType === 'coins' ? user.wallet.coins : user.wallet.realBalance;
    if (stakeType === 'coins') user.wallet.coins -= stakeAmount;
    else user.wallet.realBalance -= stakeAmount * 100;
    user.wallet.totalSpent = (user.wallet.totalSpent || 0) + stakeAmount;
    await user.save();

    duel.participants.push({
      userId: user._id,
      username: user.username,
      avatar: user.avatar,
      stakeAmount,
      stakeType,
      isReady: false,
    });
    duel.totalPool += stakeAmount;

    if (duel.participants.length >= duel.maxParticipants) {
      duel.status = 'prediction_phase';
    }
    await duel.save();

    await Transaction.create({
      userId: user._id,
      type: 'duel_stake',
      amount: stakeAmount,
      currency: stakeType === 'coins' ? 'coins' : 'INR',
      status: 'completed',
      description: `Joined duel ${roomCode}`,
      duelId: duel._id,
      balanceBefore,
      balanceAfter: stakeType === 'coins' ? user.wallet.coins : user.wallet.realBalance,
    });

    res.json({
      success: true,
      message: 'Joined duel successfully!',
      duel: {
        id: duel._id,
        roomCode: duel.roomCode,
        status: duel.status,
        totalPool: duel.totalPool,
        predictionCategories: duel.predictionCategories,
        predictionDeadline: duel.predictionDeadline,
        participants: duel.participants.map(p => ({
          username: p.username,
          avatar: p.avatar,
          isReady: p.isReady,
        })),
      },
    });

  } catch (err) {
    console.error('Join duel:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/duel/result  ⚠️ Admin/system only
// ══════════════════════════════════════════════════════════
router.post('/result', auth, async (req, res) => {
  try {
    const { duelId, correctAnswers } = req.body;

    // ✅ Only admin can trigger result
    const callerUser = await User.findById(req.user._id);
    if (!callerUser?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const duel = await Duel.findById(duelId);
    if (!duel) return res.status(404).json({ success: false, message: 'Duel not found' });
    if (duel.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Duel already completed' });
    }

    // Score each participant
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
      if (score > highestScore) {
        highestScore = score;
        winners = [participant];
      } else if (score === highestScore) {
        winners.push(participant);
      }
    }

    // ✅ Prize calculation
    const commission    = Math.floor(duel.totalPool * COMMISSION);
    const prizePool     = duel.totalPool - commission;
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

    // Pay winners
    for (const winner of winners) {
      const winnerUser = await User.findById(winner.userId);
      if (!winnerUser) continue;

      const before = duel.stakeType === 'coins'
        ? winnerUser.wallet.coins
        : winnerUser.wallet.realBalance;

      if (duel.stakeType === 'coins') winnerUser.wallet.coins += prizePerWinner;
      else winnerUser.wallet.realBalance += prizePerWinner * 100; // ✅ *100 fix

      winnerUser.wallet.totalEarned   = (winnerUser.wallet.totalEarned   || 0) + prizePerWinner;
      winnerUser.stats.duelsWon       = (winnerUser.stats.duelsWon       || 0) + 1;
      winnerUser.stats.winStreak      = (winnerUser.stats.winStreak      || 0) + 1;
      winnerUser.stats.maxWinStreak   = Math.max(
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

    // ✅ Update ALL participants stats (winners + losers)
    for (const participant of duel.participants) {
      const isWinner = winners.some(
        w => w.userId.toString() === participant.userId.toString()
      );
      const pUser = await User.findById(participant.userId);
      if (!pUser) continue;

      pUser.stats.duelsPlayed       = (pUser.stats.duelsPlayed       || 0) + 1;
      pUser.stats.totalPredictions  = (pUser.stats.totalPredictions  || 0) + participant.predictions.length;
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
      message: 'Duel result processed!',
      result: {
        winners: winners.map(w => ({ username: w.username, score: w.score })),
        prizePerWinner,
        commission,
        participants: duel.participants.map(p => ({
          username: p.username,
          score: p.score,
          predictions: p.predictions,
        })),
      },
    });

  } catch (err) {
    console.error('Result:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/duel/:roomCode  ← LAST (dynamic param)
// ══════════════════════════════════════════════════════════
router.get('/:roomCode', auth, async (req, res) => {
  try {
    const duel = await Duel.findOne({ roomCode: req.params.roomCode.toUpperCase() });
    if (!duel) return res.status(404).json({ success: false, message: 'Duel not found' });
    res.json({ success: true, duel });
  } catch (err) {
    console.error('Get duel error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
