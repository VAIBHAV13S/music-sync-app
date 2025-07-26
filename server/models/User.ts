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
  preferences: {
    theme: 'dark' | 'light';
    autoJoinRooms: boolean;
    notifications: boolean;
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
  toPublic(): IUserPublic;
}

// Create a separate interface for JSON output without sensitive fields
export interface IUserPublic {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: Date;
  lastLogin: Date;
  isActive: boolean;
  preferences: {
    theme: 'dark' | 'light';
    autoJoinRooms: boolean;
    notifications: boolean;
  };
}

const UserSchema: Schema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  hashedPassword: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: function(this: IUser) {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.username}`;
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
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
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: IUser, ret: any): IUserPublic {
      // Create a new object without sensitive fields instead of deleting
      return {
        _id: ret._id,
        username: ret.username,
        email: ret.email,
        avatar: ret.avatar,
        createdAt: ret.createdAt,
        lastLogin: ret.lastLogin,
        isActive: ret.isActive,
        preferences: ret.preferences
      };
    }
  },
  toObject: {
    transform: function(doc: IUser, ret: any): IUserPublic {
      // Same transformation for toObject
      return {
        _id: ret._id,
        username: ret.username,
        email: ret.email,
        avatar: ret.avatar,
        createdAt: ret.createdAt,
        lastLogin: ret.lastLogin,
        isActive: ret.isActive,
        preferences: ret.preferences
      };
    }
  }
});

// Hash password before saving - Fixed with proper typing
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('hashedPassword')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    // Type assertion to ensure TypeScript knows this is a string
    this.hashedPassword = await bcrypt.hash(this.hashedPassword as string, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method - Fixed with proper typing
UserSchema.methods.comparePassword = async function(this: IUser, candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.hashedPassword);
};

// Method to get public user data safely
UserSchema.methods.toPublic = function(this: IUser): IUserPublic {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
    isActive: this.isActive,
    preferences: this.preferences
  };
};

// Create indexes for better performance
UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);