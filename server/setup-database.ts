import mongoose from 'mongoose';
import { existsSync } from 'fs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/musicsync';

async function testConnection() {
  try {
    console.log('🔧 Testing MongoDB connection...');
    console.log(`📍 Connecting to: ${MONGODB_URI.replace(/\/\/.*:.*@/, '//***:***@')}`);
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    
    console.log('✅ MongoDB connection successful!');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    console.log(`🔗 Ready state: ${mongoose.connection.readyState}`);
    
    // ✅ Fixed: Add null check for mongoose.connection.db
    if (mongoose.connection.db) {
      // Test basic operation
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`📁 Available collections: ${collections.length}`);
      
      if (collections.length > 0) {
        console.log(`📂 Collections: ${collections.map(c => c.name).join(', ')}`);
      }
      
      // Additional test: ping the database
      const pingResult = await mongoose.connection.db.admin().ping();
      console.log('🏓 Database ping successful:', pingResult);
      
    } else {
      console.warn('⚠️ Database connection established but db object is undefined');
      console.log('💡 This can happen during connection establishment');
    }
    
  } catch (error: any) {
    console.error('❌ MongoDB connection failed:');
    console.error(`Error: ${error.message}`);
    
    // Enhanced error details
    if (error.name) {
      console.error(`Error type: ${error.name}`);
    }
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('💡 DNS Resolution failed:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify MongoDB Atlas cluster is running');
      console.error('   3. Check connection string in .env file');
      console.error('   4. Try: nslookup your-cluster.mongodb.net');
    }
    
    if (error.message.includes('authentication') || error.message.includes('auth')) {
      console.error('💡 Authentication failed:');
      console.error('   1. Check username/password in connection string');
      console.error('   2. Verify database user exists in MongoDB Atlas');
      console.error('   3. Ensure user has correct permissions');
      console.error('   4. Try resetting database user password');
    }
    
    if (error.message.includes('IP') || error.message.includes('not authorized from')) {
      console.error('💡 Network access denied:');
      console.error('   1. Add your IP to MongoDB Atlas Network Access');
      console.error('   2. Or allow access from anywhere (0.0.0.0/0)');
      console.error('   3. Check corporate firewall settings');
    }
    
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.error('💡 Connection timeout:');
      console.error('   1. Increase serverSelectionTimeoutMS');
      console.error('   2. Check internet connection stability');
      console.error('   3. Try different network/VPN');
    }
    
  } finally {
    try {
      await mongoose.disconnect();
      console.log('📴 Disconnected from MongoDB');
    } catch (disconnectError) {
      console.error('⚠️ Error during disconnect:', disconnectError);
    }
    process.exit(0);
  }
}

// Environment validation
console.log('🔍 Environment Check:');
console.log(`📁 Working directory: ${process.cwd()}`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

// Check if .env file exists
if (!existsSync('.env')) {
  console.warn('⚠️  No .env file found. Using default connection string.');
  console.log('💡 Create a .env file with your MongoDB connection string:');
  console.log('');
  console.log('   For local MongoDB:');
  console.log('   MONGODB_URI=mongodb://localhost:27017/musicsync');
  console.log('');
  console.log('   For MongoDB Atlas:');
  console.log('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/musicsync?retryWrites=true&w=majority');
  console.log('');
} else {
  console.log('✅ .env file found');
  if (process.env.MONGODB_URI) {
    console.log('✅ MONGODB_URI is configured');
  } else {
    console.warn('⚠️  MONGODB_URI not found in .env file');
  }
}

console.log('');
console.log('📋 MongoDB Atlas Quick Setup Guide:');
console.log('   1. https://cloud.mongodb.com/ → Create account');
console.log('   2. Create Cluster → Choose M0 (Free)');
console.log('   3. Database Access → Add User → Read/Write permissions');
console.log('   4. Network Access → Add IP → 0.0.0.0/0 (allow all)');
console.log('   5. Connect → Application → Copy connection string');
console.log('   6. Replace <username>, <password>, <dbname> in string');
console.log('');

// Run test
testConnection();