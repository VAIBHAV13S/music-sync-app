import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User, IUser, IUserPublic } from './models/User';
import { RefreshToken } from './models/RefreshToken';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';

// Enhanced password validation
const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  if (/\s/.test(password)) {
    errors.push('Password cannot contain spaces');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Enhanced username validation
const validateUsername = (username: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!username || username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  if (username.length > 20) {
    errors.push('Username must be less than 20 characters');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, hyphens, and underscores');
  }
  if (username.startsWith('_') || username.startsWith('-')) {
    errors.push('Username cannot start with an underscore or hyphen');
  }
  if (username.endsWith('_') || username.endsWith('-')) {
    errors.push('Username cannot end with an underscore or hyphen');
  }
  
  // Reserved usernames
  const reserved = ['admin', 'root', 'system', 'api', 'www', 'mail', 'support', 'help', 'about', 'musicsync'];
  if (reserved.includes(username.toLowerCase())) {
    errors.push('This username is reserved');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Rate limiting for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per window
  message: { error: 'Too many login attempts, please try again later' },
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return `${req.ip}_${req.body.emailOrUsername || 'unknown'}`;
  }
});

export class AuthService {
  // Generate JWT tokens with enhanced payload
  private generateTokens(user: { id: string; username: string; email: string; avatar?: string }) {
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      iat: Math.floor(Date.now() / 1000),
      type: 'access'
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { 
      expiresIn: '30m', // Increased from 15m for better UX
      issuer: 'musicsync-server',
      audience: 'musicsync-client'
    });

    const refreshToken = jwt.sign(
      { 
        id: user.id, 
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_REFRESH_SECRET,
      { 
        expiresIn: '30d', // Increased from 7d
        issuer: 'musicsync-server',
        audience: 'musicsync-client'
      }
    );

    return { accessToken, refreshToken };
  }

