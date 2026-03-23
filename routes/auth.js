// const express     = require('express');
// const router      = express.Router();
// const jwt         = require('jsonwebtoken');
// const User        = require('../models/User');
// const Transaction = require('../models/Transaction');
// const auth        = require('../middleware/auth');

// // Helper: generate JWT
// const generateToken = (userId) =>
//   jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// // Helper: safe user object (no password)
// const sanitizeUser = (u) => ({
//   id:               u._id,
//   username:         u.username,
//   email:            u.email,
//   phone:            u.phone,
//   avatar:           u.avatar,
//   wallet:           u.wallet,
//   stats:            u.stats,
//   badges:           u.badges,
//   isPremium:        u.isPremium,
//   loginStreak:      u.loginStreak,
//   referralCode:     u.referralCode,
//   referralEarnings: u.referralEarnings,
//   createdAt:        u.createdAt,
// });

// // ══════════════════════════════════════════════════════════
// // POST /api/auth/register
// // ══════════════════════════════════════════════════════════
// router.post('/register', async (req, res) => {
//   try {
//     const { username, email, password, phone, referralCode } = req.body;

//     // Validation
//     if (!username || !email || !password || !phone) {
//       return res.status(400).json({ success: false, message: 'All fields are required' });
//     }
//     if (password.length < 6) {
//       return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
//     }

//     // Check duplicates
//     const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
//     if (existing) {
//       return res.status(400).json({
//         success: false,
//         message: existing.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken',
//       });
//     }

//     // Handle referral
//     let referrer = null;
//     if (referralCode) {
//       referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
//     }

//     // Create user (password hashed in pre-save hook)
//     const user = new User({
//       username, email, password, phone,
//       referredBy: referrer?.username || null,
//     });
//     await user.save();

//     // Referral bonuses
//     if (referrer) {
//       referrer.wallet.coins     += 200;
//       referrer.referralEarnings += 200;
//       await referrer.save();
//       user.wallet.coins += 200;   // bonus for new user
//       await user.save();
//     }

//     // Welcome bonus transaction record
//     await Transaction.create({
//       userId:        user._id,
//       type:          'bonus',
//       amount:        1000,
//       currency:      'coins',
//       status:        'completed',
//       description:   '🎉 Welcome bonus coins!',
//       balanceBefore: 0,
//       balanceAfter:  user.wallet.coins,
//     });

//     const token = generateToken(user._id);
//     res.status(201).json({
//       success: true,
//       message: 'Account created successfully! Welcome bonus: 1000 coins',
//       token,
//       user: sanitizeUser(user),
//     });
//   } catch (err) {
//     console.error('Register error:', err);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });

// // ══════════════════════════════════════════════════════════
// // POST /api/auth/login
// // ══════════════════════════════════════════════════════════
// router.post('/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({ success: false, message: 'Email and password are required' });
//     }

//     // Find user
//     const user = await User.findOne({ email: email.toLowerCase() });
//     if (!user) {
//       return res.status(400).json({ success: false, message: 'Invalid email or password' });
//     }

//     // Check password
//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) {
//       return res.status(400).json({ success: false, message: 'Invalid email or password' });
//     }

//     // Daily login bonus logic
//     const today     = new Date().toDateString();
//     const lastBonus = user.lastLoginBonus?.toDateString();
//     let loginBonusCoins = 0;

//     if (lastBonus !== today) {
//       const yesterday = new Date();
//       yesterday.setDate(yesterday.getDate() - 1);

//       // Check if streak continues (logged in yesterday)
//       if (lastBonus === yesterday.toDateString()) {
//         user.loginStreak += 1;
//       } else {
//         user.loginStreak = 1;
//       }

//       // Bonus scales with streak (50 base + 10 per streak day, max 200)
//       loginBonusCoins       = Math.min(50 + user.loginStreak * 10, 200);
//       user.wallet.coins    += loginBonusCoins;
//       user.lastLoginBonus   = new Date();
//       await user.save();
//     }

