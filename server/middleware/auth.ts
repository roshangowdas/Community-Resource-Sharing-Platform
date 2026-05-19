import { adminAuth as firebaseAdminAuth } from '../lib/firebaseAdmin';
import { User } from '../models/User';
import mongoose from 'mongoose';

export const auth = async (req: any, res: any, next: any) => {
  let token = '';
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header found' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid authorization format. Expected "Bearer <token>"' });
    }

    token = authHeader.replace('Bearer ', '').trim();
    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({ error: 'Empty or invalid token received' });
    }
    
    let decodedToken;
    try {
      if (!firebaseAdminAuth) {
        throw new Error('AUTH_NOT_CONFIGURED');
      }
      decodedToken = await firebaseAdminAuth.verifyIdToken(token);
    } catch (verifyErr: any) {
      if (verifyErr.message === 'AUTH_NOT_CONFIGURED') {
        return res.status(503).json({ 
          error: 'Authentication system is not configured.',
          message: 'The Firebase API key is missing or invalid. Please configure Firebase in the Settings menu.'
        });
      }
      console.error('[Auth] Token Verification Failed:', verifyErr.message);
      throw verifyErr;
    }
    
    // Find or create user in MongoDB based on Firebase UID
    let user = null;
    
    // If DB is connecting, wait a bit
    if (mongoose.connection.readyState === 2) {
      console.log('[Auth] Database is connecting, waiting...');
      let attempts = 0;
      while (mongoose.connection.readyState === 2 && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findOne({ firebaseUid: decodedToken.uid }).maxTimeMS(5000);
        if (!user) {
          user = await User.findOne({ email: decodedToken.email }).maxTimeMS(5000);
          if (user) {
            user.firebaseUid = decodedToken.uid;
            if (decodedToken.name && !user.name) user.name = decodedToken.name;
            if (decodedToken.picture && !user.avatar) user.avatar = decodedToken.picture;
            await user.save();
          } else {
            // New user registration during first auth
            user = new User({
              firebaseUid: decodedToken.uid,
              email: decodedToken.email || `user_${decodedToken.uid}@temporary.com`,
              name: decodedToken.name || 'Neighbor',
              avatar: decodedToken.picture
            });
            await user.save();
          }
        }
      } catch (dbErr: any) {
        console.error('[Auth] MongoDB User Sync Error:', dbErr.message);
        // We continue even if DB lookup fails, using token info as fallback
      }
    } else {
      console.warn(`[Auth] Database not ready (State: ${mongoose.connection.readyState}). Falling back to temporary profile.`);
    }
    
    // Safety check for userId - if DB was down, this will be the firebaseUid string
    const userId = user ? user._id.toString() : decodedToken.uid;
    const isMongoId = mongoose.Types.ObjectId.isValid(userId);
    
    req.user = {
      userId,
      isMongoId,
      firebaseUid: decodedToken.uid,
      isAdmin: user?.isAdmin || false,
      email: decodedToken.email,
      name: user?.name || decodedToken.name || 'Neighbor',
      avatar: user?.avatar || decodedToken.picture,
      isTemporary: !user
    };
    next();
  } catch (err: any) {
    console.error('Auth Middleware Error:', err);
    console.error('Token starting chars:', token?.substring(0, 10));
    console.error('Token length:', token?.length);
    
    // Provide more specific error messages for local debugging
    let message = 'Token is not valid';
    if (err.code === 'auth/id-token-expired') {
      message = 'Token has expired. Please log in again.';
    } else if (err.code === 'auth/argument-error') {
      message = 'Invalid token received. Check if you are properly authenticated.';
    } else if (err.name === 'MongooseError' || err.name === 'MongoNetworkError') {
      message = 'Database connection failure. Check if MONGODB_URI is set and your network allows connection to MongoDB.';
    }

    res.status(401).json({ 
      error: message,
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
};

export const requireMongoUser = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  // If we have a proper Mongo record, proceed
  if (req.user.isMongoId && !req.user.isTemporary) {
    return next();
  }

  const isDbOffline = mongoose.connection.readyState !== 1;
  
  // For GET requests, if the DB is offline, we allow the request to proceed.
  // The route handlers themselves should check for state !== 1 and return empty sets.
  // This avoids 403 errors in the frontend during synchronization.
  if (req.method === 'GET' && isDbOffline) {
    return next();
  }

  let message = 'Your account is being synchronized. Please try again in a few seconds.';
  if (isDbOffline) {
    message = 'The neural link to the database is currently offline. Please wait for reconnection.';
  }

  return res.status(403).json({ 
    error: 'User record required', 
    message,
    isSyncing: !isDbOffline,
    isDbOffline
  });
};

export const optionalAuth = async (req: any, res: any, next: any) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return next();
  
  try {
    if (!firebaseAdminAuth) return next();
    const decodedToken = await firebaseAdminAuth.verifyIdToken(token);
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (user) {
      req.user = {
        userId: user._id.toString(),
        firebaseUid: decodedToken.uid,
        isAdmin: user.isAdmin,
        email: decodedToken.email
      };
    }
    next();
  } catch (err) {
    next(); // Continue without user if token is invalid or expired
  }
};

export const adminAuth = (req: any, res: any, next: any) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};
