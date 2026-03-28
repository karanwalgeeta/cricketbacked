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







// const express     = require('express');
// const router      = express.Router();
// const jwt         = require('jsonwebtoken');
// const bcrypt      = require('bcryptjs');
// const User        = require('../models/User');
// const Transaction = require('../models/Transaction');
// const auth        = require('../middleware/auth');

// // Helper: generate JWT
// const generateToken = (userId) =>
//   jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// // Helper: safe user object
// const sanitizeUser = (u) => ({
//   id: u._id,
//   username: u.username,
//   email: u.email,
//   phone: u.phone,
//   avatar: u.avatar,
//   wallet: u.wallet,
//   stats: u.stats,
//   badges: u.badges,
//   isPremium: u.isPremium,
//   loginStreak: u.loginStreak,
//   referralCode: u.referralCode,
//   referralEarnings: u.referralEarnings,
//   createdAt: u.createdAt,
// });


// // ══════════════════════════════════════════════════════════
// // POST /api/auth/register
// // ══════════════════════════════════════════════════════════
// router.post('/register', async (req, res) => {
//   try {
//     console.log("BODY:", req.body);

//     const { username, email, password, phone, referralCode } = req.body;

//     // Validation
//     if (!username || !email || !password || !phone) {
//       return res.status(400).json({
//         success: false,
//         message: 'All fields are required'
//       });
//     }

//     if (password.length < 6) {
//       return res.status(400).json({
//         success: false,
//         message: 'Password must be at least 6 characters'
//       });
//     }

//     // Check duplicate
//     const existing = await User.findOne({
//       $or: [{ email: email.toLowerCase() }, { username }]
//     });

//     if (existing) {
//       return res.status(400).json({
//         success: false,
//         message: 'User already exists'
//       });
//     }

//     // Referral
//     let referrer = null;
//     if (referralCode) {
//       referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
//     }

//     // 🔥 FIX: Hash password manually
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // 🔥 FIX: ensure wallet exists
//     const user = await User.create({
//       username,
//       email: email.toLowerCase(),
//       password: hashedPassword,
//       phone,
//       wallet: { coins: 1000 },
//       referredBy: referrer?.username || null,
//     });

//     // Referral bonus
//     if (referrer) {
//       referrer.wallet = referrer.wallet || { coins: 0 };
//       referrer.wallet.coins += 200;
//       referrer.referralEarnings += 200;
//       await referrer.save();

//       user.wallet.coins += 200;
//       await user.save();
//     }

//     // Transaction
//     await Transaction.create({
//       userId: user._id,
//       type: 'bonus',
//       amount: 1000,
//       currency: 'coins',
//       status: 'completed',
//       description: '🎉 Welcome bonus coins!',
//       balanceBefore: 0,
//       balanceAfter: user.wallet.coins,
//     });

//     const token = generateToken(user._id);

//     res.status(201).json({
//       success: true,
//       message: 'Account created successfully!',
//       token,
//       user: sanitizeUser(user),
//     });

//   } catch (err) {
//     console.error('🔥 REGISTER ERROR:', err);
//     res.status(500).json({
//       success: false,
//       message: err.message
//     });
//   }
// });


// // ══════════════════════════════════════════════════════════
// // POST /api/auth/login
// // ══════════════════════════════════════════════════════════
// router.post('/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: 'Email and password required'
//       });
//     }

//     const user = await User.findOne({ email: email.toLowerCase() });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid credentials'
//       });
//     }

//     // 🔥 FIX: compare manually
//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid credentials'
//       });
//     }

//     // Daily login bonus
//     const today = new Date().toDateString();
//     const lastBonus = user.lastLoginBonus?.toDateString();
//     let loginBonusCoins = 0;

//     if (lastBonus !== today) {
//       const yesterday = new Date();
//       yesterday.setDate(yesterday.getDate() - 1);

//       if (lastBonus === yesterday.toDateString()) {
//         user.loginStreak += 1;
//       } else {
//         user.loginStreak = 1;
//       }

//       loginBonusCoins = Math.min(50 + user.loginStreak * 10, 200);

//       user.wallet = user.wallet || { coins: 0 };
//       user.wallet.coins += loginBonusCoins;
//       user.lastLoginBonus = new Date();

