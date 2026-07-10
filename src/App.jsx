import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { UserProvider } from './contexts/UserContext';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <Router>
      <UserProvider>
        <Toaster 
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e1e2f',
              color: '#ffffff',
              border: '2px solid #6c63ff',
              borderRadius: '12px',
              padding: '16px',
            },
            success: {
              iconTheme: {
                primary: '#4ade80',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#f87171',
                secondary: '#ffffff',
              },
            },
          }}
        />
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<AuthScreen />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            {/* 🔥 ADMIN ROUTE */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </UserProvider>
    </Router>
  );
}

export default App;