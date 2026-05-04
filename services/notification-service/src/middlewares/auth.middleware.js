const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Internal service calls (no JWT — use shared secret)
const authenticateInternal = (req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized internal call' });
  }
  next();
};

module.exports = { authenticate, authenticateInternal };