//       await user.save();
//     }

//     const token = generateToken(user._id);

//     res.json({
//       success: true,
//       token,
//       loginBonus: loginBonusCoins,
//       loginStreak: user.loginStreak,
//       user: sanitizeUser(user),
//     });

//   } catch (err) {
//     console.error('🔥 LOGIN ERROR:', err);
//     res.status(500).json({
//       success: false,
//       message: err.message
//     });
//   }
// });


// // ══════════════════════════════════════════════════════════
// // GET /api/auth/me
// // ══════════════════════════════════════════════════════════
// router.get('/me', auth, async (req, res) => {
//   try {
//     res.json({
//       success: true,
//       user: req.user
//     });
//   } catch (err) {
//     res.status(500).json({ success: false });
//   }
// });


// // ══════════════════════════════════════════════════════════
// // PUT /api/auth/profile
// // ══════════════════════════════════════════════════════════
// router.put('/profile', auth, async (req, res) => {
//   try {
//     const { avatar } = req.body;

//     const allowed = ['avatar1','avatar2','avatar3','avatar4','avatar5','avatar6'];

//     if (avatar && !allowed.includes(avatar)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid avatar'
//       });
//     }

//     const user = await User.findByIdAndUpdate(
//       req.user._id,
//       { avatar },
//       { new: true }
//     ).select('-password');

//     res.json({
//       success: true,
//       user
//     });

//   } catch (err) {
//     res.status(500).json({ success: false });
//   }
// });

// module.exports = router;












// const express = require('express');
// const router = express.Router();
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
// const User = require('../models/User');
// const Transaction = require('../models/Transaction');
// const auth = require('../middleware/auth');

// // Helper: generate JWT
// const generateToken = (userId) =>
//   jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// // Helper: safe user object
// const sanitizeUser = (u) => ({
//   id: u._id,
//   username: u.username,
//   email: u.email,
//   phone: u.phone,
//   avatar: u.avatar || 'avatar1',
//   wallet: u.wallet || { coins: 1000 },
//   stats: u.stats || { matchesPlayed: 0, matchesWon: 0, totalPoints: 0 },
//   badges: u.badges || [],
//   isPremium: u.isPremium || false,
//   loginStreak: u.loginStreak || 0,
//   referralCode: u.referralCode,
//   referralEarnings: u.referralEarnings || 0,
//   createdAt: u.createdAt,
// });

// // ══════════════════════════════════════════════════════════
// // POST /api/auth/register
// // ══════════════════════════════════════════════════════════
// router.post('/register', async (req, res) => {
//   try {
//     console.log("📝 Registration request received:", { 
//       ...req.body, 
//       password: '[HIDDEN]' 
//     });

//     const { username, email, password, phone, referralCode } = req.body;

//     // Validation
//     if (!username || !email || !password || !phone) {
//       return res.status(400).json({
//         success: false,
//         message: 'All fields are required'
//       });
//     }

//     if (password.length < 6) {
//       return res.status(400).json({
//         success: false,
//         message: 'Password must be at least 6 characters'
//       });
//     }

//     // Check duplicate
//     const existing = await User.findOne({
//       $or: [{ email: email.toLowerCase() }, { username }]
//     });

//     if (existing) {
//       return res.status(400).json({
//         success: false,
//         message: 'User already exists with this email or username'
//       });
//     }

//     // Referral
//     let referrer = null;
//     if (referralCode) {
//       referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
//       if (referrer) {
//         console.log(`✅ Referral found: ${referrer.username}`);
//       }
//     }

//     // Generate unique referral code for new user
//     const generateReferralCode = () => {
//       const prefix = username.slice(0, 3).toUpperCase();
//       const random = Math.random().toString(36).substring(2, 8).toUpperCase();
//       return `${prefix}${random}`;
//     };

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);
//     console.log("✅ Password hashed successfully");

//     // Create user
//     const user = await User.create({
//       username,
//       email: email.toLowerCase(),
//       password: hashedPassword,
//       phone,
//       wallet: { coins: 1000 },
//       referralCode: generateReferralCode(),
//       referredBy: referrer?.username || null,
//       avatar: 'avatar1',
//       stats: {
//         matchesPlayed: 0,
//         matchesWon: 0,
//         totalPoints: 0
//       },
//       badges: [],
//       isPremium: false,
//       loginStreak: 0,
//       referralEarnings: 0
//     });

