import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import toast from 'react-hot-toast';

const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, register, user } = useUser();
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome back! 🎉');
      } else {
        await register(email, password);
        toast.success('Account created successfully! 🎉');
      }
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const errorMessage = error.message || 'An error occurred';
      
      // Firebase error messages
      if (errorMessage.includes('auth/user-not-found')) {
        setError('No account found with this email');
      } else if (errorMessage.includes('auth/wrong-password')) {
        setError('Invalid password');
      } else if (errorMessage.includes('auth/email-already-in-use')) {
        setError('Email already registered');
      } else if (errorMessage.includes('auth/weak-password')) {
        setError('Password is too weak');
      } else if (errorMessage.includes('auth/invalid-email')) {
        setError('Invalid email format');
      } else {
        setError(errorMessage);
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setConfirmPassword('');
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-logo">💰</div>
        <h1>{isLogin ? 'Welcome Back!' : 'Create Account'}</h1>
        <p>{isLogin ? 'Login to start earning' : 'Register and start earning today'}</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="input-group">
          <label>Email Address</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </div>

        {!isLogin && (
          <div className="input-group">
            <label>Confirm Password</label>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <button 
          type="submit" 
          className="auth-button"
          disabled={loading}
        >
          {loading ? (
            'Processing...'
          ) : isLogin ? (
            'Login to Continue'
          ) : (
            'Create Free Account'
          )}
        </button>
      </form>

      <div className="auth-toggle">
        {isLogin ? "Don't have an account?" : "Already have an account?"}
        <span onClick={toggleMode}>
          {isLogin ? 'Register' : 'Login'}
        </span>
      </div>

      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        background: '#16162a', 
        borderRadius: '12px',
        fontSize: '0.85rem',
        color: '#a0a0b0',
        textAlign: 'center'
      }}>
        <p>💡 <strong>Earn $0.0012</strong> per ad view</p>
        <p>📺 Watch up to <strong>125 ads</strong> daily</p>
        <p>💳 Daily earning potential: <strong>$0.15</strong></p>
      </div>
    </div>
  );
};

export default AuthScreen;