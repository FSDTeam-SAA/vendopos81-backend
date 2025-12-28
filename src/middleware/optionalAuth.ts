
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '../config';

export const optionalAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      req.user = jwt.verify(token, config.JWT_SECRET as string);
    } catch (e) { /* invalid token? proceed as guest */ }
  }
  next();
};