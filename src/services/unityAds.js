import { updateUserWallet, getUserData } from './firebase';

class UnityAdsService {
  constructor() {
    this.isInitialized = false;
    this.isAdReady = false;
    this.adUnitId = 'Rewarded_Android'; // Apna Unity Ad Unit ID
    this.gameId = '800083734'; // Apna Unity Game ID
    this.onAdCompletedCallback = null;
    this.onAdFailedCallback = null;
    this.onAdStartedCallback = null;
    this.currentUserId = null; // Firebase User ID store karega
  }

  // ✅ User ID set karne ka method
  setUserId(userId) {
    this.currentUserId = userId;
    console.log('👤 Unity Ads User ID set:', userId);
  }

  initialize() {
    return new Promise((resolve, reject) => {
      console.log('🎮 Unity Ads Service Initializing...');
      console.log('📋 Game ID:', this.gameId);
      console.log('📋 Ad Unit ID:', this.adUnitId);
      
      // Check if Unity Ads SDK is loaded
      if (typeof window.unityAds === 'undefined') {
        console.log('⏳ Unity Ads SDK not loaded, waiting...');
        
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkInterval = setInterval(() => {
          attempts++;
          
          if (typeof window.unityAds !== 'undefined') {
            clearInterval(checkInterval);
            console.log('✅ Unity Ads SDK found');
            this.setupUnityAds(resolve, reject);
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            console.log('⚠️ Unity Ads SDK not available, simulation mode');
            this.setupSimulationMode(resolve);
          }
        }, 200);
      } else {
        console.log('✅ Unity Ads SDK already loaded');
        this.setupUnityAds(resolve, reject);
      }
    });
  }

  setupSimulationMode(resolve) {
    console.log('🖥️ Browser simulation mode activated');
    this.isInitialized = true;
    this.isAdReady = true;
    resolve(true);
  }

  setupUnityAds(resolve, reject) {
    try {
      console.log('🔧 Setting up Real Unity Ads...');
      
      window.unityAds.initialize(this.gameId, true); // true = test mode

      this.registerEventListeners();

      let initAttempts = 0;
      const maxInitAttempts = 30;
      
      const checkInit = setInterval(() => {
        initAttempts++;
        
        if (window.unityAds && window.unityAds.isInitialized) {
          clearInterval(checkInit);
          this.isInitialized = true;
          console.log('✅ Real Unity Ads initialized');
          this.loadAd();
          resolve(true);
        } else if (initAttempts >= maxInitAttempts) {
          clearInterval(checkInit);
          console.log('⚠️ Unity init timeout, simulation mode');
          this.setupSimulationMode(resolve);
        }
      }, 300);

      setTimeout(() => {
        clearInterval(checkInit);
        if (!this.isInitialized) {
          console.log('⚠️ Global timeout, simulation mode');
          this.setupSimulationMode(resolve);
        }
      }, 10000);

    } catch (error) {
      console.error('❌ Unity setup error:', error);
      this.setupSimulationMode(resolve);
    }
  }

  registerEventListeners() {
    if (!window.unityAds) return;

    window.unityAds.on('ready', (adUnitId) => {
      console.log('🎬 Ad Ready:', adUnitId);
      if (adUnitId === this.adUnitId) {
        this.isAdReady = true;
      }
    });

    window.unityAds.on('start', (adUnitId) => {
      console.log('▶️ Ad Started:', adUnitId);
      if (adUnitId === this.adUnitId && this.onAdStartedCallback) {
        this.onAdStartedCallback();
      }
    });

    // 🔥 REAL UNITY AD COMPLETE - Firebase me save karega
    window.unityAds.on('complete', async (adUnitId, reward) => {
      console.log('✅ REAL Ad Completed:', adUnitId, 'Reward:', reward);
      
      if (adUnitId === this.adUnitId) {
        this.isAdReady = false;
        
        // ✅ Firebase me real earnings save karo
        if (this.currentUserId) {
          try {
            console.log('💰 Saving real ad earnings to Firebase...');
            await updateUserWallet(this.currentUserId, 0.0012);
            console.log('✅ Firebase updated with real ad reward');
          } catch (error) {
            console.error('❌ Firebase update failed:', error);
          }
        }
        
        if (this.onAdCompletedCallback) {
          this.onAdCompletedCallback(reward);
        }
        
        this.loadAd();
      }
    });

    window.unityAds.on('skip', (adUnitId) => {
      console.log('⏭️ Ad Skipped:', adUnitId);
      if (adUnitId === this.adUnitId) {
        this.isAdReady = false;
        if (this.onAdFailedCallback) {
          this.onAdFailedCallback('Ad was skipped');
        }
        this.loadAd();
      }
    });

    window.unityAds.on('error', (error) => {
      console.error('❌ Ad Error:', error);
      this.isAdReady = false;
      if (this.onAdFailedCallback) {
        this.onAdFailedCallback(error);
      }
    });
  }

  loadAd() {
    if (this.isInitialized && window.unityAds) {
      console.log('📥 Loading next ad...');
      try {
        window.unityAds.load(this.adUnitId);
      } catch (error) {
        console.error('❌ Load ad error:', error);
      }
    }
  }

  showRewardedAd(onComplete, onFailed, onStart) {
    if (!this.isInitialized) {
      console.log('❌ Not initialized');
      if (onFailed) onFailed('Unity Ads not initialized');
      return;
    }

    this.onAdCompletedCallback = onComplete;
    this.onAdFailedCallback = onFailed;
    this.onAdStartedCallback = onStart;

    // 🔥 REAL UNITY AD available to show karo
    if (window.unityAds && window.unityAds.isReady && window.unityAds.isReady(this.adUnitId)) {
      console.log('🎯 Showing REAL Unity Ad...');
      window.unityAds.show(this.adUnitId);
    } else {
      // 🔥 SIMULATION - Firebase me bhi save karega
      console.log('🖥️ Showing SIMULATED Ad (Firebase integrated)');
      this.showSimulatedAd(onComplete, onFailed, onStart);
    }
  }

