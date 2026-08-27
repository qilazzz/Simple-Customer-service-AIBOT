export function renderHomeView(container, { onFindOutlets, onOpenSupport }) {
  container.innerHTML = `
    <main class="scroll-content">
      <section class="hero-card">
        <h2 class="hero-title">🍕 US Pizza</h2>
        <p class="hero-sub">Order · Track · Support</p>
      </section>

      <button type="button" class="home-action-card home-action-outlets" id="home-outlets-btn">
        <span class="home-action-title">📍 Find Outlets</span>
        <span class="home-action-sub">Browse all US Pizza locations in Malaysia</span>
      </button>

      <button type="button" class="home-action-card home-action-support" id="home-support-btn">
        <span class="home-action-title">💬 Customer Support</span>
        <span class="home-action-sub">Report an issue or leave feedback</span>
      </button>
    </main>
  `;

  container.querySelector('#home-outlets-btn')?.addEventListener('click', onFindOutlets);
  container.querySelector('#home-support-btn')?.addEventListener('click', onOpenSupport);
}
