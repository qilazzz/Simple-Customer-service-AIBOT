export const FAQ_ITEMS = [
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

export function renderFaqView(container, { onFindOutlets, onOpenSupport } = {}) {
  container.innerHTML = `
    <main class="scroll-content">
      <section class="hero-card hero-card-menu">
        <h2 class="hero-title">FAQ</h2>
        <p class="hero-sub">Frequently Asked Questions</p>
        <p class="hero-hint">Tap a question below to read the answer.</p>
      </section>

      <div class="faq-list" role="list">
        ${FAQ_ITEMS.map(
          (item, index) => `
            <article class="faq-card" role="listitem">
              <button type="button" class="faq-q-btn" data-faq-index="${index}" aria-expanded="false">
                <span class="faq-q-text">${item.question}</span>
                <span class="faq-q-icon" aria-hidden="true">+</span>
              </button>
              <div class="faq-a-panel hidden" id="faq-answer-${index}">
                <p>${item.answer}</p>
                ${item.link ? `<button type="button" class="faq-link" data-faq-action="${item.link.action}">${item.link.label}</button>` : ''}
              </div>
            </article>
          `,
        ).join('')}
      </div>
    </main>
  `;

  container.querySelectorAll('.faq-q-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const index = button.dataset.faqIndex;
      const panel = container.querySelector(`#faq-answer-${index}`);
      const icon = button.querySelector('.faq-q-icon');
      const isOpen = !panel.classList.contains('hidden');

      container.querySelectorAll('.faq-a-panel').forEach((el) => el.classList.add('hidden'));
      container.querySelectorAll('.faq-q-btn').forEach((el) => {
        el.classList.remove('is-open');
        el.setAttribute('aria-expanded', 'false');
        el.querySelector('.faq-q-icon').textContent = '+';
      });

      if (!isOpen) {
        panel.classList.remove('hidden');
        button.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        icon.textContent = '−';
      }
    });
  });

  container.querySelectorAll('[data-faq-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.faqAction === 'outlets') onFindOutlets?.();
      else if (button.dataset.faqAction === 'support') onOpenSupport?.();
    });
  });
}
