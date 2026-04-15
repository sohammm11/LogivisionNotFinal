import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './services/SocketProvider';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// To be built
import Login from './pages/Login';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import GuardApp from './pages/guard/GuardApp';
import DriverApp from './pages/driver/DriverApp';
import AdminDashboard from './pages/admin/AdminDashboard';
import Register from './pages/Register';

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>
            <BrowserRouter>
              <Suspense fallback={<div className="min-h-screen bg-[#080C14] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-t-2 border-[#F59E0B] animate-spin"></div></div>}>
                <Routes>
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Admin & Authority */}
                  <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'AUTHORITY']} />}>
                    <Route path="/admin/dashboard" element={
                      <ErrorBoundary><AdminDashboard /></ErrorBoundary>
                    } />
                  </Route>

                  {/* Warehouse Manager */}
                  <Route element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'ADMIN']} />}>
                    <Route path="/manager/dashboard" element={
                      <ErrorBoundary><ManagerDashboard /></ErrorBoundary>
                    } />
                  </Route>

                  {/* Guard */}
                  <Route element={<ProtectedRoute allowedRoles={['GUARD', 'ADMIN']} />}>
                    <Route path="/guard/*" element={
                      <ErrorBoundary><GuardApp /></ErrorBoundary>
                    } />
                  </Route>

                  {/* Driver */}
                  <Route element={<ProtectedRoute allowedRoles={['DRIVER', 'ADMIN']} />}>
                    <Route path="/driver/*" element={
                      <ErrorBoundary><DriverApp /></ErrorBoundary>
                    } />
                  </Route>

                  {/* Catch all to login */}
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