//     const token = generateToken(user._id);
//     res.json({
//       success:     true,
//       token,
//       loginBonus:  loginBonusCoins,
//       loginStreak: user.loginStreak,
//       user:        sanitizeUser(user),
//     });
//   } catch (err) {
//     console.error('Login error:', err);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });

// // ══════════════════════════════════════════════════════════
// // GET /api/auth/me  (protected)
// // ══════════════════════════════════════════════════════════
// router.get('/me', auth, async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id).select('-password');
//     res.json({ success: true, user });
//   } catch (err) {
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });

// // ══════════════════════════════════════════════════════════
// // PUT /api/auth/profile  (protected)
// // ══════════════════════════════════════════════════════════
// router.put('/profile', auth, async (req, res) => {
//   try {
//     const { avatar } = req.body;
//     const allowed    = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6'];

//     if (avatar && !allowed.includes(avatar)) {
//       return res.status(400).json({ success: false, message: 'Invalid avatar' });
//     }

//     const user = await User.findByIdAndUpdate(
//       req.user._id,
//       { ...(avatar && { avatar }) },
//       { new: true }
//     ).select('-password');

//     res.json({ success: true, user });
//   } catch (err) {
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });

// module.exports = router;







const express     = require('express');
const router      = express.Router();
const jwt         = require('jsonwebtoken');
const bcrypt      = require('bcryptjs');
const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const auth        = require('../middleware/auth');

// Helper: generate JWT
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Helper: safe user object
const sanitizeUser = (u) => ({
  id: u._id,
  username: u.username,
  email: u.email,
  phone: u.phone,
  avatar: u.avatar,
  wallet: u.wallet,
  stats: u.stats,
  badges: u.badges,
  isPremium: u.isPremium,
  loginStreak: u.loginStreak,
  referralCode: u.referralCode,
  referralEarnings: u.referralEarnings,
  createdAt: u.createdAt,
});


// ══════════════════════════════════════════════════════════
// POST /api/auth/register
// ══════════════════════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    console.log("BODY:", req.body);

    const { username, email, password, phone, referralCode } = req.body;

    // Validation
    if (!username || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check duplicate
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Referral
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
    }

    // 🔥 FIX: Hash password manually
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔥 FIX: ensure wallet exists
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      wallet: { coins: 1000 },
      referredBy: referrer?.username || null,
    });

    // Referral bonus
    if (referrer) {
      referrer.wallet = referrer.wallet || { coins: 0 };
      referrer.wallet.coins += 200;
      referrer.referralEarnings += 200;
      await referrer.save();

      user.wallet.coins += 200;
      await user.save();
    }

    // Transaction
    await Transaction.create({
      userId: user._id,
      type: 'bonus',
      amount: 1000,
      currency: 'coins',
      status: 'completed',
      description: '🎉 Welcome bonus coins!',
      balanceBefore: 0,
      balanceAfter: user.wallet.coins,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error('🔥 REGISTER ERROR:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


// ══════════════════════════════════════════════════════════
// POST /api/auth/login
// ══════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // 🔥 FIX: compare manually
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Daily login bonus
    const today = new Date().toDateString();
    const lastBonus = user.lastLoginBonus?.toDateString();
    let loginBonusCoins = 0;

    if (lastBonus !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastBonus === yesterday.toDateString()) {
        user.loginStreak += 1;
      } else {
        user.loginStreak = 1;
      }

      loginBonusCoins = Math.min(50 + user.loginStreak * 10, 200);

      user.wallet = user.wallet || { coins: 0 };
      user.wallet.coins += loginBonusCoins;
      user.lastLoginBonus = new Date();

      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      loginBonus: loginBonusCoins,
      loginStreak: user.loginStreak,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error('🔥 LOGIN ERROR:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


// ══════════════════════════════════════════════════════════
// GET /api/auth/me
// ══════════════════════════════════════════════════════════
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// ══════════════════════════════════════════════════════════
// PUT /api/auth/profile
// ══════════════════════════════════════════════════════════
router.put('/profile', auth, async (req, res) => {
  try {
    const { avatar } = req.body;

    const allowed = ['avatar1','avatar2','avatar3','avatar4','avatar5','avatar6'];

    if (avatar && !allowed.includes(avatar)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid avatar'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      user
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
