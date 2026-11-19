(() => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) {
        menu.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        menu.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
  }
  const modal = document.querySelector('.lightbox');
  if (!modal) return;
  const modalImage = modal.querySelector('img');
  const caption = modal.querySelector('.lightbox-caption');
  const closeButton = modal.querySelector('.lightbox-close');
  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  document.querySelectorAll('.gallery-card').forEach(card => card.addEventListener('click', () => {
    const image = card.querySelector('img');
    modalImage.src = image.src;
    modalImage.alt = image.alt;
    caption.textContent = card.dataset.caption || image.alt;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeButton.focus();
  }));
  closeButton.addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && modal.classList.contains('is-open')) close(); });
})();
