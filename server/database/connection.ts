import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/musicsync';

export const connectDatabase = async (): Promise<void> => {
  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    console.log(`📍 Connection string: ${MONGODB_URI.replace(/\/\/.*:.*@/, '//***:***@')}`);
    
    // ✅ Fixed: Removed invalid properties for current Mongoose version
    const options: mongoose.ConnectOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4
      // ✅ Removed bufferCommands and bufferMaxEntries - not valid in ConnectOptions
    };

    await mongoose.connect(MONGODB_URI, options);
    
    console.log('✅ Connected to MongoDB successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    console.log(`🔗 Ready state: ${mongoose.connection.readyState}`);
    
    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

  } catch (error: any) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // Specific error handling
    if (error.name === 'MongooseServerSelectionError') {
      console.error('🔍 Server Selection Error - possible causes:');
      console.error('   • Network connectivity issues');
      console.error('   • Incorrect connection string');
      console.error('   • IP not whitelisted in MongoDB Atlas');
      console.error('   • MongoDB Atlas cluster paused/unavailable');
    }
    
    console.error('📋 Troubleshooting steps:');
    console.error('   1. Verify MONGODB_URI environment variable');
    console.error('   2. Check MongoDB Atlas Network Access settings');
    console.error('   3. Ensure cluster is running (not paused)');
    console.error('   4. Test connection with MongoDB Compass');
    
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Exiting due to database connection failure in production');
      process.exit(1);
    } else {
      console.warn('⚠️ Continuing without database in development mode');
      throw error; // Re-throw in development for debugging
    }
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
  }
};

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, closing MongoDB connection...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing MongoDB connection...');
  await disconnectDatabase();
  process.exit(0);
});