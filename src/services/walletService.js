import { database, updateUserWallet, resetDailyTurns, getUserData, getGlobalSettings } from './firebase';
import { ref, get } from 'firebase/database';

export class WalletService {
  constructor(userId) {
    this.userId = userId;
    this.userRef = ref(database, `users/${userId}`);
  }

  async getBalance() {
    const data = await getUserData(this.userId);
    return data?.wallet?.balance || 0;
  }

  async getTotalEarned() {
    const data = await getUserData(this.userId);
    return data?.wallet?.totalEarned || 0;
  }

  async getTurnsLeft() {
    const data = await getUserData(this.userId);
    const settings = await getGlobalSettings();
    const dailyLimit = settings?.dailyTurnsLimit || 125;
    
    if (!data?.dailyTurns) return dailyLimit;
    
    const today = new Date().toDateString();
    
    if (data.dailyTurns.date !== today) {
      await this.resetTurns(dailyLimit);
      return dailyLimit;
    }
    
    return data.dailyTurns.turnsLeft ?? dailyLimit;
  }

  // 🔥 Accept dynamic earn amount
  async addEarnings(earnAmount = 0.0012) {
    const turnsLeft = await this.getTurnsLeft();
    
    if (turnsLeft <= 0) {
      throw new Error('Daily turns limit reached! Come back tomorrow.');
    }

    // Use dynamic earn amount
    await updateUserWallet(this.userId, earnAmount);
    
    const newBalance = await this.getBalance();

    return {
      earned: earnAmount,
      turnsLeft: turnsLeft - 1,
      newBalance: newBalance
    };
  }

  async getTotalTurnsToday() {
    const data = await getUserData(this.userId);
    return data?.dailyTurns?.totalTurnsToday || 0;
  }

  // 🔥 Accept dynamic daily limit
  async resetTurns(dailyLimit = 125) {
    await resetDailyTurns(this.userId, dailyLimit);
  }

  async canWatchAd() {
    const turnsLeft = await this.getTurnsLeft();
    return turnsLeft > 0;
  }
}