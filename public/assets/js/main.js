const mobileButton = document.querySelector('[data-mobile-toggle]');
const mobileMenu = document.querySelector('[data-mobile-menu]');
const body = document.body;

if (mobileButton && mobileMenu) {
  mobileButton.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('hidden') === false;
    mobileButton.setAttribute('aria-expanded', String(isOpen));
    body.classList.toggle('overflow-hidden', isOpen);
  });
}

const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const targetId = link.getAttribute('href');
    const target = targetId ? document.querySelector(targetId) : null;
    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
      mobileMenu.classList.add('hidden');
      mobileButton?.setAttribute('aria-expanded', 'false');
      body.classList.remove('overflow-hidden');
    }
  });
});

document.querySelectorAll('[data-faq-trigger]').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.closest('.faq-item');
    if (!item) {
      return;
    }

    item.classList.toggle('open');
    const expanded = item.classList.contains('open');
    button.setAttribute('aria-expanded', String(expanded));
  });
});

const modal = document.querySelector('[data-modal]');
const openModalButtons = document.querySelectorAll('[data-modal-open]');
const closeModalButtons = document.querySelectorAll('[data-modal-close]');

const closeModal = () => {
  if (!modal) {
    return;
  }

  modal.classList.add('hidden');
  body.classList.remove('overflow-hidden');
};

if (modal) {
  openModalButtons.forEach(button => {
    button.addEventListener('click', () => {
      modal.classList.remove('hidden');
      body.classList.add('overflow-hidden');
    });
  });

  closeModalButtons.forEach(button => {
    button.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
    }
  });
}

const demandForm = document.querySelector('[data-demand-form]');
if (demandForm) {
  demandForm.addEventListener('submit', event => {
    if (demandForm.hasAttribute('data-demand-search-form')) {
      return;
    }

    event.preventDefault();
    const input = demandForm.querySelector('input[name="demand"]');
    if (!input || !input.value.trim()) {
      return;
    }

    const query = encodeURIComponent(input.value.trim());
    window.location.href = `./pages/search-demand.html?q=${query}`;
  });
}
