import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);

  // Disconnect function to be called on logout
  const disconnect = useCallback(() => {
    if (socket) {
      console.log('Manually disconnecting socket');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers(new Set());
    }
  }, [socket]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');

    // Create socket if user data and token exist, and no existing socket
    if (user.id && token && !socket) {
      console.log('Creating new socket connection for user:', user.username);
      
      // Create socket connection
      const newSocket = io('http://localhost:3000', {
        auth: {
          token
        },
        forceNew: true
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        
        // Join with user data
        newSocket.emit('join', { userId: user.id });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          setSocket(null);
          setOnlineUsers(new Set());
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setIsConnected(false);
      });

      // User status change handler
      newSocket.on('userStatusChange', ({ userId, isOnline }) => {
        console.log('User status change:', userId, isOnline ? 'online' : 'offline');
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          // Convert userId to string for consistency
          const userIdString = userId.toString();
          if (isOnline) {
            newSet.add(userIdString);
          } else {
            newSet.delete(userIdString);
          }
          console.log('Updated online users:', Array.from(newSet));
          return newSet;
        });
      });

      // Get initial online users when connecting
      newSocket.on('initialOnlineUsers', (users) => {
        console.log('Initial online users:', users);
        // Convert all user IDs to strings for consistency
        const userStrings = users.map(id => id.toString());
        setOnlineUsers(new Set(userStrings));
      });

      setSocket(newSocket);

      return () => {
        console.log('Cleaning up socket connection');
        newSocket.removeAllListeners();
        newSocket.disconnect();
      };
    } else if (!user.id || !token) {
      if (socket) {
        console.log('No user data, disconnecting socket');
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers(new Set());
      }
    }
  }, []);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token' && !e.newValue) {
        disconnect();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [disconnect]);

  const value = {
    socket,
    onlineUsers,
    isConnected,
    disconnect
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};