//     console.log(`✅ User created: ${user.username} (ID: ${user._id})`);

//     // Referral bonus
//     if (referrer) {
//       referrer.wallet = referrer.wallet || { coins: 0 };
//       referrer.wallet.coins += 200;
//       referrer.referralEarnings = (referrer.referralEarnings || 0) + 200;
//       await referrer.save();

//       user.wallet.coins += 200;
//       await user.save();

//       console.log(`🎁 Referral bonus given: ${referrer.username} +200 coins`);
//     }

//     // Transaction record for welcome bonus
//     await Transaction.create({
//       userId: user._id,
//       type: 'bonus',
//       amount: 1000,
//       currency: 'coins',
//       status: 'completed',
//       description: '🎉 Welcome bonus coins!',
//       balanceBefore: 0,
//       balanceAfter: user.wallet.coins,
//     });

//     const token = generateToken(user._id);
//     console.log(`🎫 Token generated for user: ${user.username}`);

//     res.status(201).json({
//       success: true,
//       message: 'Account created successfully!',
//       token,
//       user: sanitizeUser(user),
//     });

//   } catch (err) {
//     console.error('🔥 REGISTER ERROR:', err);
//     res.status(500).json({
//       success: false,
//       message: err.message || 'Registration failed. Please try again.'
//     });
//   }
// });

// // ══════════════════════════════════════════════════════════
// // POST /api/auth/login
// // ══════════════════════════════════════════════════════════
// router.post('/login', async (req, res) => {
//   try {
//     console.log("🔐 Login request received for:", req.body.email);

//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: 'Email and password are required'
//       });
//     }

//     // Find user
//     const user = await User.findOne({ email: email.toLowerCase() });

//     if (!user) {
//       console.log(`❌ User not found: ${email}`);
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid email or password'
//       });
//     }

//     console.log(`✅ User found: ${user.username}`);

//     // Debug: Check password format
//     console.log('🔍 Password debugging:');
//     console.log('- Stored password hash length:', user.password?.length);
//     console.log('- Is bcrypt hash:', user.password?.startsWith('$2a$') || user.password?.startsWith('$2b$'));
    
//     // Verify password
//     let isMatch = false;
//     try {
//       isMatch = await bcrypt.compare(password, user.password);
//       console.log('- Password match result:', isMatch);
//     } catch (compareErr) {
//       console.error('❌ Error comparing passwords:', compareErr);
//       return res.status(500).json({
//         success: false,
//         message: 'Error verifying credentials'
//       });
//     }

//     if (!isMatch) {
//       console.log(`❌ Invalid password for user: ${user.username}`);
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid email or password'
//       });
//     }

//     console.log(`✅ Password verified for: ${user.username}`);

//     // Daily login bonus
//     const today = new Date().toDateString();
//     const lastBonus = user.lastLoginBonus?.toDateString();
//     let loginBonusCoins = 0;

//     if (lastBonus !== today) {
//       const yesterday = new Date();
//       yesterday.setDate(yesterday.getDate() - 1);

//       // Update streak
//       if (lastBonus === yesterday.toDateString()) {
//         user.loginStreak = (user.loginStreak || 0) + 1;
//       } else {
//         user.loginStreak = 1;
//       }

//       // Calculate bonus (min 50, max 200)
//       loginBonusCoins = Math.min(50 + (user.loginStreak * 10), 200);

//       // Add bonus to wallet
//       user.wallet = user.wallet || { coins: 0 };
//       user.wallet.coins += loginBonusCoins;
//       user.lastLoginBonus = new Date();

//       await user.save();
      
//       console.log(`🎁 Login bonus: +${loginBonusCoins} coins (Streak: ${user.loginStreak})`);

//       // Create transaction record for login bonus
//       await Transaction.create({
//         userId: user._id,
//         type: 'bonus',
//         amount: loginBonusCoins,
//         currency: 'coins',
//         status: 'completed',
//         description: `Daily login bonus - ${user.loginStreak} day streak!`,
//         balanceBefore: user.wallet.coins - loginBonusCoins,
//         balanceAfter: user.wallet.coins,
//       });
//     } else {
//       console.log(`ℹ️ Already claimed login bonus today`);
//     }

