/* Motion helpers. Purely decorative — re-applies the entry animation
   and the stagger classes each time a view replaces #content. */
(function () {
  'use strict';

  var contentEl = document.getElementById('content');

  function staggerCards(root) {
    ['.ec', '.pipeline-card', '.stat-card', '.pb-card', '.calc-tile'].forEach(function (sel) {
      root.querySelectorAll(sel).forEach(function (card, i) {
        for (var n = 1; n <= 12; n++) card.classList.remove('stagger-' + n);
        card.classList.add('stagger-' + Math.min(i + 1, 12));
      });
    });
  }

  if (contentEl) {
    new MutationObserver(function () {
      contentEl.classList.remove('page-enter');
      void contentEl.offsetWidth;          // force a reflow so the animation restarts
      contentEl.classList.add('page-enter');
      staggerCards(contentEl);
      contentEl.addEventListener('animationend', function () {
        contentEl.classList.remove('page-enter');
      }, { once: true });
    }).observe(contentEl, { childList: true });
  }

  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var ic = item.querySelector('.nav-icon-box');
      if (!ic) return;
      ic.style.transform = 'scale(1.22)';
      setTimeout(function () { ic.style.transform = ''; }, 170);
    });
  });
})();
