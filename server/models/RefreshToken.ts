import mongoose, { Document, Schema } from 'mongoose';

export interface IRefreshToken extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  userAgent?: string;
  ipAddress?: string;
  lastUsed?: Date;
  deviceInfo?: {
    platform?: string;
    browser?: string;
    os?: string;
    isMobile: boolean;
  };
  createdAt: Date;
}

const RefreshTokenSchema: Schema = new Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    index: { expires: 0 } // TTL index
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  revokedAt: {
    type: Date
  },
  revokedReason: {
    type: String,
    enum: ['User logout', 'User logout (all devices)', 'Manual revocation', 'Security breach', 'Token rotation', 'Account deactivation', 'Password change']
  },
  userAgent: {
    type: String,
    default: 'Unknown'
  },
  ipAddress: {
    type: String,
    default: 'Unknown'
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  deviceInfo: {
    platform: String,
    browser: String,
    os: String,
    isMobile: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
RefreshTokenSchema.index({ userId: 1, isRevoked: 1 });
RefreshTokenSchema.index({ userId: 1, expiresAt: 1 });
RefreshTokenSchema.index({ expiresAt: 1, isRevoked: 1 });

// Update lastUsed when token is accessed
RefreshTokenSchema.methods.updateLastUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);