import React, { useState } from 'react';
import { useSocket } from '../../hooks/useSocket';

// Component for testing different server connections
export const NetworkConnectionTester: React.FC = () => {
  const [testUrl, setTestUrl] = useState('');
  const [availableServers, setAvailableServers] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  const { connect, testConnection, discoverLocalServers, connectionStatus } = useSocket({
    autoConnect: false
  });

  const handleScanNetwork = async () => {
    setIsScanning(true);
    try {
      const servers = await discoverLocalServers();
      setAvailableServers(servers);
    } catch (error) {
      console.error('Network scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleTestConnection = async () => {
    if (testUrl) {
      const isAvailable = await testConnection(testUrl);
      alert(isAvailable ? 'Connection successful!' : 'Connection failed!');
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4">Network Connection Tester</h3>
      
      {/* Connection Status */}
      <div className="mb-4 p-3 rounded bg-gray-50">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus.connected ? 'bg-green-500' : 
            connectionStatus.connecting ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span className="font-medium">
            {connectionStatus.connected ? 'Connected' : 
             connectionStatus.connecting ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
        {connectionStatus.error && (
          <p className="text-red-600 text-sm mt-1">{connectionStatus.error}</p>
        )}
      </div>

      {/* Manual connection test */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Test Server URL:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="http://192.168.1.100:3001"
            className="flex-1 px-3 py-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleTestConnection}
            disabled={!testUrl}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Test
          </button>
        </div>
      </div>

      {/* Network scan */}
      <div className="mb-4">
        <button
          onClick={handleScanNetwork}
          disabled={isScanning}
          className="w-full px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
        >
          {isScanning ? 'Scanning Network...' : 'Scan for Local Servers'}
        </button>
      </div>

      {/* Available servers */}
      {availableServers.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Available Servers:</h4>
          <div className="space-y-2">
            {availableServers.map((serverUrl) => (
              <div key={serverUrl} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="font-mono text-sm">{serverUrl}</span>
                <button
                  onClick={() => connect(serverUrl)}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded"
                >
                  Connect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};