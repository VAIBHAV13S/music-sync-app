import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/musicsync';

export const connectDatabase = async (): Promise<void> => {
  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    console.log(`📍 Connection string: ${MONGODB_URI.replace(/\/\/.*:.*@/, '//***:***@')}`);
    
    const options: mongoose.ConnectOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4
    };

    await mongoose.connect(MONGODB_URI, options);
    
    console.log('✅ Connected to MongoDB successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    
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
    
    // Enhanced error handling for Render deployment
    if (error.code === 'ENOTFOUND') {
      console.error('🔍 DNS Resolution failed - Check connection string:');
      console.error('   • Verify the cluster name in MongoDB Atlas');
      console.error('   • Ensure connection string is complete');
      console.error('   • Check if cluster is running (not paused)');
      console.error('   • Current MONGODB_URI format validation needed');
    }
    
    console.error('📋 Render deployment troubleshooting:');
    console.error('   1. Add MONGODB_URI to Render Environment Variables');
    console.error('   2. Get correct connection string from MongoDB Atlas');
    console.error('   3. Ensure Atlas cluster is not paused');
    console.error('   4. Add 0.0.0.0/0 to Atlas Network Access');
    
    // ✅ Always exit on production database connection failure
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Exiting due to database connection failure in production');
      process.exit(1);
    } else {
      console.warn('⚠️ Continuing without database in development mode');
      throw error;
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