//     // Generate token
//     const token = generateToken(user._id);
//     console.log(`🎫 Login successful for: ${user.username}`);

//     res.json({
//       success: true,
//       message: 'Login successful!',
//       token,
//       loginBonus: loginBonusCoins,
//       loginStreak: user.loginStreak || 0,
//       user: sanitizeUser(user),
//     });

//   } catch (err) {
//     console.error('🔥 LOGIN ERROR:', err);
//     res.status(500).json({
//       success: false,
//       message: err.message || 'Login failed. Please try again.'
//     });
//   }
// });

// // ══════════════════════════════════════════════════════════
// // POST /api/auth/logout
// // ══════════════════════════════════════════════════════════
// router.post('/logout', auth, async (req, res) => {
//   try {
//     // Client-side token removal
//     res.json({
//       success: true,
//       message: 'Logged out successfully'
//     });
//   } catch (err) {
//     console.error('🔥 LOGOUT ERROR:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Logout failed'
//     });
//   }
// });

// // ══════════════════════════════════════════════════════════
// // GET /api/auth/me
// // ══════════════════════════════════════════════════════════
// router.get('/me', auth, async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id).select('-password');
    
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     res.json({
//       success: true,
//       user: sanitizeUser(user)
//     });
//   } catch (err) {
//     console.error('🔥 ME ERROR:', err);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Failed to fetch user data' 
//     });
//   }
// });

// // ══════════════════════════════════════════════════════════
// // PUT /api/auth/profile
// // ══════════════════════════════════════════════════════════
// router.put('/profile', auth, async (req, res) => {
//   try {
//     const { avatar, username, phone } = req.body;
    
//     const updateData = {};
    
//     // Update avatar if provided
//     const allowedAvatars = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6'];
//     if (avatar && allowedAvatars.includes(avatar)) {
//       updateData.avatar = avatar;
//     }
    
//     // Update username if provided
//     if (username && username !== req.user.username) {
//       const existingUser = await User.findOne({ username });
//       if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
//         return res.status(400).json({
//           success: false,
//           message: 'Username already taken'
//         });
//       }
//       updateData.username = username;
//     }
    
//     // Update phone if provided
//     if (phone) {
//       updateData.phone = phone;
//     }

//     if (Object.keys(updateData).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No valid fields to update'
//       });
//     }

//     const user = await User.findByIdAndUpdate(
//       req.user._id,
//       updateData,
//       { new: true, runValidators: true }
//     ).select('-password');

//     res.json({
//       success: true,
//       message: 'Profile updated successfully',
//       user: sanitizeUser(user)
//     });

//   } catch (err) {
//     console.error('🔥 PROFILE UPDATE ERROR:', err);
//     res.status(500).json({ 
//       success: false, 
//       message: err.message || 'Failed to update profile' 
//     });
//   }
// });

// // ══════════════════════════════════════════════════════════
// // POST /api/auth/change-password
// // ══════════════════════════════════════════════════════════
// router.post('/change-password', auth, async (req, res) => {
//   try {
//     const { currentPassword, newPassword } = req.body;

//     if (!currentPassword || !newPassword) {
//       return res.status(400).json({
//         success: false,
//         message: 'Current password and new password are required'
//       });
//     }

//     if (newPassword.length < 6) {
//       return res.status(400).json({
//         success: false,
//         message: 'New password must be at least 6 characters'
//       });
//     }

//     const user = await User.findById(req.user._id);

//     // Verify current password
//     const isMatch = await bcrypt.compare(currentPassword, user.password);
//     if (!isMatch) {
//       return res.status(401).json({
//         success: false,
//         message: 'Current password is incorrect'
//       });
//     }

//     // Hash and update new password
//     const hashedPassword = await bcrypt.hash(newPassword, 10);
//     user.password = hashedPassword;
//     await user.save();

//     res.json({
//       success: true,
//       message: 'Password changed successfully'
//     });

//   } catch (err) {
//     console.error('🔥 CHANGE PASSWORD ERROR:', err);
//     res.status(500).json({
//       success: false,
//       message: err.message || 'Failed to change password'
//     });
//   }
// });

// module.exports = router;











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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
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
