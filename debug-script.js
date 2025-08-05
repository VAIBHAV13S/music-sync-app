/**
 * Debug script for Music Sync App
 * 
 * Run this in your browser console to debug connection issues:
 * 
 * 1. Copy this entire code block
 * 2. Paste it in browser console (F12 > Console)
 * 3. Press Enter to run
 */

(async function debugMusicSyncApp() {
  console.log('🔍 Music Sync App Debug Information');
  console.log('=====================================');
  
  // Environment detection
  console.log('\n📊 Environment:');
  console.log('- Current URL:', window.location.href);
  console.log('- Hostname:', window.location.hostname);
  console.log('- Protocol:', window.location.protocol);
  console.log('- Is Production:', window.location.hostname.includes('vercel.app'));
  
  // Check environment variables
  console.log('\n🔧 Configuration:');
  const envVar = window.import?.meta?.env?.VITE_SOCKET_SERVER_URL;
  console.log('- VITE_SOCKET_SERVER_URL:', envVar || 'not set');
  
  // Auto-detect server URL (same logic as app)
  const getServerUrl = () => {
    if (envVar) return envVar;
    if (window.location.hostname.includes('vercel.app')) {
      return 'https://music-sync-server-nz0r.onrender.com';
    }
    return 'http://localhost:3001';
  };
  
  const serverUrl = getServerUrl();
  console.log('- Detected Server URL:', serverUrl);
  
  // Test server connection
  console.log('\n🏥 Server Health Check:');
  try {
    const response = await fetch(`${serverUrl}/api/health`);
    if (response.ok) {
      const health = await response.json();
      console.log('✅ Server is healthy:', health);
    } else {
      console.log('❌ Server health check failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Failed to reach server:', error.message);
  }
  
  // Test environment endpoint
  console.log('\n🌐 Server Environment:');
  try {
    const response = await fetch(`${serverUrl}/api/environment`);
    if (response.ok) {
      const env = await response.json();
      console.log('✅ Server environment:', env);
    } else {
      console.log('❌ Environment check failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Failed to get environment:', error.message);
  }
  
  // Check socket service if available
  if (window.realSocketService) {
    console.log('\n🔌 Socket Service Debug:');
    console.log(window.realSocketService.getDebugInfo());
    
    console.log('\n🧪 Testing socket connection...');
    const healthy = await window.realSocketService.testConnection();
    console.log('Socket service health:', healthy ? '✅ HEALTHY' : '❌ UNHEALTHY');
  } else {
    console.log('\n⚠️ Socket service not found on window object');
  }
  
  console.log('\n=====================================');
  console.log('🔍 Debug complete! Check the information above.');
})();
