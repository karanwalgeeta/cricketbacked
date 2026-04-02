
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // 🔍 Debug logging
    console.log('🔐 Auth middleware - Headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      contentType: req.headers['content-type']
    });

    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).json({
        success: false,
        message: 'No authorization header provided'
      });
    }

    // Check if Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Invalid token format - missing Bearer prefix');
      return res.status(401).json({
        success: false,
        message: 'Invalid token format. Use: Bearer <token>'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token || token === 'null' || token === 'undefined') {
      console.log('❌ Empty or invalid token');
      return res.status(401).json({
        success: false,
        message: 'Invalid token provided'
      });
    }

    console.log('✅ Token received, length:', token.length);

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified, userId:', decoded.userId);
    } catch (jwtError) {
      console.error('❌ JWT Verification failed:', jwtError.name, jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please login again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.',
          code: 'INVALID_TOKEN'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      console.log('❌ User not found in database:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Optional: Check if user is active/banned
    if (user.isBanned === true) {
      console.log('❌ User is banned:', user.username);
      return res.status(403).json({
        success: false,
        message: 'Account has been suspended'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id; // Additional convenience field
    
    console.log('✅ Auth successful for:', user.username, '(ID:', user._id, ')');
    
    next();

  } catch (err) {
    console.error('🔥 AUTH MIDDLEWARE ERROR:', err);
    
    // Generic error response
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
      code: 'SERVER_ERROR'
    });
  }
};

