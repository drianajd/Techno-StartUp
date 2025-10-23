// Utility functions
function showError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  setTimeout(() => { errorEl.style.display = 'none'; }, 5000);
}

function setLoading(formId, loading) {
  const form = document.getElementById(formId);
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = loading;
  btn.textContent = loading ? 'Loading...' : (formId === 'loginForm' ? 'LOGIN' : 'SIGN UP');
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

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      alert('Registration successful! You can now login with your credentials.');
      document.getElementById('showRegister').click();
      document.getElementById('registerForm').reset();
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

// Toggle between login and register
document.getElementById('showRegister').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.querySelector('.signup-text').style.display = 'none';
});

const registerForm = document.getElementById('registerForm');
const existingBackLink = document.getElementById('showLogin');
if (!existingBackLink) {
  registerForm.insertAdjacentHTML('beforeend', 
    '<p class="signup-text" style="margin-top: 15px;">Already have an account? <a href="#" id="showLogin">Login</a></p>'
  );
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'showLogin') {
    e.preventDefault();
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.querySelectorAll('.signup-text').forEach(el => el.style.display = 'block');
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
  }
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

// Forgot password
document.getElementById('forgotPassword').addEventListener('click', (e) => {
  e.preventDefault();
  alert('Password reset functionality coming soon!');
});
