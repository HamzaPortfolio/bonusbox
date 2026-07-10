import React, { useState, useEffect } from 'react';
import { getGlobalSettings, listenToSettings } from '../services/firebase';

const WalletCard = ({ balance, totalEarned }) => {
  const [earnRate, setEarnRate] = useState(0.0012);

  useEffect(() => {
    // Load settings on mount
    const loadSettings = async () => {
      const settings = await getGlobalSettings();
      if (settings) {
        setEarnRate(settings.earnPerAd || 0.0012);
      }
    };
    
    loadSettings();

    // Real-time settings listener
    const unsubscribe = listenToSettings((settings) => {
      if (settings) {
        console.log('💰 WalletCard: Earn rate updated to', settings.earnPerAd);
        setEarnRate(settings.earnPerAd || 0.0012);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <div className="wallet-card">
      <div className="wallet-label">💳 Current Balance</div>
      <div className="wallet-balance">
        ${typeof balance === 'number' ? balance.toFixed(4) : '0.0000'}
      </div>
      <div className="wallet-info">
        <span className="earn-rate">
          +${earnRate.toFixed(4)} / ad
        </span>
        <span className="total-earned">
          Total Earned: ${typeof totalEarned === 'number' ? totalEarned.toFixed(4) : '0.0000'}
        </span>
      </div>
    </div>
  );
};

export default WalletCard;