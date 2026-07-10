import React, { useState, useEffect } from 'react';
import { saveWithdrawInfo, submitWithdrawRequest, getWithdrawInfo, getGlobalSettings } from '../services/firebase';
import toast from 'react-hot-toast';

const WithdrawModal = ({ isOpen, onClose, userId, balance, userEmail }) => {
  const [step, setStep] = useState(1);
  const [minWithdraw, setMinWithdraw] = useState(0.01);
  const [withdrawInfo, setWithdrawInfo] = useState({
    ibn: '',
    fullName: '',
    email: userEmail || '',
    phone: ''
  });
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadWithdrawInfo();
      loadMinWithdraw();
      setAmount(''); // Reset amount on open
    }
  }, [isOpen, userId]);

  const loadMinWithdraw = async () => {
    try {
      const settings = await getGlobalSettings();
      if (settings) {
        setMinWithdraw(settings.minWithdraw || 0.01);
      }
    } catch (error) {
      console.error('Failed to load min withdraw:', error);
    }
  };

  const loadWithdrawInfo = async () => {
    try {
      const info = await getWithdrawInfo(userId);
      if (info) {
        setWithdrawInfo({
          ibn: info.ibn || '',
          fullName: info.fullName || '',
          email: info.email || userEmail || '',
          phone: info.phone || ''
        });
        if (info.isComplete) setStep(2);
      }
    } catch (error) {
      console.error('Failed to load withdraw info:', error);
    }
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    
    if (!withdrawInfo.ibn || !withdrawInfo.fullName || !withdrawInfo.email) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const result = await saveWithdrawInfo(userId, withdrawInfo);
      if (result.success) {
        toast.success('Information saved!');
        setStep(2);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to save information');
    }
    setLoading(false);
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    
    const withdrawAmount = parseFloat(amount);
    
    console.log('🔍 Withdraw validation:', {
      withdrawAmount,
      minWithdraw,
      balance,
      isNaN: isNaN(withdrawAmount)
    });
    
    if (!amount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (withdrawAmount < minWithdraw) {
      toast.error(`Minimum withdraw amount is $${minWithdraw.toFixed(2)}`);
      return;
    }
    
    if (withdrawAmount > balance) {
      toast.error(`Insufficient balance! You have $${balance.toFixed(4)}`);
      return;
    }

    setLoading(true);
    try {
      console.log('📤 Submitting withdraw:', { userId, amount: withdrawAmount });
      const result = await submitWithdrawRequest(userId, withdrawAmount);
      
      console.log('📥 Withdraw result:', result);
      
      if (result.success) {
        toast.success('✅ Withdraw request submitted!');
        toast.success('💸 Funds will arrive in 24 hours', { duration: 5000 });
        setAmount('');
        setStep(1);
        onClose();
      } else {
        toast.error(result.error || 'Withdraw failed');
      }
    } catch (error) {
      console.error('❌ Withdraw error:', error);
      toast.error('Withdraw failed. Please try again.');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  // 🔥 Safe balance display
  const safeBalance = typeof balance === 'number' ? balance : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.85)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget && !loading) onClose();
    }}
    >
      <div style={{
        background: '#1a1a2e',
        borderRadius: '20px',
        padding: '30px',
        maxWidth: '450px',
        width: '100%',
        border: '1px solid #6c63ff',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={() => { if (!loading) onClose(); }}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            color: '#f87171',
            fontSize: '1.5rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            zIndex: 1,
            opacity: loading ? 0.5 : 1
          }}
          disabled={loading}
        >
          ✕
        </button>

        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ color: '#fff', margin: 0, textAlign: 'center' }}>
            {step === 1 ? '📝 Withdraw Information' : '💸 Withdraw Funds'}
          </h2>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSaveInfo}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#b0b0c0', display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>
                Full Name *
              </label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={withdrawInfo.fullName}
                onChange={(e) => setWithdrawInfo({...withdrawInfo, fullName: e.target.value})}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#16213e',
                  border: '1px solid #2a2a4a',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#b0b0c0', display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>
                Email *
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={withdrawInfo.email}
                onChange={(e) => setWithdrawInfo({...withdrawInfo, email: e.target.value})}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#16213e',
                  border: '1px solid #2a2a4a',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#b0b0c0', display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>
                IBN (Bank Account Number) *
              </label>
              <input
                type="text"
                placeholder="Enter your bank account number"
                value={withdrawInfo.ibn}
                onChange={(e) => setWithdrawInfo({...withdrawInfo, ibn: e.target.value})}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#16213e',
                  border: '1px solid #2a2a4a',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#b0b0c0', display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>
                Phone (Optional)
              </label>
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={withdrawInfo.phone}
                onChange={(e) => setWithdrawInfo({...withdrawInfo, phone: e.target.value})}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#16213e',
                  border: '1px solid #2a2a4a',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#3a3a5a' : 'linear-gradient(135deg, #6c63ff, #e040fb)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '⏳ Saving...' : '💾 Save & Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleWithdraw}>
            {/* Balance Display */}
            <div style={{
              background: 'linear-gradient(135deg, #16213e, #1a1a3e)',
              padding: '20px',
              borderRadius: '15px',
              marginBottom: '20px',
              textAlign: 'center',
              border: '1px solid #2a2a4a'
            }}>
              <p style={{ color: '#b0b0c0', marginBottom: '5px', fontSize: '0.9rem' }}>
                Available Balance
              </p>
              <h1 style={{ color: '#ffd700', fontSize: '2rem', margin: 0 }}>
                ${safeBalance.toFixed(4)}
              </h1>
              <p style={{ color: '#6a6a8a', fontSize: '0.75rem', marginTop: '5px' }}>
                Min withdraw: ${minWithdraw.toFixed(2)}
              </p>
            </div>

            {/* Amount Input */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#b0b0c0', display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>
                Amount to Withdraw *
              </label>
              <input
                type="number"
                placeholder="0.0000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.0001"
                min={minWithdraw}
                max={safeBalance}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#16213e',
                  border: `2px solid ${amount && parseFloat(amount) > safeBalance ? '#f87171' : '#ffd700'}`,
                  borderRadius: '12px',
                  color: amount && parseFloat(amount) > safeBalance ? '#f87171' : '#ffd700',
                  fontSize: '1.3rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
              {amount && parseFloat(amount) > safeBalance && (
                <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '5px', textAlign: 'center' }}>
                  ⚠️ Amount exceeds your balance!
                </p>
              )}
            </div>

            {/* Quick Amount Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
              {[0.01, 0.05, 0.10].map(quickAmount => (
                <button
                  key={quickAmount}
                  type="button"
                  onClick={() => setAmount(quickAmount.toString())}
                  disabled={loading || quickAmount > safeBalance}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: amount === quickAmount.toString() ? '#6c63ff' : '#2a2a4a',
                    border: 'none',
                    borderRadius: '8px',
                    color: quickAmount > safeBalance ? '#6a6a8a' : '#fff',
                    cursor: quickAmount > safeBalance || loading ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: amount === quickAmount.toString() ? 'bold' : 'normal',
                    minWidth: '50px',
                    opacity: quickAmount > safeBalance ? 0.5 : 1
                  }}
                >
                  ${quickAmount.toFixed(2)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(safeBalance.toString())}
                disabled={loading || safeBalance <= 0}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: amount === safeBalance.toString() ? '#22c55e' : '#2a2a4a',
                  border: 'none',
                  borderRadius: '8px',
                  color: safeBalance <= 0 ? '#6a6a8a' : '#fff',
                  cursor: safeBalance <= 0 || loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: amount === safeBalance.toString() ? 'bold' : 'normal',
                  minWidth: '50px',
                  opacity: safeBalance <= 0 ? 0.5 : 1
                }}
              >
                MAX
              </button>
            </div>

            {/* Info Alert */}
            <div style={{
              background: 'rgba(74, 222, 128, 0.1)',
              border: '1px solid rgba(74, 222, 128, 0.3)',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '15px'
            }}>
              <p style={{ color: '#4ade80', fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>
                ✅ Funds arrive within <strong>24 hours</strong>
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { if (!loading) setStep(1); }}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#2a2a4a',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
                }}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading || safeBalance <= 0 || (amount && parseFloat(amount) > safeBalance)}
                style={{
                  flex: 2,
                  padding: '14px',
                  background: loading || safeBalance <= 0 ? '#3a3a5a' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  cursor: loading || safeBalance <= 0 ? 'not-allowed' : 'pointer',
                  opacity: loading || safeBalance <= 0 ? 0.5 : 1
                }}
              >
                {loading ? '⏳ Processing...' : safeBalance <= 0 ? '💰 No Balance' : '💸 Withdraw Now'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;