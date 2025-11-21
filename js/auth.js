// Utility functions
function showError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => { errorEl.style.display = 'none'; }, 5000);
  }
}

function showSuccess(elementId, message) {
  const successEl = document.getElementById(elementId);
  if (successEl) {
    successEl.textContent = message;
    successEl.style.display = 'block';
    setTimeout(() => { successEl.style.display = 'none'; }, 5000);
  }
}

function setLoading(formId, loading) {
  const form = document.getElementById(formId);
  if (!form) return;
  
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = loading;
  
  const buttonTexts = {
    'loginForm': loading ? 'LOGGING IN...' : 'LOGIN',
    'registerForm': loading ? 'SIGNING UP...' : 'SIGN UP',
    'forgotPasswordForm': loading ? 'SENDING...' : 'SEND RESET LINK'
  };
  
  btn.textContent = buttonTexts[formId];
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const button = input.parentElement.querySelector('.toggle-password i');
  
  if (input.type === 'password') {
    input.type = 'text';
    button.classList.remove('fa-eye');
    button.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    button.classList.remove('fa-eye-slash');
    button.classList.add('fa-eye');
  }
}

function calculatePasswordStrength(password) {
  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z\d]/.test(password)) strength++;
  return strength;
}

// Form switching functions (for combined login page)
function showLoginForm() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotPasswordForm');
  
  if (loginForm) loginForm.style.display = 'block';
  if (registerForm) registerForm.style.display = 'none';
  if (forgotForm) forgotForm.style.display = 'none';
  clearAllForms();
}

function showRegisterForm() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotPasswordForm');
  
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'block';
  if (forgotForm) forgotForm.style.display = 'none';
  clearAllForms();
}

function showForgotPasswordForm() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotPasswordForm');
  
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'none';
  if (forgotForm) forgotForm.style.display = 'block';
  clearAllForms();
}

function clearAllForms() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotPasswordForm');
  
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
  if (forgotForm) forgotForm.reset();
  
  // Hide all error/success messages
  document.querySelectorAll('.error-message, .success-message').forEach(el => {
    el.style.display = 'none';
  });
}

// Login handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading('loginForm', true);

    const loginField = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;

    if (!loginField || !password) {
      showError('loginError', 'Please fill in all fields');
      setLoading('loginForm', false);
      return;
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: loginField, password })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        document.cookie = `rememberMe=true; path=/; max-age=${Math.floor(maxAge/1000)}`;
        window.location.href = '/index.html';
      } else {
        showError('loginError', data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      showError('loginError', 'Network error. Please try again.');
    } finally {
      setLoading('loginForm', false);
    }
  });
}

// Register handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading('registerForm', true);

    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      showError('registerError', 'Please fill in all fields');
      setLoading('registerForm', false);
      return;
    }

    if (password !== confirmPassword) {
      showError('registerError', 'Passwords do not match');
      setLoading('registerForm', false);
      return;
    }

    if (password.length < 6) {
      showError('registerError', 'Password must be at least 6 characters');
      setLoading('registerForm', false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('registerError', 'Please enter a valid email address');
      setLoading('registerForm', false);
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Check if we're on a separate signup page or combined page
        const isStandalonePage = !document.getElementById('loginForm') || 
                                 document.getElementById('loginForm').style.display === 'none';
        
        if (isStandalonePage) {
          showSuccess('registerSuccess', 'Registration successful! Redirecting to login...');
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 2000);
        } else {
          showSuccess('registerSuccess', 'Registration successful! Redirecting to login...');
          setTimeout(() => {
            showLoginForm();
          }, 2000);
        }
      } else {
        showError('registerError', data.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      showError('registerError', 'Network error. Please try again.');
    } finally {
      setLoading('registerForm', false);
    }
  });

  // Password strength indicator
  const regPassword = document.getElementById('regPassword');
  if (regPassword) {
    regPassword.addEventListener('input', function(e) {
      const password = e.target.value;
      const strength = calculatePasswordStrength(password);
      console.log('Password strength:', strength);
    });
  }
}

// Forgot password handler
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading('forgotPasswordForm', true);

    const email = document.getElementById('forgotEmail').value.trim();

    if (!email) {
      showError('forgotError', 'Please enter your email address');
      setLoading('forgotPasswordForm', false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('forgotError', 'Please enter a valid email address');
      setLoading('forgotPasswordForm', false);
      return;
    }

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showSuccess('forgotSuccess', 'Password reset link sent to your email!');
        document.getElementById('forgotEmail').value = '';
        
        // Check if we're on a separate forgot password page or combined page
        const isStandalonePage = !document.getElementById('loginForm') || 
                                 document.getElementById('loginForm').style.display === 'none';
        
        if (isStandalonePage) {
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 3000);
        } else {
          setTimeout(() => {
            showLoginForm();
          }, 3000);
        }
      } else {
        showError('forgotError', data.error || 'Failed to send reset link');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      showError('forgotError', 'Network error. Please try again.');
    } finally {
      setLoading('forgotPasswordForm', false);
    }
  });
}

// Navigation between forms (for combined page)
const showRegisterBtn = document.getElementById('showRegister');
if (showRegisterBtn) {
  showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
}

const showLoginBtns = document.querySelectorAll('#showLogin, #backToLogin');
showLoginBtns.forEach(btn => {
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showLoginForm();
    });
  }
});

const forgotPasswordBtn = document.getElementById('forgotPassword');
if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showForgotPasswordForm();
  });
}

// Check if user is already logged in
window.addEventListener('load', async () => {
  try {
    const response = await fetch('/api/me', { credentials: 'include' });
    const data = await response.json();
    if (data.loggedIn) {
      window.location.href = '/index.html';
    }
  } catch {
    console.log('Not logged in or session check failed');
  }
});