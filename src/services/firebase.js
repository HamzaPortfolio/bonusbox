import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  update, 
  push,
  serverTimestamp,
  increment,
  onValue,
  off,
  query,
  orderByChild,
  limitToLast
} from 'firebase/database';

// 🔥 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDxZ9f7ttKPCyTe6TyoQ-92ioTd62RPnQ4",
  authDomain: "earningapp-c2966.firebaseapp.com",
  projectId: "earningapp-c2966",
  databaseURL: "https://earningapp-c2966-default-rtdb.firebaseio.com",
  storageBucket: "earningapp-c2966.appspot.com",
  messagingSenderId: "831459419555",
  appId: "1:831459419555:web:5a4a135e7aea642749e616"
};

// 🔥 ADMIN CONFIG
const ADMIN_UID = "X1KWZB5sxhavqA0q6CxZCTAC0Ey1";
const ADMIN_EMAIL = "imranhamza441@gmail.com";

console.log('🔥 Initializing Firebase...');

let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase App Initialized');
} catch (error) {
  console.error('❌ Firebase Init Error:', error);
  throw error;
}

export const auth = getAuth(app);
export const database = getDatabase(app);

console.log('✅ Auth & Database Ready');

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await update(ref(database, `users/${user.uid}`), {
      lastLogin: serverTimestamp(),
      email: user.email
    });
    
    return { success: true, user };
  } catch (error) {
    let message = 'Login failed';
    switch (error.code) {
      case 'auth/user-not-found': message = 'No account found'; break;
      case 'auth/wrong-password': message = 'Incorrect password'; break;
      case 'auth/invalid-email': message = 'Invalid email'; break;
      default: message = error.message;
    }
    return { success: false, error: message };
  }
};

export const registerWithEmail = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await createUserProfile(user.uid, email);
    return { success: true, user };
  } catch (error) {
    let message = 'Registration failed';
    switch (error.code) {
      case 'auth/email-already-in-use': message = 'Email already registered'; break;
      case 'auth/weak-password': message = 'Password too weak (min 6 chars)'; break;
      default: message = error.message;
    }
    return { success: false, error: message };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, (user) => {
    console.log('🔄 Auth state changed:', user ? user.uid : 'No user');
    callback(user);
  });
};

// ============================================
// DATABASE FUNCTIONS
// ============================================

export const createUserProfile = async (userId, email) => {
  try {
    const userRef = ref(database, `users/${userId}`);
    const today = new Date().toDateString();
    
    const userData = {
      userId: userId,
      email: email,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      isActive: true,
      isAdmin: email === ADMIN_EMAIL,
      
      wallet: {
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        lastUpdated: serverTimestamp(),
        currency: 'USD'
      },
      
      dailyTurns: {
        date: today,
        turnsLeft: 125,
        totalTurnsToday: 0,
        maxTurns: 125,
        lastResetDate: today
      },
      
      adHistory: {
        totalAdsWatched: 0,
        lastAdWatchedAt: null
      },
      
      withdrawInfo: {
        ibn: '',
        fullName: '',
        email: email,
        phone: '',
        isComplete: false
      },
      
      transactions: {},
      withdrawRequests: {},
      
      settings: {
        notifications: true,
        soundEnabled: true
      }
    };
    
    await set(userRef, userData);
    console.log('✅ User profile created:', userId);
    return true;
  } catch (error) {
    console.error('❌ Profile creation failed:', error);
    throw error;
  }
};

