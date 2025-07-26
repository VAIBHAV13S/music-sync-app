import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User, IUser, IUserPublic } from './models/User';
import { RefreshToken } from './models/RefreshToken';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';

export class AuthService {
  // Generate JWT tokens
  private generateTokens(user: { id: string; username: string; email: string }) {
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  // Register user
  async register(username: string, email: string, password: string): Promise<{ success: boolean; user?: any; tokens?: any; error?: string }> {
    try {
      // Validate input
      if (!username || !email || !password) {
        return { success: false, error: 'All fields are required' };
      }

      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return { success: false, error: 'User already exists' };
      }

      // Create new user
      const user = new User({
        username,
        email,
        hashedPassword: password // Will be hashed by pre-save middleware
      });

      await user.save();

      // Generate tokens
      const tokens = this.generateTokens({ id: user._id, username: user.username, email: user.email });
      
      // Save refresh token
      const refreshTokenDoc = new RefreshToken({
        token: tokens.refreshToken,
        userId: user._id
      });
      await refreshTokenDoc.save();

      return {
        success: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt
        },
        tokens
      };

    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  // Login user
  async login(emailOrUsername: string, password: string): Promise<{ success: boolean; user?: any; tokens?: any; error?: string }> {
    try {
      // Find user
      const user = await User.findOne({
        $or: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername }
        ]
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (!user.isActive) {
        return { success: false, error: 'Account is deactivated' };
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return { success: false, error: 'Invalid password' };
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const tokens = this.generateTokens({ id: user._id, username: user.username, email: user.email });
      
      // Save refresh token
      const refreshTokenDoc = new RefreshToken({
        token: tokens.refreshToken,
        userId: user._id
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
          preferences: user.preferences
        },
        tokens
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  // Refresh token
  async refreshToken(token: string): Promise<{ success: boolean; tokens?: any; error?: string }> {
    try {
      // Check if refresh token exists and is not revoked
      const refreshTokenDoc = await RefreshToken.findOne({
        token,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      }).populate('userId');

      if (!refreshTokenDoc) {
        return { success: false, error: 'Invalid refresh token' };
      }

      // Verify JWT
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;
      const user = await User.findById(decoded.id);

      if (!user || !user.isActive) {
        return { success: false, error: 'User not found' };
      }

      // Revoke old refresh token
      refreshTokenDoc.isRevoked = true;
      await refreshTokenDoc.save();

      // Generate new tokens
      const tokens = this.generateTokens({ id: user._id, username: user.username, email: user.email });
      
      // Save new refresh token
      const newRefreshTokenDoc = new RefreshToken({
        token: tokens.refreshToken,
        userId: user._id
      });
      await newRefreshTokenDoc.save();

      return { success: true, tokens };

    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'Token refresh failed' };
    }
  }

  // Logout
  async logout(refreshToken: string): Promise<{ success: boolean }> {
    try {
      // Revoke refresh token
      await RefreshToken.updateOne(
        { token: refreshToken },
        { isRevoked: true }
      );
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: true }; // Still return success even if token cleanup fails
    }
  }

  // Verify access token
  verifyToken(token: string): { success: boolean; user?: any; error?: string } {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return { success: true, user: decoded };
    } catch (error) {
      return { success: false, error: 'Invalid token' };
    }
  }

  // Get user by ID - Updated to return public user data
  async getUserById(id: string): Promise<IUserPublic | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }
      const user = await User.findById(id);
      return user ? user.toPublic() : null;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  // Clean up expired tokens (call this periodically)
  async cleanupExpiredTokens(): Promise<void> {
    try {
      await RefreshToken.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { isRevoked: true }
        ]
      });
    } catch (error) {
      console.error('Token cleanup error:', error);
    }
  }
}

// Middleware for protecting routes
export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const authService = new AuthService();
  const result = authService.verifyToken(token);

  if (!result.success) {
    res.status(403).json({ error: result.error });
    return;
  }

  req.user = result.user;
  next();
};

export const authService = new AuthService();

// Clean up expired tokens every hour
setInterval(() => {
  authService.cleanupExpiredTokens();
}, 60 * 60 * 1000);