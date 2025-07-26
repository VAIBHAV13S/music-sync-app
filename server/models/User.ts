import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: string;
  username: string;
  email: string;
  hashedPassword: string;
  avatar?: string;
  createdAt: Date;
  lastLogin: Date;
  isActive: boolean;
  isVerified: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  preferences: {
    theme: 'dark' | 'light';
    autoJoinRooms: boolean;
    notifications: boolean;
    privacy: {
      showOnlineStatus: boolean;
      allowDirectMessages: boolean;
      showListeningHistory: boolean;
    };
    security: {
      twoFactorEnabled: boolean;
      sessionTimeout: number; // in minutes
      requirePasswordForSensitiveActions: boolean;
    };
  };
  profile: {
    displayName?: string;
    bio?: string;
    favoriteGenres: string[];
    totalListeningTime: number;
    joinedRooms: number;
    hostedRooms: number;
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
  toPublic(): IUserPublic;
  toPrivate(): IUserPrivate;
  isLocked: boolean;
}

// Create a separate interface for JSON output without sensitive fields
export interface IUserPublic {
  _id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  favoriteGenres: string[];
  createdAt: Date;
  isVerified: boolean;
  profile: {
    totalListeningTime: number;
    joinedRooms: number;
    hostedRooms: number;
  };
}

export interface IUserPrivate extends IUserPublic {
  email: string;
  lastLogin: Date;
  isActive: boolean;
  preferences: {
    theme: 'dark' | 'light';
    autoJoinRooms: boolean;
    notifications: boolean;
    privacy: {
      showOnlineStatus: boolean;
      allowDirectMessages: boolean;
      showListeningHistory: boolean;
    };
    security: {
      twoFactorEnabled: boolean;
      sessionTimeout: number;
      requirePasswordForSensitiveActions: boolean;
    };
  };
}

const UserSchema: Schema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_-]+$/,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    index: true
  },
  hashedPassword: {
    type: String,
    required: true,
    minlength: 8
  },
  avatar: {
    type: String,
    default: function(this: IUser) {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.username}`;
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false // In production, you might want email verification
  },
  verificationToken: {
    type: String,
    sparse: true
  },
  passwordResetToken: {
    type: String,
    sparse: true
  },
  passwordResetExpires: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  preferences: {
    theme: {
      type: String,
      enum: ['dark', 'light'],
      default: 'dark'
    },
    autoJoinRooms: {
      type: Boolean,
      default: false
    },
    notifications: {
      type: Boolean,
      default: true
    },
    privacy: {
      showOnlineStatus: {
        type: Boolean,
        default: true
      },
      allowDirectMessages: {
        type: Boolean,
        default: true
      },
      showListeningHistory: {
        type: Boolean,
        default: true
      }
    },
    security: {
      twoFactorEnabled: {
        type: Boolean,
        default: false
      },
      sessionTimeout: {
        type: Number,
        default: 60, // minutes
        min: 5,
        max: 1440 // 24 hours
      },
      requirePasswordForSensitiveActions: {
        type: Boolean,
        default: true
      }
    }
  },
  profile: {
    displayName: {
      type: String,
      trim: true,
      maxlength: 50
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500
    },
    favoriteGenres: [{
      type: String,
      enum: ['pop', 'rock', 'hip-hop', 'electronic', 'classical', 'jazz', 'country', 'r&b', 'indie', 'metal', 'folk', 'reggae', 'blues', 'punk', 'alternative', 'world', 'ambient', 'experimental']
    }],
    totalListeningTime: {
      type: Number,
      default: 0 // in minutes
    },
    joinedRooms: {
      type: Number,
      default: 0
    },
    hostedRooms: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: IUser, ret: any): IUserPrivate {
      return {
        _id: ret._id,
        username: ret.username,
        displayName: ret.profile?.displayName,
        email: ret.email,
        avatar: ret.avatar,
        bio: ret.profile?.bio,
        favoriteGenres: ret.profile?.favoriteGenres || [],
        createdAt: ret.createdAt,
        lastLogin: ret.lastLogin,
        isActive: ret.isActive,
        isVerified: ret.isVerified,
        preferences: ret.preferences,
        profile: {
          totalListeningTime: ret.profile?.totalListeningTime || 0,
          joinedRooms: ret.profile?.joinedRooms || 0,
          hostedRooms: ret.profile?.hostedRooms || 0
        }
      };
    }
  }
});

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function(this: IUser) {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Hash password before saving
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('hashedPassword')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.hashedPassword = await bcrypt.hash(this.hashedPassword as string, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method with account locking
UserSchema.methods.comparePassword = async function(this: IUser, candidatePassword: string): Promise<boolean> {
  // If account is locked, deny access
  if (this.isLocked) {
    return false;
  }

  const isMatch = await bcrypt.compare(candidatePassword, this.hashedPassword);
  
  // If password is incorrect, increment login attempts
  if (!isMatch) {
    this.loginAttempts = (this.loginAttempts || 0) + 1;
    
    // Lock account after 5 failed attempts for 30 minutes
    if (this.loginAttempts >= 5) {
      this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
    
    await this.save();
    return false;
  }
  
  // Reset login attempts on successful login
  if (this.loginAttempts > 0) {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    await this.save();
  }
  
  return true;
};

// Method to get public user data
UserSchema.methods.toPublic = function(this: IUser): IUserPublic {
  return {
    _id: this._id,
    username: this.username,
    displayName: this.profile?.displayName,
    avatar: this.avatar,
    bio: this.profile?.bio,
    favoriteGenres: this.profile?.favoriteGenres || [],
    createdAt: this.createdAt,
    isVerified: this.isVerified,
    profile: {
      totalListeningTime: this.profile?.totalListeningTime || 0,
      joinedRooms: this.profile?.joinedRooms || 0,
      hostedRooms: this.profile?.hostedRooms || 0
    }
  };
};

// Method to get private user data (for authenticated user)
UserSchema.methods.toPrivate = function(this: IUser): IUserPrivate {
  return {
    _id: this._id,
    username: this.username,
    displayName: this.profile?.displayName,
    email: this.email,
    avatar: this.avatar,
    bio: this.profile?.bio,
    favoriteGenres: this.profile?.favoriteGenres || [],
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
    isActive: this.isActive,
    isVerified: this.isVerified,
    preferences: this.preferences,
    profile: {
      totalListeningTime: this.profile?.totalListeningTime || 0,
      joinedRooms: this.profile?.joinedRooms || 0,
      hostedRooms: this.profile?.hostedRooms || 0
    }
  };
};

// Indexes for performance
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastLogin: -1 });
UserSchema.index({ 'profile.totalListeningTime': -1 });
UserSchema.index({ isActive: 1, isVerified: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);