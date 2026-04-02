

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// 🔐 Generate JWT
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// 👤 Safe user response
const sanitizeUser = (u) => ({
  id: u._id,
  username: u.username,
  email: u.email,
  phone: u.phone,
  avatar: u.avatar,
  wallet: u.wallet,
  cryptoWallets: u.cryptoWallets,
  stats: u.stats,
  referralCode: u.referralCode,
  referralEarnings: u.referralEarnings,
  createdAt: u.createdAt,
   isAdmin: u.isAdmin, 
});


// ═══════════════════════════════════════════════
// 📝 REGISTER
// ═══════════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phone, referralCode } = req.body;

    if (!username || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Referral
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,

      wallet: {
        coins: 1000,
        realBalance: 0,
      },

      cryptoWallets: {
        TRC20: null,
        BEP20: null,
      },

      referralCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
      referredBy: referrer?.username || null,
    });

    // Referral bonus
    if (referrer) {
      referrer.wallet.coins += 200;
      await referrer.save();

      user.wallet.coins += 200;
      await user.save();
    }

    // Welcome transaction
    await Transaction.create({
      userId: user._id,
      type: 'bonus',
      amount: 1000,
      currency: 'coins',
      status: 'completed',
      description: 'Welcome bonus',
      balanceBefore: 0,
      balanceAfter: user.wallet.coins,
    });

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// ═══════════════════════════════════════════════
// 🔐 LOGIN
// ═══════════════════════════════════════════════
// router.post('/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email: email.toLowerCase() });
//     if (!user) {
//       return res.json({ success: false, message: 'Invalid credentials' });
//     }

//     const match = await bcrypt.compare(password, user.password);
//     if (!match) {
//       return res.json({ success: false, message: 'Invalid credentials' });
//     }

//     const token = generateToken(user._id);

//     res.json({
//       success: true,
//       token,
//       user: sanitizeUser(user),
//     });

//   } catch (err) {
//     res.status(500).json({ success: false });
//   }
// });





router.post('/login', async (req, res) => {
  try {
    console.log("LOGIN BODY:", req.body); // 🔥

    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    console.log("USER FOUND:", user); // 🔥

    if (!user) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    console.log("PASSWORD MATCH:", match); // 🔥

    if (!match) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err); // 🔥
    res.status(500).json({ success: false });
  }
});


// ═══════════════════════════════════════════════
// 👤 GET PROFILE
// ═══════════════════════════════════════════════
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: sanitizeUser(req.user),
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// ═══════════════════════════════════════════════
// ✏️ UPDATE PROFILE
// ═══════════════════════════════════════════════
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, phone, avatar } = req.body;

    const update = {};

    if (username) update.username = username;
    if (phone) update.phone = phone;
    if (avatar) update.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, update, {
      new: true
    });

    res.json({
      success: true,
      user: sanitizeUser(user),
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// ═══════════════════════════════════════════════
// 🔑 CHANGE PASSWORD
// ═══════════════════════════════════════════════
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.json({ success: false, message: 'Wrong password' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password updated' });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// ═══════════════════════════════════════════════
// 💼 ADD USER WALLET (TRC20 / BEP20)
// ═══════════════════════════════════════════════
router.post('/add-wallet', auth, async (req, res) => {
  try {
    const { address, network } = req.body;

    if (!address || !network) {
      return res.json({ success: false, message: 'Address & network required' });
    }

    if (!['TRC20', 'BEP20'].includes(network)) {
      return res.json({ success: false, message: 'Invalid network' });
    }

    const user = await User.findById(req.user._id);

    user.cryptoWallets[network] = address;
    await user.save();

    res.json({
      success: true,
      message: `${network} wallet saved`,
      wallets: user.cryptoWallets
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// ═══════════════════════════════════════════════
// 👁️ GET USER WALLETS
// ═══════════════════════════════════════════════
router.get('/wallets', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      wallets: req.user.cryptoWallets
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// ═══════════════════════════════════════════════
// 🚪 LOGOUT
// ═══════════════════════════════════════════════
router.post('/logout', auth, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out'
  });
});

module.exports = router;
