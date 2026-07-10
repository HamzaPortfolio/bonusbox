import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { isAdminUser } from '../services/firebase';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#fff',
        gap: '20px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #2a2a4a',
          borderTop: '4px solid #6c63ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#a0a0b0' }}>Loading...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin route but user is not admin
  if (adminOnly && !isAdminUser(user.uid)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#fff',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{ fontSize: '5rem', marginBottom: '20px' }}>🚫</div>
        <h2 style={{ color: '#f87171', marginBottom: '10px' }}>Access Denied</h2>
        <p style={{ color: '#a0a0b0', marginBottom: '20px' }}>
          You don't have admin privileges
        </p>
        <a 
          href="/dashboard" 
          style={{
            background: '#6c63ff',
            padding: '12px 30px',
            borderRadius: '10px',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}
        >
          Go to Dashboard
        </a>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;