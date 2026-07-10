import React, { useState, useEffect } from 'react';
import { 
  getAllUsers, 
  getAllWithdrawals, 
  processWithdrawal, 
  rejectWithdrawal, 
  getAdminStats,
  getGlobalSettings,
  updateGlobalSettings
} from '../services/firebase';
import { useUser } from '../contexts/UserContext';
import toast from 'react-hot-toast';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user } = useUser();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [transactionRefs, setTransactionRefs] = useState({});
  const [rejectReasons, setRejectReasons] = useState({});

  const [globalSettings, setGlobalSettings] = useState({
    earnPerAd: 0.0012,
    dailyTurnsLimit: 125,
    minWithdraw: 0.01,
    adTimerSeconds: 3
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadData();
    loadSettings();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const [adminStats, allUsers, allWithdrawals] = await Promise.all([
      getAdminStats(),
      getAllUsers(),
      getAllWithdrawals()
    ]);
    setStats(adminStats);
    setUsers(allUsers);
    setWithdrawals(allWithdrawals);
    setLoading(false);
  };

  const loadSettings = async () => {
    const settings = await getGlobalSettings();
    if (settings) setGlobalSettings(settings);
  };

  const handleSaveSettings = async () => {
    if (globalSettings.earnPerAd <= 0) { toast.error('Earn per ad must be greater than 0'); return; }
    if (globalSettings.dailyTurnsLimit <= 0 || globalSettings.dailyTurnsLimit > 500) { toast.error('Daily turns must be between 1-500'); return; }
    if (globalSettings.minWithdraw <= 0) { toast.error('Minimum withdraw must be greater than 0'); return; }

    setSavingSettings(true);
    const result = await updateGlobalSettings(globalSettings);
    setSavingSettings(false);

    if (result.success) {
      toast.success('✅ Global settings updated!');
    } else {
      toast.error(result.error || 'Failed to save settings');
    }
  };

  const handleProcess = async (requestId, userId) => {
    const ref = transactionRefs[requestId] || '';
    const result = await processWithdrawal(requestId, userId, ref);
    if (result.success) { toast.success('Withdrawal processed! ✅'); loadData(); }
    else { toast.error(result.error); }
  };

  const handleReject = async (requestId, userId) => {
    const reason = rejectReasons[requestId] || 'Request rejected by admin';
    const result = await rejectWithdrawal(requestId, userId, reason);
    if (result.success) { toast.success('Withdrawal rejected & refunded!'); loadData(); }
    else { toast.error(result.error); }
  };

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');
  const rejectedWithdrawals = withdrawals.filter(w => w.status === 'rejected');

  if (loading) {
    return (
      <div className="admin-app">
        <div className="admin-loader">
          <div className="loader-ring"></div>
          <p>Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      {/* SIDEBAR */}
      <aside className="admin-sidebar-full">
        <div className="sidebar-brand">
          <div className="brand-icon">⚡</div>
          <div className="brand-info">
            <h2>Admin Panel</h2>
            <span>BonusBox Ads Manager</span>
          </div>
        </div>

        <nav className="sidebar-nav-full">
          <button className={`nav-item ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            <span className="nav-icon">🟡</span>
            <div className="nav-content">
              <span className="nav-label">Pending</span>
              <span className="nav-desc">Withdraw requests</span>
            </div>
            <span className="nav-count">{pendingWithdrawals.length}</span>
          </button>

          <button className={`nav-item ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
            <span className="nav-icon">✅</span>
            <div className="nav-content">
              <span className="nav-label">Completed</span>
              <span className="nav-desc">Processed requests</span>
            </div>
            <span className="nav-count">{completedWithdrawals.length}</span>
          </button>

          <button className={`nav-item ${activeTab === 'rejected' ? 'active' : ''}`} onClick={() => setActiveTab('rejected')}>
            <span className="nav-icon">❌</span>
            <div className="nav-content">
              <span className="nav-label">Rejected</span>
              <span className="nav-desc">Declined requests</span>
            </div>
            <span className="nav-count">{rejectedWithdrawals.length}</span>
          </button>

          <div className="nav-divider"></div>

          <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            <span className="nav-icon">👥</span>
            <div className="nav-content">
              <span className="nav-label">All Users</span>
              <span className="nav-desc">Manage accounts</span>
            </div>
            <span className="nav-count">{users.length}</span>
          </button>

          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="nav-icon">⚙️</span>
            <div className="nav-content">
              <span className="nav-label">Settings</span>
              <span className="nav-desc">Global configuration</span>
            </div>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="footer-user">
            <div className="user-avatar">{user?.email?.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user?.email?.split('@')[0]}</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
          <button className="refresh-btn" onClick={() => { loadData(); loadSettings(); }} title="Refresh Data">
            🔄
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-main-full">
        {/* HEADER */}
        <header className="main-header">
          <div className="header-left">
            <h1 className="header-title">
              {activeTab === 'pending' && '🟡 Pending Withdrawals'}
              {activeTab === 'completed' && '✅ Completed Withdrawals'}
              {activeTab === 'rejected' && '❌ Rejected Withdrawals'}
              {activeTab === 'users' && '👥 User Management'}
              {activeTab === 'settings' && '⚙️ Global Settings'}
            </h1>
            <span className="header-subtitle">
              {activeTab === 'pending' && `${pendingWithdrawals.length} requests waiting for approval`}
              {activeTab === 'completed' && `${completedWithdrawals.length} requests processed`}
              {activeTab === 'rejected' && `${rejectedWithdrawals.length} requests declined`}
              {activeTab === 'users' && `${users.length} registered users`}
              {activeTab === 'settings' && 'Configure app-wide settings'}
            </span>
          </div>
          <div className="header-right">
            <div className="header-stat">
              <span className="hs-label">Balance</span>
              <span className="hs-value">${stats?.totalEarned?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="header-stat">
              <span className="hs-label">Pending</span>
              <span className="hs-value highlight">{stats?.pendingCount || 0}</span>
            </div>
          </div>
        </header>

        {/* STATS CARDS */}
        {stats && activeTab !== 'settings' && (
          <div className="stats-cards-row">
            <div className="stats-card purple-glow">
              <div className="sc-icon">👥</div>
              <div className="sc-info">
                <span className="sc-value">{stats.totalUsers}</span>
                <span className="sc-label">Total Users</span>
              </div>
            </div>
            <div className="stats-card green-glow">
              <div className="sc-icon">💰</div>
              <div className="sc-info">
                <span className="sc-value">${stats.totalEarned.toFixed(4)}</span>
                <span className="sc-label">Total Earned</span>
              </div>
            </div>
            <div className="stats-card amber-glow">
              <div className="sc-icon">💸</div>
              <div className="sc-info">
                <span className="sc-value">${stats.totalWithdrawn.toFixed(4)}</span>
                <span className="sc-label">Total Withdrawn</span>
              </div>
            </div>
            <div className="stats-card red-glow">
              <div className="sc-icon">⏳</div>
              <div className="sc-info">
                <span className="sc-value">{stats.pendingCount}</span>
                <span className="sc-label">Pending Requests</span>
              </div>
            </div>
            <div className="stats-card pink-glow">
              <div className="sc-icon">💎</div>
              <div className="sc-info">
                <span className="sc-value">${stats.pendingAmount.toFixed(4)}</span>
                <span className="sc-label">Pending Amount</span>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT AREA */}
        <div className="content-area">
          {activeTab === 'pending' && (
            <WithdrawalTable 
              withdrawals={pendingWithdrawals} 
              showActions={true} 
              onProcess={handleProcess} 
              onReject={handleReject} 
              transactionRefs={transactionRefs} 
              setTransactionRefs={setTransactionRefs} 
            />
          )}
          {activeTab === 'completed' && (
            <WithdrawalTable withdrawals={completedWithdrawals} showActions={false} />
          )}
          {activeTab === 'rejected' && (
            <WithdrawalTable withdrawals={rejectedWithdrawals} showActions={false} />
          )}
          {activeTab === 'users' && (
            <UsersTable users={users} />
          )}
          {activeTab === 'settings' && (
            <SettingsPanel 
              settings={globalSettings} 
              setSettings={setGlobalSettings} 
              onSave={handleSaveSettings} 
              saving={savingSettings} 
            />
          )}
        </div>
      </main>
    </div>
  );
};

// ============================================
// WITHDRAWAL TABLE
// ============================================
const WithdrawalTable = ({ withdrawals, showActions, onProcess, onReject, transactionRefs, setTransactionRefs }) => {
  if (withdrawals.length === 0) {
    return (
      <div className="empty-content">
        <div className="empty-icon">📭</div>
        <h3>No Data Found</h3>
        <p>There are no items to display in this section.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="full-table">
        <thead>
          <tr>
            <th>User Details</th>
            <th>Bank Info</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Status</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {withdrawals.map(w => (
            <tr key={w.id}>
              <td>
                <div className="user-td">
                  <span className="user-td-name">{w.userName || 'Unknown'}</span>
                  <span className="user-td-email">{w.userEmail}</span>
                </div>
              </td>
              <td>
                <span className="ibn-code">{w.userIBN || 'N/A'}</span>
              </td>
              <td className="amount-td">${w.amount?.toFixed(4)}</td>
              <td className="date-td">
                {w.requestedAt ? new Date(w.requestedAt).toLocaleDateString() : '-'}
              </td>
              <td>
                <span className={`status-pill status-${w.status}`}>
                  {w.status}
                </span>
              </td>
              {showActions && (
                <td>
                  <div className="actions-group">
                    <input
                      type="text"
                      placeholder="Transaction Ref"
                      value={transactionRefs[w.id] || ''}
                      onChange={(e) => setTransactionRefs({...transactionRefs, [w.id]: e.target.value})}
                      className="ref-input"
                    />
                    <button onClick={() => onProcess(w.id, w.userId)} className="action-approve" title="Approve">
                      ✅
                    </button>
                    <button onClick={() => onReject(w.id, w.userId)} className="action-deny" title="Reject">
                      ❌
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// USERS TABLE
// ============================================
const UsersTable = ({ users }) => {
  if (users.length === 0) {
    return (
      <div className="empty-content">
        <div className="empty-icon">👥</div>
        <h3>No Users Found</h3>
        <p>Users will appear here once they register.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="full-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Full Name</th>
            <th>IBN</th>
            <th>Balance</th>
            <th>Total Earned</th>
            <th>Total Withdrawn</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td className="email-td">{u.email}</td>
              <td>{u.fullName || '-'}</td>
              <td><span className="ibn-code">{u.ibn || '-'}</span></td>
              <td className="amount-td gold">${u.balance?.toFixed(4)}</td>
              <td className="amount-td green">${u.totalEarned?.toFixed(4)}</td>
              <td className="amount-td amber">${u.totalWithdrawn?.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// SETTINGS PANEL
// ============================================
const SettingsPanel = ({ settings, setSettings, onSave, saving }) => {
  return (
    <div className="settings-full">
      <div className="settings-grid-2col">
        {/* Earn Per Ad */}
        <div className="setting-card-full">
          <div className="setting-header">
            <span className="setting-icon">💰</span>
            <div>
              <h4>Earn Per Ad</h4>
              <p>Amount users earn per ad view</p>
            </div>
          </div>
          <div className="setting-body">
            <div className="current-display gold-bg">
              <span className="current-label">Current Rate</span>
              <span className="current-value-large">${settings.earnPerAd.toFixed(4)}</span>
              <span className="current-sub">per advertisement</span>
            </div>
            <input
              type="number"
              value={settings.earnPerAd}
              onChange={(e) => setSettings({...settings, earnPerAd: parseFloat(e.target.value) || 0})}
              step="0.0001"
              min="0.0001"
              max="1"
              className="setting-input-lg"
            />
            <div className="quick-options">
              <span>Quick Set:</span>
              {[0.0001, 0.0005, 0.001, 0.0012, 0.002, 0.005, 0.01].map(v => (
                <button key={v} className={`qo-btn ${settings.earnPerAd === v ? 'active' : ''}`} onClick={() => setSettings({...settings, earnPerAd: v})}>
                  ${v.toFixed(4)}
                </button>
              ))}
            </div>
            <p className="potential-text">
              Daily potential: <strong>${(settings.earnPerAd * settings.dailyTurnsLimit).toFixed(4)}</strong> per user
            </p>
          </div>
        </div>

        {/* Daily Turns */}
        <div className="setting-card-full">
          <div className="setting-header">
            <span className="setting-icon">📺</span>
            <div>
              <h4>Daily Turns Limit</h4>
              <p>Maximum ads per user per day</p>
            </div>
          </div>
          <div className="setting-body">
            <div className="current-display cyan-bg">
              <span className="current-label">Current Limit</span>
              <span className="current-value-large">{settings.dailyTurnsLimit}</span>
              <span className="current-sub">ads per day</span>
            </div>
            <input
              type="range"
              value={settings.dailyTurnsLimit}
              onChange={(e) => setSettings({...settings, dailyTurnsLimit: parseInt(e.target.value)})}
              min="10"
              max="500"
              step="5"
              className="range-slider"
            />
            <div className="range-with-input">
              <input
                type="number"
                value={settings.dailyTurnsLimit}
                onChange={(e) => setSettings({...settings, dailyTurnsLimit: Math.min(500, Math.max(10, parseInt(e.target.value) || 10))})}
                className="setting-input-sm"
              />
              <span>ads/day</span>
            </div>
            <div className="quick-options">
              <span>Quick Set:</span>
              {[25, 50, 100, 125, 150, 200, 300, 500].map(v => (
                <button key={v} className={`qo-btn ${settings.dailyTurnsLimit === v ? 'active' : ''}`} onClick={() => setSettings({...settings, dailyTurnsLimit: v})}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Min Withdraw */}
        <div className="setting-card-full">
          <div className="setting-header">
            <span className="setting-icon">🏦</span>
            <div>
              <h4>Minimum Withdraw</h4>
              <p>Minimum amount to request withdrawal</p>
            </div>
          </div>
          <div className="setting-body">
            <div className="current-display green-bg">
              <span className="current-label">Current Minimum</span>
              <span className="current-value-large">${settings.minWithdraw.toFixed(2)}</span>
              <span className="current-sub">USD</span>
            </div>
            <div className="range-with-input">
              <input
                type="number"
                value={settings.minWithdraw}
                onChange={(e) => setSettings({...settings, minWithdraw: parseFloat(e.target.value) || 0})}
                step="0.01"
                min="0.01"
                className="setting-input-sm"
              />
              <span>USD</span>
            </div>
            <div className="quick-options">
              <span>Quick Set:</span>
              {[0.01, 0.05, 0.10, 0.50, 1.00, 5.00].map(v => (
                <button key={v} className={`qo-btn ${settings.minWithdraw === v ? 'active' : ''}`} onClick={() => setSettings({...settings, minWithdraw: v})}>
                  ${v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ad Timer */}
        <div className="setting-card-full">
          <div className="setting-header">
            <span className="setting-icon">⏱️</span>
            <div>
              <h4>Ad Timer</h4>
              <p>Simulated ad duration in seconds</p>
            </div>
          </div>
          <div className="setting-body">
            <div className="current-display amber-bg">
              <span className="current-label">Current Timer</span>
              <span className="current-value-large">{settings.adTimerSeconds}s</span>
              <span className="current-sub">seconds</span>
            </div>
            <input
              type="range"
              value={settings.adTimerSeconds}
              onChange={(e) => setSettings({...settings, adTimerSeconds: parseInt(e.target.value)})}
              min="2"
              max="10"
              className="range-slider"
            />
            <div className="timer-display">
              {[2,3,4,5,6,7,8,9,10].map(v => (
                <button key={v} className={`qo-btn ${settings.adTimerSeconds === v ? 'active' : ''}`} onClick={() => setSettings({...settings, adTimerSeconds: v})}>
                  {v}s
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button onClick={onSave} disabled={saving} className="save-settings-btn">
        {saving ? '⏳ Saving Changes...' : '💾 Save All Settings'}
      </button>
    </div>
  );
};

export default AdminDashboard;