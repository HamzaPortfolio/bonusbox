import React, { useState, useEffect } from 'react';
import { getGlobalSettings, listenToSettings } from '../services/firebase';

const TurnsTracker = ({ turnsLeft, totalTurns, usedToday }) => {
  const [dailyLimit, setDailyLimit] = useState(125);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getGlobalSettings();
      if (settings) {
        setDailyLimit(settings.dailyTurnsLimit || 125);
      }
    };
    
    loadSettings();

    const unsubscribe = listenToSettings((settings) => {
      if (settings) {
        console.log('📺 TurnsTracker: Daily limit updated to', settings.dailyTurnsLimit);
        setDailyLimit(settings.dailyTurnsLimit || 125);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Calculate progress based on dynamic dailyLimit
  const effectiveTurns = totalTurns || dailyLimit;
  const progressPercentage = ((effectiveTurns - turnsLeft) / effectiveTurns) * 100;
  
  const getProgressColor = () => {
    if (progressPercentage < 50) return '#4ade80';
    if (progressPercentage < 80) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div className="turns-card">
      <div className="turns-header">
        <span className="turns-label">📺 Daily Turns Remaining</span>
        <span className="turns-count">
          {turnsLeft} / {dailyLimit}
        </span>
      </div>
      
      <div className="progress-bar-bg">
        <div 
          className="progress-bar-fill"
          style={{ 
            width: `${Math.min(progressPercentage, 100)}%`,
            background: getProgressColor()
          }}
        ></div>
      </div>
      
      <div className="turns-info">
        <span>Used: {usedToday || 0}</span>
        <span>Available: {turnsLeft}</span>
        <span>Daily Cap: {dailyLimit}</span>
      </div>
    </div>
  );
};

export default TurnsTracker;