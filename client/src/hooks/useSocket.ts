import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Types
interface ConnectionConfig {
  serverUrl?: string;
  autoConnect?: boolean;
}

interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
  serverInfo?: {
    localAddresses: string[];
    port: number;
  };
}

export const useSocket = (config: ConnectionConfig = {}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false
  });

  // Get server URL from environment or config
  const getServerUrl = useCallback(() => {
    // Priority: 1. Passed config, 2. Environment variable, 3. Auto-detect, 4. Default
    if (config.serverUrl) return config.serverUrl;
    
    // Vite uses VITE_ prefix for environment variables
    if (import.meta.env.VITE_SERVER_URL) {
      return import.meta.env.VITE_SERVER_URL;
    }
    
    // For local development, try to detect the current host
    const currentHost = window.location.hostname;
    console.log('🔍 Auto-detecting server URL. Current host:', currentHost);
    
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      const serverUrl = `http://${currentHost}:3001`;
      console.log('🌐 Using network server URL:', serverUrl);
      return serverUrl;
    }
    
    // If accessing via localhost, try to find the actual network server
    console.log('🏠 Accessing via localhost, defaulting to localhost:3001');
    console.log('💡 Tip: For network testing, visit http://YOUR_IP:3000 instead');
    return 'http://localhost:3001';
  }, [config.serverUrl]);

  // Connect to server
  const connect = useCallback(async (customUrl?: string) => {
    if (socket?.connected) {
      console.log('Already connected to server');
      return;
    }

    const serverUrl = customUrl || getServerUrl();
    console.log(`Attempting to connect to: ${serverUrl}`);
    
    setConnectionStatus(prev => ({ ...prev, connecting: true, error: undefined }));

    try {
      const newSocket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        forceNew: true
      });

      // Connection successful
      newSocket.on('connect', () => {
        console.log(`Connected to server: ${serverUrl}`);
        setConnectionStatus({
          connected: true,
          connecting: false,
          error: undefined
        });
        setSocket(newSocket);
      });

      // Connection error
      newSocket.on('connect_error', (error) => {
        console.error('Connection failed:', error.message);
        setConnectionStatus({
          connected: false,
          connecting: false,
          error: `Failed to connect to ${serverUrl}: ${error.message}`
        });
        newSocket.close();
      });

      // Disconnection
      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        setConnectionStatus({
          connected: false,
          connecting: false,
          error: reason === 'io client disconnect' ? undefined : `Disconnected: ${reason}`
        });
        setSocket(null);
      });

      // General error handling
      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
        setConnectionStatus(prev => ({
          ...prev,
          error: `Socket error: ${error.message || error}`
        }));
      });

    } catch (error) {
      console.error('Failed to create socket:', error);
      setConnectionStatus({
        connected: false,
        connecting: false,
        error: `Failed to create connection: ${error}`
      });
    }
  }, [socket, getServerUrl]);

  // Disconnect from server
  const disconnect = useCallback(() => {
    if (socket) {
      console.log('Disconnecting from server...');
      socket.disconnect();
      setSocket(null);
      setConnectionStatus({
        connected: false,
        connecting: false
      });
    }
  }, [socket]);

  // Test connection to a specific server
  const testConnection = useCallback(async (testUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const testSocket = io(testUrl, {
        transports: ['websocket', 'polling'],
        timeout: 3000
      });

      const timeout = setTimeout(() => {
        testSocket.close();
        resolve(false);
      }, 3000);

      testSocket.on('connect', () => {
        clearTimeout(timeout);
        testSocket.close();
        resolve(true);
      });

      testSocket.on('connect_error', () => {
        clearTimeout(timeout);
        testSocket.close();
        resolve(false);
      });
    });
  }, []);

  // Discover local servers
  const discoverLocalServers = useCallback(async (): Promise<string[]> => {
    const currentHost = window.location.hostname;
    const possibleHosts = ['localhost', '127.0.0.1'];
    
    // If we're not on localhost, add the current host
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      possibleHosts.unshift(currentHost);
    }

    // Test common local network ranges
    const hostParts = currentHost.split('.');
    if (hostParts.length === 4 && hostParts[0] === '192' && hostParts[1] === '168') {
      // Add other devices on the same 192.168.x.x network
      const baseNetwork = `${hostParts[0]}.${hostParts[1]}.${hostParts[2]}`;
      for (let i = 1; i <= 10; i++) {
        if (i.toString() !== hostParts[3]) {
          possibleHosts.push(`${baseNetwork}.${i}`);
        }
      }
    }

    const availableServers: string[] = [];
    
    for (const host of possibleHosts) {
      const testUrl = `http://${host}:3001`;
      const isAvailable = await testConnection(testUrl);
      if (isAvailable) {
        availableServers.push(testUrl);
      }
    }

    return availableServers;
  }, [testConnection]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (config.autoConnect !== false) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []); // Empty dependency array for mount/unmount only

  return {
    socket,
    connectionStatus,
    connect,
    disconnect,
    testConnection,
    discoverLocalServers,
    isConnected: connectionStatus.connected,
    isConnecting: connectionStatus.connecting,
    connectionError: connectionStatus.error
  };
};