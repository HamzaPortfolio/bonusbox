import { database } from './firebase';
import { ref, get, update, serverTimestamp, increment } from 'firebase/database';

// Binance Pay API Configuration
const BINANCE_CONFIG = {
  // Binance Pay API Base URL
  API_BASE_URL: 'https://bpay.binanceapi.com',
  
  // Testnet URL (Testing ke liye)
  TESTNET_URL: 'https://testnet.binance.com',
  
  // Your Binance Pay API credentials
  API_KEY: 'YOUR_BINANCE_PAY_API_KEY',
  SECRET_KEY: 'YOUR_BINANCE_PAY_SECRET_KEY',
  MERCHANT_ID: 'YOUR_BINANCE_MERCHANT_ID',
  
  // Test mode (Production me false karna)
  TEST_MODE: true
};

export class PaymentService {
  constructor(userId) {
    this.userId = userId;
    this.userRef = ref(database, `users/${userId}`);
  }

  // ==========================================
  // BINANCE PAY API INTEGRATION
  // ==========================================

  async createBinancePayment(amount, recipientPayId, orderId) {
    try {
      console.log('💳 Creating Binance payment:', {
        amount,
        recipient: recipientPayId,
        orderId
      });

      const baseUrl = BINANCE_CONFIG.TEST_MODE ? BINANCE_CONFIG.TESTNET_URL : BINANCE_CONFIG.API_BASE_URL;
      
      // Binance Pay API endpoint
      const endpoint = `${baseUrl}/binancepay/openapi/v2/order`;

      // Nonce generation (timestamp + random)
      const nonce = Date.now().toString() + Math.random().toString(36).substr(2, 10);
      
      // Request body
      const body = {
        merchantId: BINANCE_CONFIG.MERCHANT_ID,
        subMerchantId: '',
        merchantTradeNo: orderId,
        tradeType: 'PAY_ID', // or 'WEB'
        totalAmount: amount.toFixed(8),
        currency: 'USDT',
        payType: 'PAY_ID',
        productType: 'EARNING_WITHDRAWAL',
        productName: 'Unity Ads Earning Withdrawal',
        payerIdentity: recipientPayId,
        buyer: {
          referenceUserId: this.userId
        }
      };

      // Generate signature
      const timestamp = Date.now();
      const signature = await this.generateSignature(body, timestamp, nonce);

      // Make API call
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'BinancePay-Timestamp': timestamp.toString(),
          'BinancePay-Nonce': nonce,
          'BinancePay-Certificate-SN': BINANCE_CONFIG.API_KEY,
          'BinancePay-Signature': signature
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      console.log('✅ Binance payment response:', data);

      if (data.status === 'SUCCESS') {
        // Save transaction to Firebase
        await this.saveWithdrawalRecord({
          orderId,
          amount,
          recipientPayId,
          binanceOrderId: data.data?.merchantTradeNo,
          status: 'completed',
          transactionHash: data.data?.transactionId
        });

        return {
          success: true,
          orderId: data.data?.merchantTradeNo,
          transactionId: data.data?.transactionId,
          message: 'Payment sent successfully!'
        };
      } else {
        // Save failed transaction
        await this.saveWithdrawalRecord({
          orderId,
          amount,
          recipientPayId,
          status: 'failed',
          errorMessage: data.errorMessage || 'Payment failed'
        });

        return {
          success: false,
          message: data.errorMessage || 'Payment failed'
        };
      }
    } catch (error) {
      console.error('❌ Binance payment error:', error);
      
      // Save failed transaction
      await this.saveWithdrawalRecord({
        orderId,
        amount,
        recipientPayId,
        status: 'failed',
        errorMessage: error.message
      });

      return {
        success: false,
        message: error.message
      };
    }
  }

