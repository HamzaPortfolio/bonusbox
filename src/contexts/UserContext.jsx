import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  onAuthChange, 
  loginWithEmail, 
  registerWithEmail, 
  logoutUser,
  createUserProfile,
  getUserData,
  listenToWallet,
  listenToTurns,
  getGlobalSettings,
  listenToSettings
} from '../services/firebase';
import { WalletService } from '../services/walletService';
import unityAdsService from '../services/unityAds';
import toast from 'react-hot-toast';

const UserContext = createContext(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({
    balance: 0,
    totalEarned: 0
  });
  const [turnsLeft, setTurnsLeft] = useState(125);
  const [totalTurnsToday, setTotalTurnsToday] = useState(0);
  const [adReady, setAdReady] = useState(false);
  const [walletService, setWalletService] = useState(null);
  
  // 🔥 Global Settings State
  const [globalSettings, setGlobalSettings] = useState({
    earnPerAd: 0.0012,
    dailyTurnsLimit: 125,
    minWithdraw: 0.01,
    adTimerSeconds: 3
  });

  // 🔥 Load Global Settings
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getGlobalSettings();
      if (settings) {
        console.log('🌍 Global settings loaded:', settings);
        setGlobalSettings({
          earnPerAd: settings.earnPerAd || 0.0012,
          dailyTurnsLimit: settings.dailyTurnsLimit || 125,
          minWithdraw: settings.minWithdraw || 0.01,
          adTimerSeconds: settings.adTimerSeconds || 3
        });
      }
    };
    
    loadSettings();

    // Real-time settings listener
    const unsubscribe = listenToSettings((settings) => {
      if (settings) {
        console.log('🔄 Global settings updated in real-time:', settings);
        setGlobalSettings({
          earnPerAd: settings.earnPerAd || 0.0012,
          dailyTurnsLimit: settings.dailyTurnsLimit || 125,
          minWithdraw: settings.minWithdraw || 0.01,
          adTimerSeconds: settings.adTimerSeconds || 3
        });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Initialize Unity Ads
  useEffect(() => {
    const initAds = async () => {
      try {
        console.log('🎮 Initializing Unity Ads...');
        await unityAdsService.initialize();
        setAdReady(true);
        console.log('✅ Unity Ads ready');
      } catch (error) {
        console.error('❌ Unity Ads failed:', error);
        toast.error('Ad service unavailable');
      }
    };

    initAds();

    const adCheckInterval = setInterval(() => {
      setAdReady(unityAdsService.isAdAvailable());
    }, 5000);

    return () => clearInterval(adCheckInterval);
  }, []);

  // Auth State Listener
  useEffect(() => {
    console.log('👂 Setting up auth listener...');
    
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      console.log('🔄 Auth state changed');
      
      if (firebaseUser) {
        console.log('✅ User authenticated:', firebaseUser.uid);
        console.log('📧 Email:', firebaseUser.email);
        
        setUser(firebaseUser);
        
        // 🔥 UNITY ADS KO USER ID SET KARO
        unityAdsService.setUserId(firebaseUser.uid);
        console.log('✅ Unity Ads linked to Firebase user:', firebaseUser.uid);
        
        // Create wallet service
        const ws = new WalletService(firebaseUser.uid);
        setWalletService(ws);
        
        // Get or create user profile in database
        let userData = await getUserData(firebaseUser.uid);
        
        if (!userData) {
          console.log('⚠️ No profile found, creating new one...');
          toast.loading('Setting up your account...');
          
          await createUserProfile(firebaseUser.uid, firebaseUser.email);
          userData = await getUserData(firebaseUser.uid);
          
          toast.dismiss();
          toast.success('Account setup complete! 🎉');
        }
        
        // Update state with user data
        if (userData) {
          console.log('📊 Loading user data...');
          console.log('💰 Balance:', userData.wallet?.balance);
          console.log('📺 Turns:', userData.dailyTurns?.turnsLeft);
          
          setWallet({
            balance: userData.wallet?.balance || 0,
            totalEarned: userData.wallet?.totalEarned || 0
          });
          
          // 🔥 Check for daily reset - Use global dailyTurnsLimit
          const today = new Date().toDateString();
          const dailyLimit = globalSettings.dailyTurnsLimit || 125;
          
          if (userData.dailyTurns?.date !== today) {
            console.log('🔄 New day detected, resetting turns to', dailyLimit);
            await ws.resetTurns(dailyLimit);
            setTurnsLeft(dailyLimit);
            setTotalTurnsToday(0);
          } else {
            // 🔥 Use saved turns or global limit
            setTurnsLeft(userData.dailyTurns?.turnsLeft ?? dailyLimit);
            setTotalTurnsToday(userData.dailyTurns?.totalTurnsToday ?? 0);
          }
          
          // Setup real-time listeners
          setupRealTimeListeners(firebaseUser.uid);
        }
      } else {
        console.log('❌ No user authenticated');
        
        // 🔥 LOGOUT PE UNITY ADS USER ID CLEAR KARO
        unityAdsService.setUserId(null);
        console.log('✅ Unity Ads user ID cleared');
        
        setUser(null);
        setWalletService(null);
        setWallet({ balance: 0, totalEarned: 0 });
        setTurnsLeft(globalSettings.dailyTurnsLimit || 125);
        setTotalTurnsToday(0);
      }
      
      setLoading(false);
      console.log('✅ Auth state processing complete');
    });

    return () => {
      console.log('🔌 Cleaning up auth listener');
      unsubscribe();
    };
  }, [globalSettings.dailyTurnsLimit]); // 🔥 Re-run when daily limit changes

  // Real-time database listeners
  const setupRealTimeListeners = (userId) => {
    console.log('👂 Setting up real-time listeners for:', userId);
    
    // Listen to wallet changes
    const unsubWallet = listenToWallet(userId, (walletData) => {
      if (walletData) {
        console.log('🔄 Real-time wallet update:', walletData);
        setWallet({
          balance: walletData.balance || 0,
          totalEarned: walletData.totalEarned || 0
        });
      }
    });
    
    // Listen to turns changes
    const unsubTurns = listenToTurns(userId, (turnsData) => {
      if (turnsData) {
        console.log('🔄 Real-time turns update:', turnsData);
        setTurnsLeft(turnsData.turnsLeft ?? globalSettings.dailyTurnsLimit ?? 125);
        setTotalTurnsToday(turnsData.totalTurnsToday ?? 0);
      }
    });
    
    // Cleanup listeners
    return () => {
      console.log('🔌 Cleaning up real-time listeners');
      unsubWallet();
      unsubTurns();
    };
  };

  const login = async (email, password) => {
    console.log('🔑 Login process started');
    setLoading(true);
    
    const result = await loginWithEmail(email, password);
    
    if (!result.success) {
      setLoading(false);
      throw new Error(result.error);
    }
    
    console.log('✅ Login successful');
    toast.success('Welcome back! 👋');
    return result;
  };

  const register = async (email, password) => {
    console.log('📝 Registration process started');
    setLoading(true);
    
    const result = await registerWithEmail(email, password);
    
    if (!result.success) {
      setLoading(false);
      throw new Error(result.error);
    }
    
    console.log('✅ Registration successful');
    toast.success('Account created successfully! 🎉');
    return result;
  };

  const logout = async () => {
    console.log('🚪 Logout process started');
    const result = await logoutUser();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    console.log('✅ Logout successful');
    toast.success('Logged out successfully');
  };

  const watchAd = () => {
    return new Promise((resolve, reject) => {
      if (!adReady) {
        reject(new Error('Ads not ready. Please wait.'));
        return;
      }

      if (!walletService) {
        reject(new Error('Wallet service not initialized'));
        return;
      }

      console.log('🎬 Starting ad watch process...');
      console.log('💰 Current earn rate:', globalSettings.earnPerAd);

      unityAdsService.showRewardedAd(
        // On ad completed
        async (reward) => {
          try {
            console.log('✅ Ad completed, processing reward...');
            
            // 🔥 Use global earn rate for earnings
            const earnAmount = globalSettings.earnPerAd || 0.0012;
            const result = await walletService.addEarnings(earnAmount);
            
            console.log('💰 Earnings added:', result);
            
            // Update local state (real-time listener will also update)
            setWallet(prev => ({
              balance: prev.balance + result.earned,
              totalEarned: prev.totalEarned + result.earned
            }));
            setTurnsLeft(result.turnsLeft);
            setTotalTurnsToday(prev => prev + 1);
            
            toast.success(`💰 Earned $${result.earned.toFixed(4)}!`, {
              icon: '💎',
              duration: 4000
            });
            
            resolve(result);
          } catch (error) {
            console.error('❌ Failed to add earnings:', error);
            toast.error(error.message || 'Failed to credit earnings');
            reject(error);
          }
        },
        // On ad failed
        (error) => {
          console.error('❌ Ad failed:', error);
          toast.error('Ad was not completed. Try again.');
          reject(new Error(error));
        },
        // On ad started
        () => {
          console.log('▶️ Ad started playing');
        }
      );
    });
  };

  const value = {
    user,
    loading,
    wallet,
    turnsLeft,
    totalTurnsToday,
    adReady,
    globalSettings, // 🔥 Expose global settings
    login,
    register,
    logout,
    watchAd
  };

  console.log('🔄 UserContext state:', {
    isAuthenticated: !!user,
    userId: user?.uid || 'none',
    balance: wallet.balance,
    turnsLeft,
    adReady,
    loading,
    earnRate: globalSettings.earnPerAd,
    dailyLimit: globalSettings.dailyTurnsLimit
  });

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export default UserContext;