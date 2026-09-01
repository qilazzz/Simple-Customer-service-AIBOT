import { SUPPORT_MENU } from '../config.js';

export function renderMenuView(container, { onSelectOption, onTrackComplaints }) {
  container.innerHTML = `
    <main class="scroll-content">
      <section class="hero-card hero-card-menu">
        <h2 class="hero-title">How can we help?</h2>
        <p class="hero-sub">US Pizza Malaysia Customer Service</p>
        <p class="hero-hint">Choose an option below. Live agent chat history is kept separately under Talk to Support.</p>
      </section>

      <nav class="menu-list" aria-label="Support options">
        ${SUPPORT_MENU.map(
          (item) => `
            <button type="button" class="menu-option" data-option-id="${item.id}">
              <span class="menu-option-emoji">${item.emoji}</span>
              <span class="menu-option-copy">
                <span class="menu-option-label">${item.label}</span>
                ${item.meta ? `<span class="menu-option-meta">${item.meta}</span>` : ''}
              </span>
            </button>
          `,
        ).join('')}
      </nav>

      <button type="button" class="menu-track-btn" id="menu-track-btn">
        📋 Track My Complaints / History
      </button>
    </main>
  `;

  container.querySelectorAll('.menu-option').forEach((button) => {
    button.addEventListener('click', () => {
      onSelectOption(button.dataset.optionId);
    });
  });

  container.querySelector('#menu-track-btn')?.addEventListener('click', onTrackComplaints);
}
