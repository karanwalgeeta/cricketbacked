
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not defined');
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authorization header provided'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ FIXED CHECK
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Account deactivated'
      });
    }

    req.user = user;
    req.userId = user._id;

    next();

  } catch (err) {
    console.error('Auth Error:', err);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};