  generateSignature(body, timestamp, nonce) {
    // In production, this should be done on your backend server
    // Client-side signing is not secure!
    // This is a placeholder - move this to your backend
    
    return new Promise((resolve) => {
      // Use HMAC-SHA512 for signature
      const payload = `${timestamp}\n${nonce}\n${JSON.stringify(body)}\n`;
      
      // In browser, use SubtleCrypto
      const encoder = new TextEncoder();
      const key = encoder.encode(BINANCE_CONFIG.SECRET_KEY);
      
      crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign']
      ).then(cryptoKey => {
        crypto.subtle.sign(
          'HMAC',
          cryptoKey,
          encoder.encode(payload)
        ).then(signature => {
          const hexSignature = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
          resolve(hexSignature);
        });
      });
    });
  }

  // ==========================================
  // WITHDRAWAL SYSTEM
  // ==========================================

  async requestWithdrawal(amount, binancePayId) {
    try {
      console.log('💰 Processing withdrawal:', {
        userId: this.userId,
        amount,
        binancePayId
      });

      // Validate minimum withdrawal
      const MIN_WITHDRAWAL = 0.15; // Minimum $0.15 (125 ads × $0.0012)
      
      if (amount < MIN_WITHDRAWAL) {
        throw new Error(`Minimum withdrawal is $${MIN_WITHDRAWAL}. You need ${Math.ceil(MIN_WITHDRAWAL / 0.0012)} more ads.`);
      }

      // Get current balance
      const balance = await this.getBalance();
      
      if (amount > balance) {
        throw new Error(`Insufficient balance. Your balance: $${balance.toFixed(4)}`);
      }

      // Generate order ID
      const orderId = `WD_${this.userId}_${Date.now()}`;

      // Update wallet - deduct amount
      await this.deductBalance(amount);

      // Send to Binance
      const result = await this.createBinancePayment(amount, binancePayId, orderId);

      if (result.success) {
        // Update total withdrawn
        await this.updateTotalWithdrawn(amount);
        
        console.log('✅ Withdrawal successful:', result);
        return {
          success: true,
          message: `$${amount.toFixed(4)} sent to Binance Pay ID: ${binancePayId}`,
          transactionId: result.transactionId
        };
      } else {
        // Refund on failure
        await this.refundBalance(amount);
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('❌ Withdrawal error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // ==========================================
  // AUTO-DISTRIBUTE EARNINGS FROM UNITY ADS
  // ==========================================

  async autoDistributeEarning(amount = 0.0012) {
    try {
      console.log('💎 Auto-distributing earning:', amount);

      // Update wallet balance in real-time
      const updates = {
        'wallet/balance': increment(amount),
        'wallet/totalEarned': increment(amount),
        'wallet/lastUpdated': serverTimestamp(),
        'dailyTurns/totalTurnsToday': increment(1),
        'dailyTurns/turnsLeft': increment(-1)
      };

      await update(this.userRef, updates);

      // Check if auto-withdrawal threshold reached
      const newBalance = await this.getBalance();
      const autoWithdrawThreshold = await this.getAutoWithdrawThreshold();

      if (autoWithdrawThreshold && newBalance >= autoWithdrawThreshold.amount) {
        const binancePayId = await this.getUserBinancePayId();
        
        if (binancePayId) {
          console.log('🔄 Auto-withdrawal triggered!');
          await this.requestWithdrawal(newBalance, binancePayId);
        }
      }

      return {
        success: true,
        amount: amount,
        newBalance: newBalance
      };
    } catch (error) {
      console.error('❌ Auto-distribute error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // ==========================================
  // DATABASE HELPER FUNCTIONS
  // ==========================================

  async getBalance() {
    const snapshot = await get(ref(database, `users/${this.userId}/wallet/balance`));
    return snapshot.val() || 0;
  }

  async getTotalEarned() {
    const snapshot = await get(ref(database, `users/${this.userId}/wallet/totalEarned`));
    return snapshot.val() || 0;
  }

  async deductBalance(amount) {
    await update(this.userRef, {
      'wallet/balance': increment(-amount),
      'wallet/lastUpdated': serverTimestamp()
    });
  }

  async refundBalance(amount) {
    await update(this.userRef, {
      'wallet/balance': increment(amount),
      'wallet/lastUpdated': serverTimestamp()
    });
  }

  async updateTotalWithdrawn(amount) {
    await update(this.userRef, {
      'wallet/totalWithdrawn': increment(amount)
    });
  }

  async saveWithdrawalRecord(data) {
    const withdrawRef = ref(database, `users/${this.userId}/withdrawals/${data.orderId}`);
    await set(withdrawRef, {
      ...data,
      timestamp: serverTimestamp(),
      date: new Date().toISOString()
    });
  }

  async saveUserBinancePayId(binancePayId) {
    await update(this.userRef, {
      'binancePayId': binancePayId,
      'binancePayId_updatedAt': serverTimestamp()
    });
  }

  async getUserBinancePayId() {
    const snapshot = await get(ref(database, `users/${this.userId}/binancePayId`));
    return snapshot.val();
  }

  async setAutoWithdrawThreshold(amount) {
    await update(this.userRef, {
      'autoWithdrawSettings': {
        enabled: true,
        amount: amount,
        updatedAt: serverTimestamp()
      }
    });
  }

  async getAutoWithdrawThreshold() {
    const snapshot = await get(ref(database, `users/${this.userId}/autoWithdrawSettings`));
    return snapshot.val();
  }

  // Get withdrawal history
  async getWithdrawalHistory(limit = 20) {
    try {
      const snapshot = await get(ref(database, `users/${this.userId}/withdrawals`));
      const data = snapshot.val() || {};
      
      return Object.entries(data)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, limit)
        .map(([id, record]) => ({
          id,
          ...record
        }));
    } catch (error) {
      console.error('❌ Get withdrawals error:', error);
      return [];
    }
  }

  // Check if user can withdraw
  async canWithdraw(amount) {
    const balance = await this.getBalance();
    const minWithdrawal = 0.15;
    
    return {
      canWithdraw: balance >= amount && amount >= minWithdrawal,
      balance: balance,
      minRequired: minWithdrawal,
      remaining: Math.max(0, minWithdrawal - balance),
      adsNeeded: Math.ceil(Math.max(0, minWithdrawal - balance) / 0.0012)
    };
  }
}