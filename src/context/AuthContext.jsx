import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Robust check for both localStorage and sessionStorage
    const getToken = () => {
      const t1 = localStorage.getItem('logivision_token');
      if (t1 && t1 !== 'null' && t1 !== 'undefined') return t1;
      const t2 = sessionStorage.getItem('logivision_token');
      if (t2 && t2 !== 'null' && t2 !== 'undefined') return t2;
      return null;
    };

    const getRole = () => {
      const r1 = localStorage.getItem('logivision_role');
      if (r1 && r1 !== 'null' && r1 !== 'undefined') return r1;
      const r2 = sessionStorage.getItem('logivision_role');
      if (r2 && r2 !== 'null' && r2 !== 'undefined') return r2;
      return null;
    };

    const token = getToken();
    const savedRole = getRole();
    const savedUser = localStorage.getItem('logivision_user');

    if (token) {
      setRole(savedRole);
      if (savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error('Failed to parse saved user', e);
          setUser({ role: savedRole });
        }
      } else {
        setUser({ role: savedRole });
      }
    }
    setLoading(false);
  }, []);

  const setAuthData = (userData, token) => {
    localStorage.setItem('logivision_token', token);
    localStorage.setItem('logivision_role', userData.role);
    localStorage.setItem('logivision_user', JSON.stringify(userData));

    sessionStorage.setItem('logivision_token', token);
    sessionStorage.setItem('logivision_role', userData.role);

    setUser(userData);
    setRole(userData.role);
  };

  const login = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const { token, user: userData } = data.data;
      setAuthData(userData, token);

      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('logivision_token');
    localStorage.removeItem('logivision_role');
    localStorage.removeItem('logivision_user');
    sessionStorage.removeItem('logivision_token');
    sessionStorage.removeItem('logivision_role');
    setUser(null);
    setRole(null);
  };

  const updateUser = (userData) => {
    const newUser = { ...user, ...userData };
    localStorage.setItem('logivision_user', JSON.stringify(newUser));
    setUser(newUser);
    if (userData.role) setRole(userData.role);
  };

  const hasRole = (allowedRoles) => {
    if (!user && !role) return false;
    if (allowedRoles.includes('ALL')) return true;
    const currentRole = role || user?.role;
    return allowedRoles.includes(currentRole);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, hasRole, setAuthData, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
