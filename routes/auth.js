
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');

const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const auth        = require('../middleware/auth');

// ── Generate JWT ───────────────────────────────────────────
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ── Safe user response ─────────────────────────────────────
const sanitizeUser = (u) => ({
  id:               u._id,
  username:         u.username,
  email:            u.email,
  phone:            u.phone,
  avatar:           u.avatar,
  isAdmin:          u.isAdmin,
  isBanned:         u.isBanned,
  isPremium:        u.isPremium,
  wallet:           u.wallet,
  cryptoWallets:    u.cryptoWallets,
  stats:            u.stats,
  badges:           u.badges,
  referralCode:     u.referralCode,
  referralEarnings: u.referralEarnings,
  createdAt:        u.createdAt,
});

// ══════════════════════════════════════════════════════════
// 📝 REGISTER
// ══════════════════════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phone, referralCode } = req.body;

    if (!username || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Referral check
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
    }

    // ✅ Plain password do — User.js pre-save hook hash karega
    // ❌ Yahan bcrypt.hash mat karo — double hashing hoga
    const user = await User.create({
      username,
      email:    email.toLowerCase().trim(),
      password,                              // ← plain password
      phone,
      wallet: {
        coins:       referrer ? 1200 : 1000, // referral bonus
        realBalance: 0,
      },
      cryptoWallets: {
        trc20: '',   // ← lowercase, matches User model
        bep20: '',
      },
      referredBy: referrer?.username || null,
    });

    // Referral bonus to referrer
    if (referrer) {
      referrer.wallet.coins += 200;
      await referrer.save();

      await Transaction.create({
        userId:      referrer._id,
        type:        'referral',
        amount:      200,
        currency:    'coins',
        status:      'completed',
        description: `Referral bonus — ${username} joined`,
        balanceBefore: referrer.wallet.coins - 200,
        balanceAfter:  referrer.wallet.coins,
      });
    }

    // Welcome transaction
    await Transaction.create({
      userId:      user._id,
      type:        'bonus',
      amount:      1000,
      currency:    'coins',
      status:      'completed',
      description: 'Welcome bonus 🎉',
      balanceBefore: 0,
      balanceAfter:  user.wallet.coins,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// ══════════════════════════════════════════════════════════
// 🔐 LOGIN
// ══════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: `Account suspended: ${user.banReason || 'Contact support'}` });
    }

    // ✅ comparePassword method use karo (User model mein defined hai)
    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ══════════════════════════════════════════════════════════
// 👤 GET PROFILE  — /api/auth/me
// ══════════════════════════════════════════════════════════
router.get('/me', auth, async (req, res) => {
  try {
    // req.user already set by auth middleware
    res.json({
      success: true,
      user: sanitizeUser(req.user),
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// ✏️ UPDATE PROFILE
// ══════════════════════════════════════════════════════════
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, phone, avatar } = req.body;
    const update = {};
    if (username) update.username = username;
    if (phone)    update.phone    = phone;
    if (avatar)   update.avatar   = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// 🔑 CHANGE PASSWORD
// ══════════════════════════════════════════════════════════
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user  = await User.findById(req.user._id);
    const match = await user.comparePassword(currentPassword);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Wrong current password' });
    }

    // ✅ Plain password assign karo — pre-save hook hash karega
    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// 💼 ADD / UPDATE CRYPTO WALLET
// ══════════════════════════════════════════════════════════
router.post('/add-wallet', auth, async (req, res) => {
  try {
    const { address, network } = req.body;

    if (!address || !network) {
      return res.status(400).json({ success: false, message: 'Address & network required' });
    }
    if (!['TRC20', 'BEP20'].includes(network)) {
      return res.status(400).json({ success: false, message: 'Invalid network' });
    }

    const user = await User.findById(req.user._id);

    // ✅ lowercase keys — matches User model (trc20/bep20)
    const key = network === 'TRC20' ? 'trc20' : 'bep20';
    user.cryptoWallets[key] = address;
    await user.save();

    res.json({
      success: true,
      message: `${network} wallet saved`,
      wallets: user.cryptoWallets,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// 👁️ GET USER WALLETS
// ══════════════════════════════════════════════════════════
router.get('/wallets', auth, async (req, res) => {
  try {
    res.json({ success: true, wallets: req.user.cryptoWallets });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ══════════════════════════════════════════════════════════
// 🚪 LOGOUT
// ══════════════════════════════════════════════════════════
router.post('/logout', auth, (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
