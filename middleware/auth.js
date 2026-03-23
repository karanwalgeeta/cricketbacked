// const jwt  = require('jsonwebtoken');
// const User = require('../models/User');

// /**
//  * JWT Auth Middleware
//  * Usage: router.get('/protected', auth, handler)
//  */
// module.exports = async (req, res, next) => {
//   try {
//     // Extract token from Authorization header
//     const authHeader = req.headers.authorization;
//     const token      = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

//     if (!token) {
//       return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
//     }

//     // Verify token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // Find user
//     const user = await User.findById(decoded.userId).select('-password');
//     if (!user || !user.isActive) {
//       return res.status(401).json({ success: false, message: 'User not found or account disabled.' });
//     }

//     req.user = user;
//     next();
//   } catch (err) {
//     if (err.name === 'TokenExpiredError') {
//       return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
//     }
//     return res.status(401).json({ success: false, message: 'Invalid token.' });
//   }
// };






const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    req.user = user;
    next();

  } catch (err) {
    console.error("AUTH ERROR:", err);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};
