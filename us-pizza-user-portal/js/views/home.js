const FAQ_ITEMS = [
  {
    question: 'Is the food Halal? If yes, is it Halal for every branch?',
    answer: `Yes, our food is halal. Our Central Kitchen has been certified Halal. Currently, 6 out of our 15 outlets have received Halal Certified, and the other outlets are pending Halal certification. For the stores pending certification, we wish to ensure everyone that all our ingredients and food preparations follow the Halal Food Regulations and are indifferent with any other outlets. We assure all customers that our ingredients are all Halal-certified.`,
  },
  {
    question: 'What are your opening hours?',
    answer: `Our opening hours vary with every branch.`,
    link: { label: 'Check our US Pizza store location and operation hours here', action: 'outlets' },
  },
  {
    question: 'Where are you located?',
    answer: `Our stores are located around Penang, Kedah, Klang Valley, and recently Johor. Please refer to the store location tab to find the exact locations.`,
    link: { label: 'View store locations', action: 'outlets' },
  },
  {
    question: 'Does the food come from the US?',
    answer: `No, we are a local brand that started 22 years ago in Penang. Recently, we have started expanding to Klang Valley and Johor.`,
  },
  {
    question: 'I have questions that are not answered here.',
    answer: `If you have additional questions, we appreciate any feedback and would like to address any concerns you may have. Drop us a line via Contact Us and someone will contact you shortly.`,
    link: { label: 'Contact us', action: 'support' },
  },
];

function renderFaqHtml() {
  return FAQ_ITEMS.map(
    (item, index) => `
      <details class="faq-item" ${index === 0 ? 'open' : ''}>
        <summary class="faq-question">${item.question}</summary>
        <div class="faq-answer">
          <p>${item.answer}</p>
          ${item.link ? `<button type="button" class="faq-link" data-faq-action="${item.link.action}">${item.link.label}</button>` : ''}
        </div>
      </details>
    `,
  ).join('');
}

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

      <section class="faq-section" aria-labelledby="faq-heading">
        <h2 id="faq-heading" class="faq-heading">FAQ</h2>
        ${renderFaqHtml()}
      </section>
    </main>
  `;

  container.querySelector('#home-outlets-btn')?.addEventListener('click', onFindOutlets);
  container.querySelector('#home-support-btn')?.addEventListener('click', onOpenSupport);

  container.querySelectorAll('[data-faq-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.faqAction === 'outlets') onFindOutlets?.();
      else if (button.dataset.faqAction === 'support') onOpenSupport?.();
    });
  });
}
