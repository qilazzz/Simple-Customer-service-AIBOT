const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/chat.html';

if (getCustomerToken()) {
  refreshCustomerSession().then((user) => {
    if (user) window.location.href = redirectTo;
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.classList.add('hidden');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    setCustomerSession(data.token, data.user);
    window.location.href = redirectTo;
  } catch (err) {
    errorEl.textContent = err.message || 'Login failed.';
    errorEl.classList.remove('hidden');
  }
});
