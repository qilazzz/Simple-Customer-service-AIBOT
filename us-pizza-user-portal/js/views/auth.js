export function renderLoginView(container, { onSubmit, onGoRegister, error }) {
  container.innerHTML = `
    <main class="scroll-content auth-scroll">
      <section class="auth-hero">
        <span class="auth-hero-emoji">🍕</span>
        <h2 class="auth-hero-title">Welcome back</h2>
        <p class="auth-hero-sub">Sign in for faster support and saved details.</p>
      </section>
      ${error ? `<p class="form-error" role="alert">${error}</p>` : ''}
      <form id="login-form" class="auth-form">
        <label class="field">
          <span class="field-label">Email or Phone Number</span>
          <input id="login-identifier" type="text" autocomplete="username" placeholder="you@example.com or 0123456789" required />
        </label>
        <label class="field">
          <span class="field-label">Password</span>
          <input id="login-password" type="password" autocomplete="current-password" placeholder="Your password" required />
        </label>
        <button id="login-submit" type="submit" class="btn-primary-block">Log In</button>
      </form>
      <button type="button" id="login-to-register" class="auth-switch">
        Don't have an account? <strong>Create one</strong>
      </button>
    </main>
  `;

  container.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const identifier = container.querySelector('#login-identifier')?.value || '';
    const password = container.querySelector('#login-password')?.value || '';
    await onSubmit({ identifier, password });
  });

  container.querySelector('#login-to-register')?.addEventListener('click', onGoRegister);
}

export function renderRegisterView(container, { onSubmit, onGoLogin, error }) {
  container.innerHTML = `
    <main class="scroll-content auth-scroll">
      <section class="auth-hero">
        <span class="auth-hero-emoji">🍕</span>
        <h2 class="auth-hero-title">Create account</h2>
        <p class="auth-hero-sub">Join US Pizza for faster support and order help.</p>
      </section>
      ${error ? `<p class="form-error" role="alert">${error}</p>` : ''}
      <form id="register-form" class="auth-form">
        <label class="field">
          <span class="field-label">Full Name</span>
          <input id="register-name" type="text" autocomplete="name" placeholder="Ahmad bin Ali" required />
        </label>
        <label class="field">
          <span class="field-label">Phone Number</span>
          <input id="register-phone" type="tel" autocomplete="tel" placeholder="0123456789" />
        </label>
        <label class="field">
          <span class="field-label">Email</span>
          <input id="register-email" type="email" autocomplete="email" placeholder="you@example.com" required />
        </label>
        <label class="field">
          <span class="field-label">Password</span>
          <input id="register-password" type="password" autocomplete="new-password" placeholder="At least 6 characters" required />
        </label>
        <button id="register-submit" type="submit" class="btn-primary-block">Create Account</button>
      </form>
      <button type="button" id="register-to-login" class="auth-switch">
        Already have an account? <strong>Log in</strong>
      </button>
    </main>
  `;

  container.querySelector('#register-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await onSubmit({
      name: container.querySelector('#register-name')?.value || '',
      phone_number: container.querySelector('#register-phone')?.value || '',
      email: container.querySelector('#register-email')?.value || '',
      password: container.querySelector('#register-password')?.value || '',
    });
  });

  container.querySelector('#register-to-login')?.addEventListener('click', onGoLogin);
}
