// Navigation du site : l'indicateur glisse sous la page active (même principe que le FloatingNav).
(function () {
  var list = document.querySelector('.site-nav__list');
  if (!list) return;

  var indicator = document.createElement('span');
  indicator.className = 'site-nav__indicator';
  list.insertBefore(indicator, list.firstChild);

  var links = Array.prototype.slice.call(list.querySelectorAll('a'));
  var MOVE_MS = 450;

  function place(el, animate) {
    if (!el) {
      indicator.style.opacity = 0;
      return;
    }
    if (!animate) indicator.style.transition = 'none';
    indicator.style.opacity = 1;
    indicator.style.left = el.offsetLeft + 'px';
    indicator.style.width = el.offsetWidth + 'px';
    if (!animate) {
      indicator.offsetWidth; // force le rendu avant de rétablir la transition
      indicator.style.transition = '';
    }
  }

  function activeLink() {
    return list.querySelector('[aria-current="page"], .is-current');
  }

  // Au chargement : part du premier onglet, puis glisse jusqu'à la page active.
  var start = links[0];
  place(start, false);
  indicator.style.width = '0px';
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      place(activeLink(), true);
    });
  });

  // Au clic : l'indicateur glisse vers l'onglet choisi, puis la page s'ouvre.
  links.forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (link === activeLink() || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      place(link, true);
      setTimeout(function () {
        window.location.href = link.href;
      }, MOVE_MS);
    });
  });

  window.addEventListener('resize', function () {
    place(activeLink(), false);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { place(activeLink(), false); });
  }
})();
