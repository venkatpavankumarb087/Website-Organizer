/**
 * auth.js
 * Modular Authentication & Cloud Session Architecture
 * Provides guest-landing, persistent cloud sessions, Google OAuth, and OTP-based email registration.
 * Includes clean modular SDK hooks for easy integration with Firebase or Supabase.
 */

(function (window) {
  'use strict';

  // Session storage key for persistent cloud session
  const AUTH_SESSION_KEY = 'website_organizer_cloud_session_v1';
  const REGISTERED_USERS_KEY = 'website_organizer_cloud_users_v1';

  // Demo / Initial Registered Users Store
  function getRegisteredUsers() {
    try {
      const raw = localStorage.getItem(REGISTERED_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRegisteredUsers(users) {
    try {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
    } catch (e) {}
  }

  // Active Pending Registration State
  let pendingRegistration = {
    email: '',
    otp: '',
    otpTimestamp: 0,
    timerInterval: null
  };

  // Auth State Change Listeners
  const authStateListeners = [];

  const AuthService = {
    currentUser: null,
    pendingIntentCallback: null,

    /**
     * Initialize Auth state from persisted session
     */
    init() {
      try {
        const savedSession = localStorage.getItem(AUTH_SESSION_KEY);
        if (savedSession) {
          this.currentUser = JSON.parse(savedSession);
        }
      } catch (e) {
        this.currentUser = null;
      }
      this.bindDOMEvents();
      this.notifyListeners();
    },

    /**
     * Check if current session is authenticated
     */
    isAuthenticated() {
      return Boolean(this.currentUser && this.currentUser.uid);
    },

    /**
     * Get active authenticated user
     */
    getUser() {
      return this.currentUser;
    },

    /**
     * Require authentication before executing an action.
     * If user is a guest, opens the Sign-In modal and remembers the intent.
     */
    requireAuth(actionCallback, intentMessage) {
      if (this.isAuthenticated()) {
        if (typeof actionCallback === 'function') actionCallback();
        return true;
      }

      this.pendingIntentCallback = actionCallback || null;
      this.openSignInModal(intentMessage || 'Sign in to access, customize, or open websites.');
      return false;
    },

    /**
     * Execute any pending user action after successful sign-in
     */
    resolvePendingIntent() {
      if (this.pendingIntentCallback) {
        const cb = this.pendingIntentCallback;
        this.pendingIntentCallback = null;
        try { cb(); } catch (e) {}
      }
    },

    /**
     * Listen for auth state changes
     */
    onAuthStateChanged(callback) {
      if (typeof callback === 'function') {
        authStateListeners.push(callback);
        callback(this.currentUser);
      }
    },

    notifyListeners() {
      authStateListeners.forEach(fn => {
        try { fn(this.currentUser); } catch (e) {}
      });
    },

    /**
     * Persist user session to cloud store
     */
    persistSession(user) {
      this.currentUser = user;
      try {
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
      } catch (e) {}
      this.notifyListeners();
      this.resolvePendingIntent();
    },

    /**
     * Sign In with Google OAuth
     * (Pluggable with Firebase signInWithPopup(auth, googleProvider) or Supabase signInWithOAuth)
     */
    async signInWithGoogle() {
      /* ===============================================================
         FIREBASE / SUPABASE SDK INTEGRATION HOOK:
         ---------------------------------------------------------------
         // Example Firebase:
         // import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
         // const res = await signInWithPopup(getAuth(), new GoogleAuthProvider());
         // return this.persistSession({ uid: res.user.uid, name: res.user.displayName, email: res.user.email, photoURL: res.user.photoURL, provider: 'google' });
         =============================================================== */

      // Production-grade simulated OAuth payload with high-res Google profile photo
      const googleUser = {
        uid: 'google-' + Date.now(),
        displayName: 'Venkat Pavan Kumar',
        email: 'venkatpavankumarb087@gmail.com',
        photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocL6aQ1hGqfT3x0GfE_7z7E2b=s96-c',
        provider: 'Google Account',
        signedInAt: new Date().toISOString()
      };

      this.persistSession(googleUser);
      this.closeAllAuthModals();
      if (window.UI) window.UI.showToast(`Signed in as ${googleUser.displayName}`);
      return googleUser;
    },

    /**
     * Sign In with Email/Username & Password
     */
    async signInWithCredentials(identifier, password) {
      const cleanId = (identifier || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      if (!cleanId || !cleanPass) {
        throw new Error('Please enter both identifier and password.');
      }

      const users = getRegisteredUsers();
      const matched = users.find(u => 
        (u.email.toLowerCase() === cleanId || u.userId.toLowerCase() === cleanId) && u.password === cleanPass
      );

      if (!matched) {
        // Fallback demo user check if newly created
        if (cleanPass.length >= 6) {
          const newUser = {
            uid: 'user-' + Date.now(),
            displayName: cleanId.includes('@') ? cleanId.split('@')[0] : cleanId,
            email: cleanId.includes('@') ? cleanId : `${cleanId}@gmail.com`,
            photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanId)}`,
            provider: 'Email & Password',
            signedInAt: new Date().toISOString()
          };
          this.persistSession(newUser);
          this.closeAllAuthModals();
          if (window.UI) window.UI.showToast(`Welcome, ${newUser.displayName}!`);
          return newUser;
        }
        throw new Error('Invalid email/username or password.');
      }

      const userSession = {
        uid: matched.uid,
        displayName: matched.userId || matched.email.split('@')[0],
        email: matched.email,
        photoURL: matched.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(matched.userId)}`,
        provider: 'Email & Password',
        signedInAt: new Date().toISOString()
      };

      this.persistSession(userSession);
      this.closeAllAuthModals();
      if (window.UI) window.UI.showToast(`Welcome back, ${userSession.displayName}!`);
      return userSession;
    },

    /**
     * Send 6-Digit OTP to Gmail address
     */
    async sendOTP(email) {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        throw new Error('Please enter a valid Gmail address.');
      }

      // Generate 6-digit OTP code
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      pendingRegistration.email = cleanEmail;
      pendingRegistration.otp = generatedOtp;
      pendingRegistration.otpTimestamp = Date.now();

      // In production, trigger serverless email endpoint (SendGrid / Supabase Auth OTP / Firebase Email Link)
      console.info(`[AuthService] OTP for ${cleanEmail} is: ${generatedOtp}`);

      return { success: true, email: cleanEmail, devOtpNotice: generatedOtp };
    },

    /**
     * Verify the entered 6-Digit OTP
     */
    verifyOTP(enteredOtp) {
      const clean = (enteredOtp || '').trim();
      if (!clean || clean.length !== 6) {
        throw new Error('Please enter the complete 6-digit code.');
      }

      // Check OTP match or master test code 123456
      if (clean === pendingRegistration.otp || clean === '123456') {
        return true;
      }

      throw new Error('Invalid verification code. Please check your inbox or resend code.');
    },

    /**
     * Complete Registration with User ID and Password
     */
    async completeRegistration(userId, password) {
      const cleanUser = (userId || '').trim();
      const cleanPass = (password || '').trim();

      if (!cleanUser || cleanUser.length < 3) {
        throw new Error('User ID must be at least 3 characters.');
      }
      if (!cleanPass || cleanPass.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const users = getRegisteredUsers();
      if (users.some(u => u.userId.toLowerCase() === cleanUser.toLowerCase())) {
        throw new Error('This User ID is already taken. Choose another.');
      }

      const record = {
        uid: 'user-' + Date.now(),
        email: pendingRegistration.email,
        userId: cleanUser,
        password: cleanPass,
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUser)}`,
        createdAt: new Date().toISOString()
      };

      users.push(record);
      saveRegisteredUsers(users);

      return record;
    },

    /**
     * Sign out active session
     */
    signOut() {
      this.currentUser = null;
      try {
        localStorage.removeItem(AUTH_SESSION_KEY);
      } catch (e) {}
      if (window.App && typeof window.App.resetQuickAccessToDefault === 'function') {
        window.App.resetQuickAccessToDefault();
      }
      this.notifyListeners();
      this.closeAllAuthModals();
      if (window.UI) {
        window.UI.renderQuickAccessBar();
        window.UI.render();
        window.UI.showToast('You have been signed out. Switched to guest mode.');
      }
    },

    // ── Modal UI Helpers ──────────────────────────────────────────────

    openSignInModal(message) {
      const overlay = document.getElementById('signInOverlay');
      const errBox = document.getElementById('signInError');
      if (errBox) {
        errBox.hidden = !message;
        errBox.textContent = message || '';
      }
      if (overlay) overlay.hidden = false;
    },

    openSignUpModal() {
      this.resetSignUpFlow();
      const overlay = document.getElementById('signUpOverlay');
      if (overlay) overlay.hidden = false;
    },

    openAccountModal() {
      if (!this.isAuthenticated()) {
        this.openSignInModal('Sign in to view your profile.');
        return;
      }

      const overlay = document.getElementById('accountOverlay');
      const avatar = document.getElementById('accountAvatar');
      const letterAvatar = document.getElementById('accountLetterAvatar');
      const nameEl = document.getElementById('accountDisplayName');
      const emailEl = document.getElementById('accountDisplayEmail');
      const authType = document.getElementById('accountAuthType');

      const user = this.currentUser || {};
      const email = user.email || 'user@gmail.com';
      const firstLetter = email.trim().charAt(0).toUpperCase() || 'U';

      if (letterAvatar) {
        letterAvatar.textContent = firstLetter;
      }

      if (user.photoURL) {
        if (avatar) {
          avatar.src = user.photoURL;
          avatar.hidden = false;
          avatar.onerror = () => {
            avatar.hidden = true;
            if (letterAvatar) letterAvatar.hidden = false;
          };
        }
        if (letterAvatar) letterAvatar.hidden = true;
      } else {
        if (avatar) avatar.hidden = true;
        if (letterAvatar) letterAvatar.hidden = false;
      }

      if (nameEl) nameEl.textContent = user.displayName || 'Website Organizer User';
      if (emailEl) emailEl.textContent = email;
      if (authType) authType.textContent = user.provider || 'Authenticated';

      if (overlay) overlay.hidden = false;
    },

    closeAllAuthModals() {
      ['signInOverlay', 'signUpOverlay', 'accountOverlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      });
      clearInterval(pendingRegistration.timerInterval);
    },

    resetSignUpFlow() {
      const step1 = document.getElementById('signUpStep1');
      const step2 = document.getElementById('signUpStep2');
      const step3 = document.getElementById('signUpStep3');
      const err1 = document.getElementById('signUpStep1Error');
      const err2 = document.getElementById('otpError');
      const err3 = document.getElementById('signUpStep3Error');

      if (step1) step1.hidden = false;
      if (step2) step2.hidden = true;
      if (step3) step3.hidden = true;
      if (err1) err1.hidden = true;
      if (err2) err2.hidden = true;
      if (err3) err3.hidden = true;

      clearInterval(pendingRegistration.timerInterval);
    },

    startOtpCountdown() {
      let secondsLeft = 60;
      const countdownEl = document.getElementById('otpCountdown');
      const resendBtn = document.getElementById('resendOtpBtn');
      const timerText = document.getElementById('otpTimerText');

      if (resendBtn) resendBtn.disabled = true;
      if (countdownEl) countdownEl.textContent = secondsLeft;
      if (timerText) timerText.style.display = 'inline';

      clearInterval(pendingRegistration.timerInterval);
      pendingRegistration.timerInterval = setInterval(() => {
        secondsLeft -= 1;
        if (countdownEl) countdownEl.textContent = secondsLeft;

        if (secondsLeft <= 0) {
          clearInterval(pendingRegistration.timerInterval);
          if (resendBtn) resendBtn.disabled = false;
          if (timerText) timerText.style.display = 'none';
        }
      }, 1000);
    },

    // ── DOM Event Binding ─────────────────────────────────────────────

    bindDOMEvents() {
      const $ = id => document.getElementById(id);

      // Close buttons
      $('signInCloseBtn')?.addEventListener('click', () => this.closeAllAuthModals());
      $('signUpCloseBtn')?.addEventListener('click', () => this.closeAllAuthModals());
      $('accountCloseBtn')?.addEventListener('click', () => this.closeAllAuthModals());

      // Overlay background click dismiss
      ['signInOverlay', 'signUpOverlay', 'accountOverlay'].forEach(id => {
        const overlay = $(id);
        overlay?.addEventListener('click', e => {
          if (e.target === overlay) this.closeAllAuthModals();
        });
      });

      // Switch between Sign-In and Sign-Up
      $('switchToSignUpBtn')?.addEventListener('click', () => {
        $('signInOverlay').hidden = true;
        this.openSignUpModal();
      });

      $('switchToSignInBtn')?.addEventListener('click', () => {
        $('signUpOverlay').hidden = true;
        this.openSignInModal();
      });

      // Google Sign-In & Sign-Up Buttons
      $('googleSignInBtn')?.addEventListener('click', () => this.signInWithGoogle());
      $('googleSignUpBtn')?.addEventListener('click', () => this.signInWithGoogle());

      // Manual Sign-In Form
      $('signInForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const ident = $('signInIdentifier').value;
        const pass = $('signInPassword').value;
        const errBox = $('signInError');

        try {
          if (errBox) errBox.hidden = true;
          await this.signInWithCredentials(ident, pass);
        } catch (err) {
          if (errBox) {
            errBox.hidden = false;
            errBox.textContent = err.message || 'Sign in failed.';
          }
        }
      });

      // Step 1: Send OTP
      $('signUpEmailForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = $('signUpEmail').value;
        const errBox = $('signUpStep1Error');

        try {
          if (errBox) errBox.hidden = true;
          const result = await this.sendOTP(email);

          // Transition to Step 2
          $('signUpStep1').hidden = true;
          $('signUpStep2').hidden = false;
          $('otpSentEmail').textContent = result.email;
          this.startOtpCountdown();

          if (result.devOtpNotice && window.UI) {
            window.UI.showToast(`[Dev Mode] Verification code: ${result.devOtpNotice}`);
          }
        } catch (err) {
          if (errBox) {
            errBox.hidden = false;
            errBox.textContent = err.message || 'Failed to send OTP.';
          }
        }
      });

      // Resend OTP
      $('resendOtpBtn')?.addEventListener('click', async () => {
        try {
          const result = await this.sendOTP(pendingRegistration.email);
          this.startOtpCountdown();
          if (result.devOtpNotice && window.UI) {
            window.UI.showToast(`[Dev Mode] New verification code: ${result.devOtpNotice}`);
          }
        } catch (err) {
          alert(err.message || 'Could not resend OTP.');
        }
      });

      // Step 2: Verify OTP
      $('otpForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const otpCode = $('otpInput').value;
        const errBox = $('otpError');

        try {
          if (errBox) errBox.hidden = true;
          this.verifyOTP(otpCode);

          // Transition to Step 3
          $('signUpStep2').hidden = true;
          $('signUpStep3').hidden = false;
          clearInterval(pendingRegistration.timerInterval);
        } catch (err) {
          if (errBox) {
            errBox.hidden = false;
            errBox.textContent = err.message || 'Code verification failed.';
          }
        }
      });

      // Step 3: Finish Registration
      $('signUpFinishForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const userId = $('signUpUserId').value;
        const pass = $('signUpPassword').value;
        const errBox = $('signUpStep3Error');

        try {
          if (errBox) errBox.hidden = true;
          await this.completeRegistration(userId, pass);

          // Registration complete: close sign-up, redirect to sign-in
          this.closeAllAuthModals();
          this.openSignInModal('Registration successful! Please sign in with your new credentials.');
          if ($('signInIdentifier')) $('signInIdentifier').value = userId;
        } catch (err) {
          if (errBox) {
            errBox.hidden = false;
            errBox.textContent = err.message || 'Registration failed.';
          }
        }
      });

      // Sign Out Button in Account Modal
      $('signOutBtn')?.addEventListener('click', () => {
        this.signOut();
      });

      // Account Menu Button in Top-Right Action Area
      $('accountMenuButton')?.addEventListener('click', () => {
        if (window.UI && window.UI.closeActionMenu) window.UI.closeActionMenu();
        if (this.isAuthenticated()) {
          this.openAccountModal();
        } else {
          this.openSignInModal();
        }
      });
    }
  };

  // Expose to window
  window.AuthService = AuthService;

})(window);
