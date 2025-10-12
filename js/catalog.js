/* js/catalog.js — Carrusel continuo real (flex + duplicación + bucle perfecto) */

/* ========= Config WhatsApp ========= */
const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

/* ========= Utils ========= */
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

/* Cargar datos del catálogo */
async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

/* Crear tarjeta de producto */
function card(p) {
  const el = document.createElement("article");
  el.className = "card";
  const href = `https://wa.me/${WA_PHONE}?text=${WA_MSG}%0A${encodeURIComponent(p.name)}`;
  el.innerHTML = `
    <div class="card__img"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
    <div class="card__body">
      <h3 class="card__title">${p.name}</h3>
      ${p.description ? `<p class="card__sub">${p.description}</p>` : ""}
      ${p.price ? `<div class="card__price">${money(p.price)}</div>` : ""}
      <div class="card__actions">
        <a class="btn btn-primary card__btn" target="_blank" href="${href}">Consultar por WhatsApp</a>
      </div>
    </div>
  `;
  return el;
}

/* Duplica los elementos hasta llenar al menos 2.5× el ancho visible */
function cloneUntil(track, scroller) {
  if (track.dataset.cloned) return;
  const orig = Array.from(track.children);
  if (orig.length === 0) return;
  while (track.scrollWidth < scroller.clientWidth * 2.5) {
    orig.forEach(n => track.appendChild(n.cloneNode(true)));
  }
  track.dataset.cloned = "1";
}

/* Auto-scroll continuo y en bucle */
function startAuto(scroller, track, { pxPerSec = 26, pauseAfterClick = 1200 } = {}) {
  if (scroller._autoStarted) return;
  scroller._autoStarted = true;

  cloneUntil(track, scroller);

  let last = 0;
  let paused = false;
  let until = 0;

  const tick = (ts) => {
    if (!last) last = ts;

    if (until > ts) { requestAnimationFrame(tick); return; }

    if (!paused) {
      const dt = (ts - last) / 1000;
      scroller.scrollLeft += pxPerSec * dt;
      const half = track.scrollWidth / 2;
      if (scroller.scrollLeft >= half) scroller.scrollLeft -= half;
    }

    last = ts;
    requestAnimationFrame(tick);
  };

  // Pausas por hover/touch
  scroller.addEventListener("mouseenter", () => paused = true);
  scroller.addEventListener("mouseleave", () => paused = false);
  scroller.addEventListener("touchstart", () => paused = true, { passive:true });
  scroller.addEventListener("touchend",   () => paused = false);

  // API para flechas
  scroller._pauseShort = () => { until = performance.now() + pauseAfterClick; };

  // Recalcular al redimensionar
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      cloneUntil(track, scroller);
      const half = track.scrollWidth / 2;
      scroller.scrollLeft = scroller.scrollLeft % half;
    }, 120);
  });

  requestAnimationFrame(tick);
}

/* Configurar carrusel (auto o clásico) */
function setupCarousel(carouselEl, count) {
  const track = carouselEl.querySelector(".track");
  const prev  = carouselEl.querySelector(".prev");
  const next  = carouselEl.querySelector(".next");
  const scroller = track;

  if (count <= 1) {
    prev.style.display = "none";
    next.style.display = "none";
    scroller.style.justifyContent = "center";
    return;
  }

  const step = () => Math.max(scroller.clientWidth * 0.9, 280);
  const go = (dx) => {
    scroller._pauseShort?.();
    scroller.scrollBy({ left: dx, behavior: "smooth" });
  };

  prev.addEventListener("click", () => go(-step()));
  next.addEventListener("click", () => go(step()));

  if (count > 4) {
    startAuto(scroller, track, { pxPerSec: 26, pauseAfterClick: 1200 });
  }
}

/* Renderizar secciones */
function renderSection(sec, items) {
  const track = sec.querySelector(".track");
  track.innerHTML = "";
  items.forEach(p => track.appendChild(card(p)));
  setupCarousel(sec.querySelector(".carousel"), items.length);
}

/* Inicio */
(async () => {
  try {
    const data = await loadData();
    document.querySelectorAll(".catalog-section").forEach(sec => {
      const key = sec.getAttribute("data-category");
      const list = Array.isArray(data[key]) ? data[key] : [];
      renderSection(sec, list);
    });
  } catch (e) {
    console.error(e);
  }
})();


