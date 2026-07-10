import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { isAdminUser, getGlobalSettings, listenToSettings, getWithdrawHistory } from '../services/firebase';
import WalletCard from './WalletCard';
import TurnsTracker from './TurnsTracker';
import WithdrawModal from './WithdrawModal';
import toast from 'react-hot-toast';
import './Dashboard.css';

const Dashboard = () => {
  const { user, wallet, turnsLeft, totalTurnsToday, adReady, logout, watchAd, globalSettings } = useUser();
  const [watchingAd, setWatchingAd] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [earnRate, setEarnRate] = useState(globalSettings?.earnPerAd || 0.0012);
  const [dailyLimit, setDailyLimit] = useState(globalSettings?.dailyTurnsLimit || 125);
  const [minWithdraw, setMinWithdraw] = useState(globalSettings?.minWithdraw || 0.01);
  const [withdrawHistory, setWithdrawHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  
  const isAdmin = user?.uid === "X1KWZB5sxhavqA0q6CxZCTAC0Ey1";

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getGlobalSettings();
        if (settings) {
          setEarnRate(settings.earnPerAd || 0.0012);
          setDailyLimit(settings.dailyTurnsLimit || 125);
          setMinWithdraw(settings.minWithdraw || 0.01);
        }
      } catch (error) { console.error('Failed to load settings:', error); }
    };
    loadSettings();
    let unsubscribe;
    try {
      unsubscribe = listenToSettings((settings) => {
        if (settings) {
          setEarnRate(settings.earnPerAd || 0.0012);
          setDailyLimit(settings.dailyTurnsLimit || 125);
          setMinWithdraw(settings.minWithdraw || 0.01);
        }
      });
    } catch (error) { console.error('Settings listener error:', error); }
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    if (user?.uid) loadWithdrawHistory();
  }, [user?.uid, showWithdraw]);

  const loadWithdrawHistory = async () => {
    try {
      const history = await getWithdrawHistory(user.uid);
      setWithdrawHistory(history || []);
    } catch (error) { console.error('Failed to load withdraw history:', error); }
  };

  const handleLogout = async () => {
    try { await logout(); navigate('/login', { replace: true }); }
    catch (error) { toast.error('Logout failed'); }
  };

  const handleWatchAd = async () => {
    if (watchingAd) return;
    if (turnsLeft <= 0) { toast.error('🚫 Daily limit reached! Come back tomorrow.'); return; }
    if (!adReady) { toast.error('Ads not ready. Please wait.'); return; }
    setWatchingAd(true);
    try { await watchAd(); }
    catch (error) { console.error('Watch ad error:', error); }
    finally { setWatchingAd(false); }
  };

  const getInitial = (email) => email ? email.charAt(0).toUpperCase() : 'U';
  const dailyPotential = (earnRate * dailyLimit).toFixed(4);
  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    try { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return 'N/A'; }
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: { cls: 'badge-pending', icon: '⏳' },
      processing: { cls: 'badge-processing', icon: '🔄' },
      completed: { cls: 'badge-completed', icon: '✅' },
      rejected: { cls: 'badge-rejected', icon: '❌' }
    };
    return map[status] || { cls: 'badge-default', icon: '📋' };
  };

  return (
    <div className="dashboard-app">
      {/* TOP BAR */}
      <header className="dash-topbar">
        <div className="dash-brand">
          <div className="dash-logo">💰</div>
          <div>
            <h1>BonusBox Ads Earner</h1>
            <span>Watch & Earn Rewards</span>
          </div>
        </div>
        <div className="dash-topbar-right">
          <div className="dash-user-chip">
            <div className="dash-avatar">{getInitial(user?.email)}</div>
            <div className="dash-user-info">
              <span className="dash-username">{user?.email?.split('@')[0]}</span>
              <span className="dash-email">{user?.email}</span>
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} className="dash-admin-btn">🔐 Admin Panel</button>
          )}
          <button onClick={handleLogout} className="dash-logout-btn">🚪 Logout</button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="dash-layout">
        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <div className="dash-balance-card">
            <span className="balance-label">Current Balance</span>
            <span className="balance-amount">${wallet.balance.toFixed(4)}</span>
            <span className="balance-earn">+${earnRate.toFixed(4)} per ad</span>
          </div>

          <div className="dash-turns-card">
            <div className="turns-header">
              <span>Daily Turns</span>
              <span>{turnsLeft}/{dailyLimit}</span>
            </div>
            <div className="turns-progress">
              <div className="turns-fill" style={{ width: `${Math.min(((dailyLimit - turnsLeft) / dailyLimit) * 100, 100)}%` }}></div>
            </div>
            <span className="turns-sub">Watched today: {totalTurnsToday}</span>
          </div>

          <div className="dash-stats">
            <div className="dash-stat-item">
              <span>Total Earned</span>
              <strong className="text-green">${wallet.totalEarned.toFixed(4)}</strong>
            </div>
            <div className="dash-stat-item">
              <span>Daily Potential</span>
              <strong className="text-gold">${dailyPotential}</strong>
            </div>
            <div className="dash-stat-item">
              <span>Min Withdraw</span>
              <strong className="text-cyan">${minWithdraw.toFixed(2)}</strong>
            </div>
            <div className="dash-stat-item">
              <span>Status</span>
              <strong className={adReady ? 'text-green' : 'text-red'}>{adReady ? '✅ Ready' : '⏳ Loading'}</strong>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="dash-main">
          
          {/* 🔥 WATCH AD BUTTON - PROMINENT FULL WIDTH */}
          <button 
            onClick={handleWatchAd} 
            disabled={turnsLeft === 0 || watchingAd || !adReady} 
            className={`watch-ad-btn-main ${turnsLeft === 0 || !adReady ? 'disabled' : ''}`}
          >
            <span className="wab-icon">{watchingAd ? '⏳' : '📺'}</span>
            <span className="wab-text">
              {watchingAd ? 'Watching Ad... Please wait' : turnsLeft === 0 ? '🚫 Daily Limit Reached - Come Back Tomorrow' : !adReady ? '🔄 Loading Ads... Please wait' : `Watch Ad & Earn $${earnRate.toFixed(4)}`}
            </span>
            {!watchingAd && turnsLeft > 0 && adReady && <span className="wab-arrow">▶️</span>}
          </button>

          {/* 🔥 WITHDRAW BUTTON */}
          <button onClick={() => setShowWithdraw(true)} className="withdraw-btn-main">
            <span className="wab-icon">💸</span>
            <span className="wab-text">Withdraw Earnings</span>
            <span className="wab-arrow">▶️</span>
          </button>

          {/* WITHDRAW HISTORY */}
          <div className="history-section">
            <button className="history-toggle" onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadWithdrawHistory(); }}>
              <span>📋 Withdraw History {withdrawHistory.length > 0 && <span className="history-count">{withdrawHistory.length}</span>}</span>
              <span className={`history-arrow ${showHistory ? 'open' : ''}`}>▼</span>
            </button>
            
            {showHistory && (
              <div className="history-list">
                {withdrawHistory.length === 0 ? (
                  <div className="history-empty">📭 No withdraw requests yet</div>
                ) : (
                  withdrawHistory.map((req, i) => {
                    const badge = getStatusBadge(req.status);
                    return (
                      <div key={req.id || i} className="history-item">
                        <div className="hi-top">
                          <span className={`status-badge ${badge.cls}`}>{badge.icon} {req.status}</span>
                          <span className="hi-date">{formatDate(req.requestedAt)}</span>
                        </div>
                        <div className="hi-details">
                          <div><span>Amount</span><strong className="text-gold">${req.amount?.toFixed(4)}</strong></div>
                          <div><span>IBN</span><code>{req.userIBN || 'N/A'}</code></div>
                        </div>
                        {req.adminNote && <div className="hi-note">📝 {req.adminNote}</div>}
                        {req.status === 'completed' && req.transactionRef && <div className="hi-ref">✅ Ref: {req.transactionRef}</div>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* INFO BAR */}
          <div className="info-bar">
            <span>💰 ${earnRate.toFixed(4)}/ad</span>
            <span>📺 {dailyLimit} daily limit</span>
            <span>🏦 Min withdraw: ${minWithdraw.toFixed(2)}</span>
            <span>⏱️ 24h processing</span>
          </div>
        </main>
      </div>

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdraw}
        onClose={() => { setShowWithdraw(false); loadWithdrawHistory(); }}
        userId={user?.uid}
        balance={wallet.balance}
        userEmail={user?.email}
      />
    </div>
  );
};

export default Dashboard;