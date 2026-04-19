import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [feed, setFeed] = useState([]);
  const [mismatches, setMismatches] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('logivision_token') || sessionStorage.getItem('logivision_token');

    if (!token) return;

    // Connect to backend socket server
    const newSocket = io('/', {
      auth: { token },
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      setIsConnected(true);

      // Auto-join warehouse room if available in user data
      const userData = JSON.parse(localStorage.getItem('logivision_user') || '{}');
      if (userData.warehouseId) {
        newSocket.emit('join-warehouse', userData.warehouseId);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
      setIsConnected(false);
    });

    // Fetch initial feed and mismatches
    const fetchInitialData = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem('logivision_user') || '{}');
        const warehouseId = userData.warehouseId;
        if (!warehouseId) return;

        const response = await fetch(`/api/challans?warehouseId=${warehouseId}&limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await response.json();
        if (json.success) {
          setFeed(json.data.challans);
          setMismatches(json.data.challans.filter(c => c.status === 'MISMATCH' || c.status === 'FLAGGED'));
        }
      } catch (err) {
        console.error('Initial data fetch failed', err);
      }
    };
    fetchInitialData();

    // Listen for real-time events
    newSocket.on('challan:scanned', (data) => {
      setFeed(prev => {
        const exists = prev.some(f => (f.challanId || f._id) === (data.challan.challanId || data.challan._id));
        if (exists) return prev;
        return [data.challan, ...prev].slice(0, 50);
      });
      if (data.challan.status === 'MISMATCH' || data.challan.status === 'FLAGGED') {
        setMismatches(prev => {
          const exists = prev.some(m => (m.challanId || m._id) === (data.challan.challanId || data.challan._id));
          if (exists) return prev;
          return [data.challan, ...prev];
        });
      }
      window.dispatchEvent(new CustomEvent('socket:challan:scanned', { detail: data.challan }));
    });

    newSocket.on('mismatch:flagged', (data) => {
      setMismatches(prev => {
        const exists = prev.some(m => (m.challanId || m._id) === (data.challan.challanId || data.challan._id));
        if (exists) return prev;
        return [data.challan, ...prev];
      });
      window.dispatchEvent(new CustomEvent('socket:mismatch:flagged', { detail: data.challan }));
    });

    newSocket.on('challan:status:updated', (data) => {
      const updated = data.challan;
      setFeed(prev => prev.map(f => (f.challanId || f._id) === (updated.challanId || updated._id) ? updated : f));
      
      if (updated.status !== 'MISMATCH' && updated.status !== 'FLAGGED') {
        setMismatches(prev => prev.filter(m => (m.challanId || m._id) !== (updated.challanId || updated._id)));
      } else {
        setMismatches(prev => {
          const exists = prev.some(m => (m.challanId || m._id) === (updated.challanId || updated._id));
          if (exists) return prev.map(m => (m.challanId || m._id) === (updated.challanId || updated._id) ? updated : m);
          return [updated, ...prev];
        });
      }
      window.dispatchEvent(new CustomEvent('socket:mismatch:resolved', { detail: updated }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const emit = (event, data) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, feed, mismatches, emit }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    return { socket: null, isConnected: false, feed: [], mismatches: [], emit: () => { } };
  }
  return context;
};
