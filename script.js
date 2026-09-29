const revealEls = document.querySelectorAll('.reveal');
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.14 });
revealEls.forEach((el) => revealObs.observe(el));

const progress = document.querySelector('.scroll-progress span');
const glow = document.querySelector('.cursor-glow');

function updateScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  progress.style.width = pct + '%';
}
window.addEventListener('scroll', updateScroll, { passive: true });
updateScroll();

window.addEventListener('pointermove', (e) => {
  if (!glow) return;
  glow.style.left = e.clientX + 'px';
  glow.style.top = e.clientY + 'px';
});

// Jemný magnetic hover na desktopu
if (matchMedia('(pointer:fine)').matches) {
  document.querySelectorAll('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * .08}px, ${y * .12}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

// Aktivní sekce v navigaci
const navLinks = [...document.querySelectorAll('.nav a')];
const sectionMap = navLinks
  .map((a) => [a, document.querySelector(a.getAttribute('href'))])
  .filter(([, s]) => s);

const sectionObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.style.color = '');
    const match = sectionMap.find(([, s]) => s === entry.target);
    if (match) match[0].style.color = '#f2f2ee';
  });
}, { rootMargin: '-40% 0px -50% 0px' });
sectionMap.forEach(([, s]) => sectionObs.observe(s));
