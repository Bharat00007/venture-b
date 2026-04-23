import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export function verifyToken(requiredRoles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      if (
        requiredRoles.length &&
        (!req.user.role || !requiredRoles.includes(req.user.role))
      ) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}