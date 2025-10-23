// Utility functions
function showError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  setTimeout(() => { errorEl.style.display = 'none'; }, 5000);
}

function showSuccess(elementId, message) {
  const successEl = document.getElementById(elementId);
  successEl.textContent = message;
  successEl.style.display = 'block';
  setTimeout(() => { successEl.style.display = 'none'; }, 5000);
}

function setLoading(formId, loading) {
  const form = document.getElementById(formId);
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

// Form switching functions
function showLoginForm() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('forgotPasswordForm').style.display = 'none';
  clearAllForms();
}

function showRegisterForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('forgotPasswordForm').style.display = 'none';
  clearAllForms();
}

function showForgotPasswordForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('forgotPasswordForm').style.display = 'block';
  clearAllForms();
}

function clearAllForms() {
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();
  document.getElementById('forgotPasswordForm').reset();
  
  // Hide all error/success messages
  document.querySelectorAll('.error-message, .success-message').forEach(el => {
    el.style.display = 'none';
  });
}

// Login handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
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

// Register handler
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('registerForm', true);

  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;

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
      showSuccess('registerError', 'Registration successful! Redirecting to login...');
      setTimeout(() => {
        showLoginForm();
      }, 2000);
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

// Forgot password handler
document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
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
      setTimeout(() => {
        showLoginForm();
      }, 3000);
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

// Navigation between forms
document.getElementById('showRegister').addEventListener('click', (e) => {
  e.preventDefault();
  showRegisterForm();
});

document.addEventListener('click', (e) => {
  if (e.target.id === 'showLogin') {
    e.preventDefault();
    showLoginForm();
  }
});

document.getElementById('forgotPassword').addEventListener('click', (e) => {
  e.preventDefault();
  showForgotPasswordForm();
});

document.getElementById('backToLogin').addEventListener('click', (e) => {
  e.preventDefault();
  showLoginForm();
});

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

// Password strength indicator (optional enhancement)
document.getElementById('regPassword')?.addEventListener('input', function(e) {
  const password = e.target.value;
  const strength = calculatePasswordStrength(password);
  // You can add UI feedback here if desired
});

function calculatePasswordStrength(password) {
  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z\d]/.test(password)) strength++;
  return strength;
}