  showSimulatedAd(onComplete, onFailed, onStart) {
    console.log('🎬 Starting simulated ad...');
    
    const overlay = document.createElement('div');
    overlay.id = 'unity-ad-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: white;
      font-family: 'Segoe UI', Arial, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="text-align: center; padding: 30px; max-width: 350px;">
        <div style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 10px 20px;
          border-radius: 10px;
          display: inline-block;
          margin-bottom: 20px;
        ">
          <span style="font-size: 1.2rem; font-weight: bold;">Unity Ads</span>
        </div>
        
        <div style="
          width: 280px;
          height: 220px;
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 20px auto;
          font-size: 4rem;
          border: 2px solid rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        ">
          <div style="
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.6);
            color: #ffd700;
            padding: 5px 12px;
            border-radius: 5px;
            font-size: 0.8rem;
            font-weight: bold;
          ">AD</div>
          📱
        </div>
        
        <h3 style="color: #ffd700; margin: 15px 0; font-size: 1.3rem;">
          🎬 Watching Ad...
        </h3>
        
        <div id="ad-timer-display" style="
          font-size: 2.5rem;
          color: #ffffff;
          margin: 15px 0;
          font-weight: bold;
          background: rgba(108, 99, 255, 0.2);
          width: 70px;
          height: 70px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 15px auto;
          border: 3px solid #6c63ff;
        ">3</div>
        
        <div style="
          width: 250px;
          height: 6px;
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
          overflow: hidden;
          margin: 15px auto;
        ">
          <div id="ad-progress-bar" style="
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #6c63ff, #e040fb);
            border-radius: 3px;
            transition: width 0.1s linear;
          "></div>
        </div>
        
        <p style="
          margin-top: 15px;
          color: #f87171;
          font-size: 0.85rem;
          background: rgba(248,113,113,0.1);
          padding: 8px 15px;
          border-radius: 20px;
        ">
          ⚠️ Complete the ad to earn $0.0012
        </p>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    if (onStart) {
      console.log('▶️ Simulated ad started');
      onStart();
    }

    let countdown = 3;
    const totalTime = 3;
    const timerDisplay = overlay.querySelector('#ad-timer-display');
    const progressBar = overlay.querySelector('#ad-progress-bar');
    
    const interval = setInterval(async () => {
      countdown--;
      
      if (timerDisplay) {
        timerDisplay.textContent = countdown;
        // Color change on last second
        if (countdown === 1) {
          timerDisplay.style.borderColor = '#4ade80';
          timerDisplay.style.color = '#4ade80';
        }
      }
      
      if (progressBar) {
        const progress = ((totalTime - countdown) / totalTime) * 100;
        progressBar.style.width = progress + '%';
      }
      
      if (countdown <= 0) {
        clearInterval(interval);
        
        // 🔥 SIMULATION COMPLETE - Firebase me save karo
        if (this.currentUserId) {
          try {
            console.log('💰 Saving simulated ad earnings to Firebase...');
            await updateUserWallet(this.currentUserId, 0.0012);
            console.log('✅ Firebase updated with simulated ad reward');
          } catch (error) {
            console.error('❌ Firebase update failed:', error);
          }
        } else {
          console.warn('⚠️ No user ID set, earnings not saved to Firebase');
        }
        
        // Show completion UI
        overlay.innerHTML = `
          <div style="text-align: center; padding: 30px;">
            <div style="font-size: 5rem; margin-bottom: 20px;">✅</div>
            <h2 style="color: #4ade80; margin-bottom: 10px;">Ad Completed!</h2>
            <p style="font-size: 1.8rem; color: #ffd700; font-weight: bold; margin: 20px 0;">
              +$0.0012 💰
            </p>
            <p style="color: #aaa; margin-top: 20px;">Reward added to wallet</p>
            <p style="color: #6c63ff; font-size: 0.9rem; margin-top: 10px;">
              Closing in 2 seconds...
            </p>
          </div>
        `;
        
        // Remove overlay and trigger callback
        setTimeout(() => {
          if (overlay.parentNode) {
            document.body.removeChild(overlay);
            document.body.style.overflow = '';
          }
          console.log('✅ Simulated ad completed - Firebase updated');
          if (onComplete) {
            onComplete({ amount: 0.0012, simulated: true });
          }
        }, 2000);
      }
    }, 1000);

    // Prevent closing ad
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });

    const preventClose = (e) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.altKey) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', preventClose);

    // Cleanup
    this._simulationCleanup = () => {
      clearInterval(interval);
      document.removeEventListener('keydown', preventClose);
      if (overlay.parentNode) {
        document.body.removeChild(overlay);
        document.body.style.overflow = '';
      }
    };
  }

  isAdAvailable() {
    if (window.unityAds && window.unityAds.isReady) {
      return this.isInitialized && this.isAdReady && window.unityAds.isReady(this.adUnitId);
    }
    // Simulation mode - always available
    return this.isInitialized;
  }

  updateConfig(gameId, adUnitId) {
    console.log('🔄 Updating Unity Ads config');
    if (gameId) this.gameId = gameId;
    if (adUnitId) this.adUnitId = adUnitId;
    console.log('📋 Config updated - Game ID:', this.gameId, 'Ad Unit:', this.adUnitId);
  }
}

const unityAdsService = new UnityAdsService();

export { unityAdsService };
export default unityAdsService;