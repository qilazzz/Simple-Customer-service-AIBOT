const form = document.getElementById('register-form');
const errorEl = document.getElementById('register-error');
const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/chat.html';

if (getCustomerToken()) {
  refreshCustomerSession().then((user) => {
    if (user) window.location.href = redirectTo;
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.classList.add('hidden');

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone_number = document.getElementById('phone_number').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm_password').value;

  if (password !== confirmPassword) {
    errorEl.textContent = 'Passwords do not match.';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone_number: phone_number || undefined,
        password,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    setCustomerSession(data.token, data.user);
    window.location.href = redirectTo;
  } catch (err) {
    errorEl.textContent = err.message || 'Registration failed.';
    errorEl.classList.remove('hidden');
  }
});