  // Enhanced register with better validation
  async register(username: string, email: string, password: string): Promise<{ 
    success: boolean; 
    user?: any; 
    tokens?: any; 
    error?: string;
    validationErrors?: string[];
  }> {
    try {
      console.log('🔥 AuthService.register called with:', { username, email, hasPassword: !!password });
    
      // Input validation
      if (!username || !email || !password) {
        console.log('❌ Missing required fields');
        return { success: false, error: 'All fields are required' };
      }

      // Validate username
      const usernameValidation = validateUsername(username.trim());
      if (!usernameValidation.isValid) {
        return { 
          success: false, 
          error: 'Username validation failed',
          validationErrors: usernameValidation.errors
        };
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      // Validate password
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return { 
          success: false, 
          error: 'Password does not meet requirements',
          validationErrors: passwordValidation.errors
        };
      }

      console.log('🔍 Checking for existing user...');
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: email.toLowerCase().trim() },
          { username: username.trim() }
        ]
      });

      if (existingUser) {
        console.log('❌ User already exists:', { 
          email: existingUser.email === email.toLowerCase().trim(),
          username: existingUser.username === username.trim()
        });
        
        if (existingUser.email === email.toLowerCase().trim()) {
          return { success: false, error: 'An account with this email already exists' };
        } else {
          return { success: false, error: 'This username is already taken' };
        }
      }

      console.log('✅ No existing user found, creating new user...');
      
      // Create new user
      const user = new User({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        hashedPassword: password,
        lastLogin: new Date()
      });

      console.log('💾 Saving user to database...');
      const savedUser = await user.save();
      console.log('✅ User saved successfully:', { 
        id: savedUser._id, 
        username: savedUser.username, 
        email: savedUser.email 
      });

      // Generate tokens
      const userTokenData = {
        id: savedUser._id.toString(),
        username: savedUser.username,
        email: savedUser.email,
        avatar: savedUser.avatar
      };
      
      console.log('🔐 Generating tokens...');
      const tokens = this.generateTokens(userTokenData);
      
      console.log('💾 Saving refresh token...');
      // Save refresh token
      const refreshTokenDoc = new RefreshToken({
        token: tokens.refreshToken,
        userId: savedUser._id
      });
      await refreshTokenDoc.save();
      console.log('✅ Refresh token saved');

      const responseUser = {
        id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        avatar: savedUser.avatar,
        createdAt: savedUser.createdAt,
        lastLogin: savedUser.lastLogin,
        preferences: savedUser.preferences
      };

      console.log('🎉 Registration successful for:', savedUser.username);
      
      return {
        success: true,
        user: responseUser,
        tokens
      };

    } catch (error: any) {
      console.error('💥 Registration error:', error);
      console.error('📋 Error stack:', error.stack);
      
      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue || {})[0];
        console.log('❌ Duplicate key error for field:', field);
        return { 
          success: false, 
          error: `An account with this ${field} already exists` 
        };
      }
      
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  }

  // Enhanced login with better security
  async login(emailOrUsername: string, password: string, userAgent?: string, ipAddress?: string): Promise<{ 
    success: boolean; 
    user?: any; 
    tokens?: any; 
    error?: string;
    requiresVerification?: boolean;
  }> {
    try {
      if (!emailOrUsername || !password) {
        return { success: false, error: 'Email/username and password are required' };
      }

      // Find user (case-insensitive email, case-sensitive username)
      const user = await User.findOne({
        $or: [
          { email: emailOrUsername.toLowerCase().trim() },
          { username: emailOrUsername.trim() }
        ]
      });

      if (!user) {
        // Don't reveal whether user exists or not
        return { success: false, error: 'Invalid credentials' };
      }

      if (!user.isActive) {
        return { 
          success: false, 
          error: 'Your account has been deactivated. Please contact support.' 
        };
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Update last login and login count
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const userTokenData = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatar: user.avatar
      };
      const tokens = this.generateTokens(userTokenData);
      
      // Save refresh token with metadata
      const refreshTokenDoc = new RefreshToken({
        token: tokens.refreshToken,
        userId: user._id,
        userAgent: userAgent || 'Unknown',
        ipAddress: ipAddress || 'Unknown'
      });
      await refreshTokenDoc.save();

      return {
        success: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          lastLogin: user.lastLogin,
          preferences: user.preferences,
          createdAt: user.createdAt
        },
        tokens
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }

  // Enhanced refresh token with security checks
  async refreshToken(token: string, userAgent?: string, ipAddress?: string): Promise<{ 
    success: boolean; 
    tokens?: any; 
    error?: string;
    requiresReauth?: boolean;
  }> {
    try {
      if (!token) {
        return { success: false, error: 'Refresh token is required' };
      }

      // Check if refresh token exists and is valid
      const refreshTokenDoc = await RefreshToken.findOne({
        token,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      }).populate('userId');

      if (!refreshTokenDoc) {
        return { 
          success: false, 
          error: 'Invalid or expired refresh token',
          requiresReauth: true
        };
      }

      // Verify JWT
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
          issuer: 'musicsync-server',
          audience: 'musicsync-client'
        });
      } catch (jwtError: any) {
        await RefreshToken.updateOne(
          { _id: refreshTokenDoc._id },
          { isRevoked: true, revokedAt: new Date() }
        );
        return { 
          success: false, 
          error: 'Invalid refresh token',
          requiresReauth: true
        };
      }

      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        return { 
          success: false, 
          error: 'User not found or deactivated',
          requiresReauth: true
        };
      }

      // Security check: verify token belongs to user
      if (refreshTokenDoc.userId.toString() !== user._id.toString()) {
        await RefreshToken.updateOne(
          { _id: refreshTokenDoc._id },
          { isRevoked: true, revokedAt: new Date() }
        );
        return { 
          success: false, 
          error: 'Token mismatch',
          requiresReauth: true
        };
      }

      // Revoke old refresh token
      refreshTokenDoc.isRevoked = true;
      refreshTokenDoc.revokedAt = new Date();
      await refreshTokenDoc.save();

      // Generate new tokens
      const userTokenData = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatar: user.avatar
      };
      const tokens = this.generateTokens(userTokenData);
      
      // Save new refresh token
      const newRefreshTokenDoc = new RefreshToken({
        token: tokens.refreshToken,
        userId: user._id,
        userAgent: userAgent || refreshTokenDoc.userAgent,
        ipAddress: ipAddress || refreshTokenDoc.ipAddress
      });
      await newRefreshTokenDoc.save();

      return { success: true, tokens };

    } catch (error) {
      console.error('Token refresh error:', error);
      return { 
        success: false, 
        error: 'Token refresh failed',
        requiresReauth: true
      };
    }
  }

  // Enhanced logout with session cleanup
  async logout(refreshToken?: string, allDevices: boolean = false, userId?: string): Promise<{ 
    success: boolean;
    message?: string;
  }> {
    try {
      if (allDevices && userId) {
        // Logout from all devices
        await RefreshToken.updateMany(
          { userId, isRevoked: false },
          { 
            isRevoked: true, 
            revokedAt: new Date(),
            revokedReason: 'User logout (all devices)'
          }
        );
        return { 
          success: true, 
          message: 'Logged out from all devices successfully' 
        };
      } else if (refreshToken) {
        // Logout from current device only
        await RefreshToken.updateOne(
          { token: refreshToken },
          { 
            isRevoked: true, 
            revokedAt: new Date(),
            revokedReason: 'User logout'
          }
        );
        return { 
          success: true, 
          message: 'Logged out successfully' 
        };
      }
      
      return { success: true, message: 'Logout completed' };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: true, message: 'Logout completed with errors' };
    }
  }

  // Enhanced token verification
  verifyToken(token: string): { 
    success: boolean; 
    user?: any; 
    error?: string;
    expired?: boolean;
  } {
    try {
      if (!token) {
        return { success: false, error: 'No token provided' };
      }

      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'musicsync-server',
        audience: 'musicsync-client'
      }) as any;

      // Additional verification
      if (decoded.type !== 'access') {
        return { success: false, error: 'Invalid token type' };
      }

      return { success: true, user: decoded };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return { success: false, error: 'Token expired', expired: true };
      } else if (error.name === 'JsonWebTokenError') {
        return { success: false, error: 'Invalid token' };
      } else {
        return { success: false, error: 'Token verification failed' };
      }
    }
  }

  // Get user by ID with enhanced data
  async getUserById(id: string, includePrivateData: boolean = false): Promise<IUserPublic | IUser | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }
      const user = await User.findById(id);
      if (!user || !user.isActive) {
        return null;
      }
      
      return includePrivateData ? user : user.toPublic();
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  // Get user sessions
  async getUserSessions(userId: string): Promise<any[]> {
    try {
      const sessions = await RefreshToken.find({
        userId,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      }).select('userAgent ipAddress createdAt lastUsed').sort({ createdAt: -1 });

      return sessions.map(session => ({
        id: session._id,
        userAgent: session.userAgent || 'Unknown',
        ipAddress: session.ipAddress || 'Unknown',
        createdAt: session.createdAt,
        lastUsed: session.lastUsed || session.createdAt,
        isCurrent: false // We'll need to track this separately
      }));
    } catch (error) {
      console.error('Get user sessions error:', error);
      return [];
    }
  }

  // Revoke specific session
  async revokeSession(userId: string, sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await RefreshToken.updateOne(
        { 
          _id: sessionId, 
          userId,
          isRevoked: false 
        },
        { 
          isRevoked: true, 
          revokedAt: new Date(),
          revokedReason: 'Manual revocation'
        }
      );

      if (result.modifiedCount === 0) {
        return { success: false, error: 'Session not found or already revoked' };
      }

      return { success: true };
    } catch (error) {
      console.error('Revoke session error:', error);
      return { success: false, error: 'Failed to revoke session' };
    }
  }

  // Enhanced cleanup with better logging
  async cleanupExpiredTokens(): Promise<{ deleted: number; errors: any[] }> {
    try {
      const result = await RefreshToken.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { 
            isRevoked: true, 
            revokedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Keep revoked tokens for 7 days for audit
          }
        ]
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} expired/old tokens`);
      return { deleted: result.deletedCount || 0, errors: [] };
    } catch (error) {
      console.error('Token cleanup error:', error);
      return { deleted: 0, errors: [error] };
    }
  }

  // Password strength checker
  checkPasswordStrength(password: string): {
    score: number; // 0-4
    feedback: string[];
    isStrong: boolean;
  } {
    const validation = validatePassword(password);
    let score = 0;
    const feedback: string[] = [];

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character variety
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

    // Avoid common patterns
    if (!/(.)\1{2,}/.test(password)) score++; // No repeated characters
    if (!/123|abc|qwe/i.test(password)) score++; // No sequences

    const maxScore = 7;
    const normalizedScore = Math.min(Math.floor((score / maxScore) * 4), 4);

    if (normalizedScore < 2) {
      feedback.push('Password is too weak');
    } else if (normalizedScore < 3) {
      feedback.push('Password could be stronger');
    } else if (normalizedScore < 4) {
      feedback.push('Password is good');
    } else {
      feedback.push('Password is very strong');
    }

    return {
      score: normalizedScore,
      feedback: validation.isValid ? feedback : validation.errors,
      isStrong: normalizedScore >= 3 && validation.isValid
    };
  }
}

// Enhanced middleware for protecting routes
export const authenticateToken = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ 
      error: 'Access token required',
      code: 'NO_TOKEN'
    });
    return;
  }

  const authService = new AuthService();
  const result = authService.verifyToken(token);

  if (!result.success) {
    const status = result.expired ? 401 : 403;
    const code = result.expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    
    res.status(status).json({ 
      error: result.error,
      code,
      requiresRefresh: result.expired
    });
    return;
  }

  // Verify user still exists and is active
  const user = await authService.getUserById(result.user.id);
  if (!user) {
    res.status(403).json({ 
      error: 'User not found or deactivated',
      code: 'USER_NOT_FOUND'
    });
    return;
  }

  req.user = {
    id: result.user.id,
    username: result.user.username,
    email: result.user.email,
    avatar: result.user.avatar
  };
  
  next();
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  const authService = new AuthService();
  const result = authService.verifyToken(token);

  if (result.success) {
    const user = await authService.getUserById(result.user.id);
    if (user) {
      req.user = {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        avatar: result.user.avatar
      };
    }
  }

  next();
};

export const authService = new AuthService();

// Enhanced cleanup - runs every 6 hours
setInterval(async () => {
  const result = await authService.cleanupExpiredTokens();
  if (result.errors.length > 0) {
    console.error('Token cleanup had errors:', result.errors);
  }
}, 6 * 60 * 60 * 1000);