export const getUserData = async (userId) => {
  try {
    const snapshot = await get(ref(database, `users/${userId}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('❌ Get user data failed:', error);
    return null;
  }
};

export const updateUserWallet = async (userId, amount) => {
  try {
    const userRef = ref(database, `users/${userId}`);
    const transactionId = Date.now();
    
    const updates = {
      'wallet/balance': increment(amount),
      'wallet/totalEarned': increment(amount),
      'wallet/lastUpdated': serverTimestamp(),
      'dailyTurns/turnsLeft': increment(-1),
      'dailyTurns/totalTurnsToday': increment(1),
      'adHistory/totalAdsWatched': increment(1),
      'adHistory/lastAdWatchedAt': serverTimestamp(),
      [`transactions/${transactionId}`]: {
        type: 'ad_reward',
        amount: amount,
        timestamp: serverTimestamp(),
        status: 'credited'
      }
    };
    
    await update(userRef, updates);
    return transactionId;
  } catch (error) {
    console.error('❌ Wallet update failed:', error);
    throw error;
  }
};

export const resetDailyTurns = async (userId, dailyLimit = 125) => {
  try {
    const today = new Date().toDateString();
    await update(ref(database, `users/${userId}/dailyTurns`), {
      date: today,
      turnsLeft: dailyLimit,
      totalTurnsToday: 0,
      maxTurns: dailyLimit,
      lastResetDate: today
    });
    console.log('✅ Daily turns reset to:', dailyLimit);
    return true;
  } catch (error) {
    console.error('❌ Reset turns failed:', error);
    return false;
  }
};

export const listenToWallet = (userId, callback) => {
  const walletRef = ref(database, `users/${userId}/wallet`);
  return onValue(walletRef, (snapshot) => {
    if (callback && snapshot.exists()) callback(snapshot.val());
  });
};

export const listenToTurns = (userId, callback) => {
  const turnsRef = ref(database, `users/${userId}/dailyTurns`);
  return onValue(turnsRef, (snapshot) => {
    if (callback && snapshot.exists()) callback(snapshot.val());
  });
};

// ============================================
// WITHDRAW SYSTEM FUNCTIONS
// ============================================

export const saveWithdrawInfo = async (userId, withdrawData) => {
  try {
    const updates = {
      'withdrawInfo/ibn': withdrawData.ibn || '',
      'withdrawInfo/fullName': withdrawData.fullName || '',
      'withdrawInfo/email': withdrawData.email || '',
      'withdrawInfo/phone': withdrawData.phone || '',
      'withdrawInfo/isComplete': true,
      'withdrawInfo/updatedAt': serverTimestamp()
    };
    
    await update(ref(database, `users/${userId}`), updates);
    console.log('✅ Withdraw info saved');
    return { success: true };
  } catch (error) {
    console.error('❌ Save withdraw info failed:', error);
    return { success: false, error: error.message };
  }
};

export const getWithdrawInfo = async (userId) => {
  try {
    const snapshot = await get(ref(database, `users/${userId}/withdrawInfo`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    return null;
  }
};

// 🔥 FIXED: submitWithdrawRequest - Poora updated version
export const submitWithdrawRequest = async (userId, amount) => {
  try {
    console.log('💸 Submitting withdraw request...', { userId, amount });
    
    // Get user data
    const userData = await getUserData(userId);
    
    if (!userData) {
      return { success: false, error: 'User not found' };
    }
    
    if (!userData?.withdrawInfo?.isComplete) {
      return { success: false, error: 'Please complete your withdraw information first' };
    }
    
    if (!amount || amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }
    
    // Get current balance directly from userData
    const currentBalance = userData.wallet?.balance || 0;
    console.log('💰 Current balance:', currentBalance, 'Requested amount:', amount);
    
    // Check balance - with small buffer for floating point
    if (amount > currentBalance + 0.00001) {
      return { success: false, error: `Insufficient balance. You have $${currentBalance.toFixed(4)}` };
    }
    
    // Get global settings for min withdraw
    let minWithdraw = 0.01;
    try {
      const settingsSnapshot = await get(ref(database, 'settings/global'));
      if (settingsSnapshot.exists()) {
        const settings = settingsSnapshot.val();
        minWithdraw = settings.minWithdraw || 0.01;
      }
    } catch (e) {
      console.log('Using default min withdraw');
    }
    
    console.log('📋 Min withdraw:', minWithdraw);
    
    if (amount < minWithdraw) {
      return { success: false, error: `Minimum withdraw amount is $${minWithdraw.toFixed(2)}` };
    }
    
    // Generate request ID
    const requestId = push(ref(database, `users/${userId}/withdrawRequests`)).key;
    const timestamp = Date.now();
    
    const withdrawRequest = {
      requestId: requestId,
      userId: userId,
      userEmail: userData.email,
      userName: userData.withdrawInfo.fullName || 'User',
      userIBN: userData.withdrawInfo.ibn || 'N/A',
      userPhone: userData.withdrawInfo.phone || '',
      amount: amount,
      status: 'pending',
      requestedAt: serverTimestamp(),
      processedAt: null,
      adminNote: '',
      transactionRef: ''
    };
    
    console.log('📝 Creating withdraw request:', withdrawRequest);
    
    // Save in user's requests
    const userRequestRef = ref(database, `users/${userId}/withdrawRequests/${requestId}`);
    await set(userRequestRef, withdrawRequest);
    
    // Save in admin withdrawals list
    const adminRequestRef = ref(database, `withdrawals/${requestId}`);
    await set(adminRequestRef, withdrawRequest);
    
    // Deduct from user balance
    await update(ref(database, `users/${userId}/wallet`), {
      balance: increment(-amount),
      lastUpdated: serverTimestamp()
    });
    
    // Add transaction record
    await update(ref(database, `users/${userId}`), {
      [`transactions/${timestamp}`]: {
        type: 'withdraw_request',
        amount: -amount,
        requestId: requestId,
        status: 'pending',
        timestamp: serverTimestamp()
      }
    });
    
    console.log('✅ Withdraw request submitted:', requestId);
    return { 
      success: true, 
      requestId, 
      message: 'Withdraw request submitted! Funds will be transferred within 24 hours.' 
    };
  } catch (error) {
    console.error('❌ Withdraw request failed:', error);
    return { success: false, error: error.message || 'Withdraw failed' };
  }
};

export const getWithdrawHistory = async (userId) => {
  try {
    const snapshot = await get(ref(database, `users/${userId}/withdrawRequests`));
    if (snapshot.exists()) {
      const requests = snapshot.val();
      return Object.entries(requests)
        .sort(([a], [b]) => b - a)
        .map(([id, data]) => ({ id, ...data }));
    }
    return [];
  } catch (error) {
    return [];
  }
};

// ============================================
// ADMIN FUNCTIONS
// ============================================

export const isAdminUser = (userId) => {
  return userId === ADMIN_UID;
};

export const getAllUsers = async () => {
  try {
    const snapshot = await get(ref(database, 'users'));
    if (snapshot.exists()) {
      const users = snapshot.val();
      return Object.entries(users).map(([id, data]) => ({
        id,
        email: data.email,
        balance: data.wallet?.balance || 0,
        totalEarned: data.wallet?.totalEarned || 0,
        totalWithdrawn: data.wallet?.totalWithdrawn || 0,
        ibn: data.withdrawInfo?.ibn || 'Not set',
        fullName: data.withdrawInfo?.fullName || 'Not set',
        isAdmin: data.isAdmin || false,
        createdAt: data.createdAt,
        lastLogin: data.lastLogin
      }));
    }
    return [];
  } catch (error) {
    console.error('❌ Get all users failed:', error);
    return [];
  }
};

export const getAllWithdrawals = async () => {
  try {
    const snapshot = await get(ref(database, 'withdrawals'));
    if (snapshot.exists()) {
      const withdrawals = snapshot.val();
      return Object.entries(withdrawals)
        .sort(([a], [b]) => b - a)
        .map(([id, data]) => ({ id, ...data }));
    }
    return [];
  } catch (error) {
    console.error('❌ Get withdrawals failed:', error);
    return [];
  }
};

export const processWithdrawal = async (requestId, userId, transactionRef) => {
  try {
    const updates = {};
    updates[`withdrawals/${requestId}/status`] = 'completed';
    updates[`withdrawals/${requestId}/processedAt`] = serverTimestamp();
    updates[`withdrawals/${requestId}/adminNote`] = 'Payment sent';
    updates[`withdrawals/${requestId}/transactionRef`] = transactionRef || '';
    
    updates[`users/${userId}/withdrawRequests/${requestId}/status`] = 'completed';
    updates[`users/${userId}/withdrawRequests/${requestId}/processedAt`] = serverTimestamp();
    updates[`users/${userId}/withdrawRequests/${requestId}/transactionRef`] = transactionRef || '';
    updates[`users/${userId}/wallet/totalWithdrawn`] = increment(
      (await get(ref(database, `withdrawals/${requestId}/amount`))).val() || 0
    );
    
    await update(ref(database), updates);
    console.log('✅ Withdrawal processed:', requestId);
    return { success: true };
  } catch (error) {
    console.error('❌ Process withdrawal failed:', error);
    return { success: false, error: error.message };
  }
};

export const rejectWithdrawal = async (requestId, userId, reason) => {
  try {
    const amount = (await get(ref(database, `withdrawals/${requestId}/amount`))).val() || 0;
    
    const updates = {};
    updates[`withdrawals/${requestId}/status`] = 'rejected';
    updates[`withdrawals/${requestId}/processedAt`] = serverTimestamp();
    updates[`withdrawals/${requestId}/adminNote`] = reason || 'Request rejected';
    
    updates[`users/${userId}/withdrawRequests/${requestId}/status`] = 'rejected';
    updates[`users/${userId}/withdrawRequests/${requestId}/processedAt`] = serverTimestamp();
    updates[`users/${userId}/wallet/balance`] = increment(amount);
    
    await update(ref(database), updates);
    console.log('✅ Withdrawal rejected, amount refunded:', requestId);
    return { success: true };
  } catch (error) {
    console.error('❌ Reject withdrawal failed:', error);
    return { success: false, error: error.message };
  }
};

export const getAdminStats = async () => {
  try {
    const users = await getAllUsers();
    const withdrawals = await getAllWithdrawals();
    
    const totalUsers = users.length;
    const totalEarned = users.reduce((sum, u) => sum + (u.totalEarned || 0), 0);
    const totalWithdrawn = users.reduce((sum, u) => sum + (u.totalWithdrawn || 0), 0);
    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
    const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    
    return {
      totalUsers,
      totalEarned,
      totalWithdrawn,
      pendingCount: pendingWithdrawals.length,
      pendingAmount,
      pendingWithdrawals
    };
  } catch (error) {
    console.error('❌ Get admin stats failed:', error);
    return null;
  }
};

// ============================================
// GLOBAL SETTINGS FUNCTIONS
// ============================================

export const getGlobalSettings = async () => {
  try {
    console.log('📊 Fetching global settings...');
    const snapshot = await get(ref(database, 'settings/global'));
    
    if (snapshot.exists()) {
      const settings = snapshot.val();
      console.log('✅ Global settings loaded:', settings);
      return settings;
    }
    
    const defaults = {
      earnPerAd: 0.0012,
      dailyTurnsLimit: 125,
      minWithdraw: 0.01,
      adTimerSeconds: 3,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await set(ref(database, 'settings/global'), defaults);
    console.log('✅ Default settings created');
    return defaults;
  } catch (error) {
    console.error('❌ Get settings failed:', error);
    return {
      earnPerAd: 0.0012,
      dailyTurnsLimit: 125,
      minWithdraw: 0.01,
      adTimerSeconds: 3
    };
  }
};

export const updateGlobalSettings = async (settings) => {
  try {
    console.log('💾 Updating global settings...', settings);
    
    if (settings.earnPerAd <= 0 || settings.earnPerAd > 1) {
      throw new Error('Earn per ad must be between 0.0001 and 1');
    }
    if (settings.dailyTurnsLimit < 10 || settings.dailyTurnsLimit > 500) {
      throw new Error('Daily turns must be between 10 and 500');
    }
    if (settings.minWithdraw < 0.01) {
      throw new Error('Minimum withdraw must be at least 0.01');
    }
    
    const updates = {
      earnPerAd: settings.earnPerAd,
      dailyTurnsLimit: settings.dailyTurnsLimit,
      minWithdraw: settings.minWithdraw,
      adTimerSeconds: settings.adTimerSeconds || 3,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || 'admin'
    };
    
    await update(ref(database, 'settings/global'), updates);
    console.log('✅ Global settings updated successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Update settings failed:', error);
    return { success: false, error: error.message };
  }
};

export const listenToSettings = (callback) => {
  const settingsRef = ref(database, 'settings/global');
  
  const unsubscribe = onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      console.log('🔄 Settings updated in real-time');
      if (callback) callback(snapshot.val());
    }
  }, (error) => {
    console.error('❌ Settings listener error:', error);
  });
  
  return unsubscribe;
};

export { ADMIN_UID, ADMIN_EMAIL };

console.log('✅ All Firebase functions loaded');