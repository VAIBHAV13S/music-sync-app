import { useState, useEffect } from 'react';
import { realSocketService } from '../services/realSocketService';

const ConnectionDebug = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  const refreshDebugInfo = () => {
    setDebugInfo(realSocketService.getDebugInfo());
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const healthy = await realSocketService.testConnection();
      setHealthStatus(healthy);
    } catch (error) {
      setHealthStatus(false);
    } finally {
      setTesting(false);
    }
  };

  const forceConnect = async () => {
    try {
      await realSocketService.connect();
      refreshDebugInfo();
    } catch (error) {
      console.error('Force connect failed:', error);
    }
  };

  useEffect(() => {
    refreshDebugInfo();
    const interval = setInterval(refreshDebugInfo, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!debugInfo) return <div>Loading debug info...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">🔧 Connection Debug Panel</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Connection Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Connected:</span>
              <span className={`font-semibold ${debugInfo.connected ? 'text-green-600' : 'text-red-600'}`}>
                {debugInfo.connected ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Connecting:</span>
              <span className={`font-semibold ${debugInfo.connecting ? 'text-yellow-600' : 'text-gray-600'}`}>
                {debugInfo.connecting ? '🔄 Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Socket ID:</span>
              <span className="font-mono text-sm">{debugInfo.socketId || 'None'}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Room:</span>
              <span className="font-mono text-sm">{debugInfo.currentRoom || 'None'}</span>
            </div>
            <div className="flex justify-between">
              <span>Reconnect Attempts:</span>
              <span className="font-semibold">{debugInfo.reconnectAttempts}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Environment Info</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Server URL:</span>
              <span className="font-mono text-xs break-all">{debugInfo.serverUrl}</span>
            </div>
            <div className="flex justify-between">
              <span>Environment:</span>
              <span className="font-semibold">{debugInfo.environment?.isProd ? 'Production' : 'Development'}</span>
            </div>
            <div className="flex justify-between">
              <span>Hostname:</span>
              <span className="font-mono text-sm">{debugInfo.environment?.hostname}</span>
            </div>
            <div className="flex justify-between">
              <span>Env Variable:</span>
              <span className="font-mono text-xs break-all">{debugInfo.environment?.envVar}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Server Health</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Health Status:</span>
              <span className={`font-semibold ${
                healthStatus === null ? 'text-gray-600' : 
                healthStatus ? 'text-green-600' : 'text-red-600'
              }`}>
                {healthStatus === null ? '❓ Unknown' : 
                 healthStatus ? '✅ Healthy' : '❌ Unhealthy'}
              </span>
            </div>
            <button
              onClick={testConnection}
              disabled={testing}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {testing ? '🔄 Testing...' : '🏥 Test Server Health'}
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Actions</h3>
          <div className="space-y-3">
            <button
              onClick={forceConnect}
              className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
            >
              🔌 Force Connect
            </button>
            <button
              onClick={refreshDebugInfo}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
            >
              🔄 Refresh Info
            </button>
            <button
              onClick={() => {
                realSocketService.disconnect();
                refreshDebugInfo();
              }}
              className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
            >
              🔌 Disconnect
            </button>
          </div>
        </div>
      </div>

      {debugInfo.activeListeners.length > 0 && (
        <div className="mt-6 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Active Event Listeners</h3>
          <div className="flex flex-wrap gap-2">
            {debugInfo.activeListeners.map((listener: string, index: number) => (
              <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                {listener}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionDebug;
