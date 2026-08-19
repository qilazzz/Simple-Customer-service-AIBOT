const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');

if (getToken()) {
  window.location.href = '/admin/index.html';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');

  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    setToken(data.token);
    window.location.href = '/admin/index.html';
  } catch (err) {
    errorEl.textContent = err.message || 'Login failed.';
    errorEl.classList.remove('hidden');
  }
});
