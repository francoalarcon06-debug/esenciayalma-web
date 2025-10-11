const WA_PHONE = "56912345678"; // ← cámbialo si quieres distinto al del index
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");
const currency = n => `$${n.toLocaleString('es-CL')}`;

async function loadProducts() {
  const res = await fetch('data/products.json', {cache: 'no-store'});
  if (!res.ok) throw new Error('No pude cargar data/products.json');
  return res.json();
}

function createCard(p) {
  const el = document.createElement('article');
  el.className = 'card';
  el.setAttribute('role','listitem');
  el.innerHTML = `
    <div class="card__img">
      <img src="${p.img}" alt="${p.name}">
    </div>
    <div class="card__body">
      ${p.tag ? `<span class="badge-chip">${p.tag}</span>` : ``}
      <h3 class="card__title">${p.name}</h3>
      ${p.subtitle ? `<p class="card__sub">${p.subtitle}</p>` : ``}
      ${typeof p.price === 'number' ? `<div class="card__price">${currency(p.price)}</div>` : ``}
      <div class="card__actions">
        <a class="btn btn-primary card__btn" target="_blank"
           href="https://wa.me/${WA_PHONE}?text=${WA_MSG}%0A${encodeURIComponent(p.name)}">
           Consultar por WhatsApp
        </a>
      </div>
    </div>
  `;
  return el;
}

function updateNavButtonsState(track, prevBtn, nextBtn) {
  const maxScroll = track.scrollWidth - track.clientWidth - 1;
  prevBtn.disabled = track.scrollLeft <= 0;
  nextBtn.disabled = track.scrollLeft >= maxScroll;
}

function attachCarousel(carousel) {
  const track = carousel.querySelector('.track');
  const prevBtn = carousel.querySelector('.prev');
  const nextBtn = carousel.querySelector('.next');

  const step = () => Math.max(track.clientWidth * 0.9, 280);
  prevBtn.addEventListener('click', () => track.scrollBy({left: -step(), behavior: 'smooth'}));
  nextBtn.addEventListener('click', () => track.scrollBy({left:  step(), behavior: 'smooth'}));

  const onScroll = () => updateNavButtonsState(track, prevBtn, nextBtn);
  track.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll);

  const items = track.children.length;
  if (items <= 1) {
    carousel.classList.add('centered');
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    track.style.justifyContent = 'center';
    track.style.gridAutoColumns = 'minmax(260px, 420px)';
  } else {
    onScroll();
  }
}

function renderCategory(sectionEl, list) {
  const activeItems = list.filter(p => p.active !== false);
  const track = sectionEl.querySelector('.track');
  track.innerHTML = '';
  activeItems.forEach(p => track.appendChild(createCard(p)));
  attachCarousel(sectionEl.querySelector('.carousel'));
}

(async () => {
  try {
    const data = await loadProducts();
    document.querySelectorAll('.catalog-section').forEach(sec => {
      const key = sec.getAttribute('data-category');
      renderCategory(sec, data[key] || []);
    });
  } catch (e) {
    console.error(e);
  }
})();
