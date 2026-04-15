import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles = ['ALL'] }) => {
  const { user, hasRole, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#080C14]">
        <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-[#F59E0B] animate-spin"></div>
      </div>
    );
  }

  // Check both localStorage and sessionStorage for token
  const token = localStorage.getItem('logivision_token') || sessionStorage.getItem('logivision_token');
  const currentRole = role || user?.role || localStorage.getItem('logivision_role') || sessionStorage.getItem('logivision_role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && currentRole && !allowedRoles.includes('ALL') && !allowedRoles.includes(currentRole)) {
    // Redirect based on their actual role if they try to access unauthorized path
    switch (currentRole) {
      case 'GUARD': return <Navigate to="/guard" replace />;
      case 'DRIVER': return <Navigate to="/driver" replace />;
      case 'WAREHOUSE_MANAGER': return <Navigate to="/manager/dashboard" replace />;
      case 'AUTHORITY': return <Navigate to="/authority/dashboard" replace />;
      case 'ADMIN': return <Navigate to="/admin/dashboard" replace />;
      default: return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
