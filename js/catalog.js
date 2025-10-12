/* Carrusel simple y robusto:
   - Duplica las tarjetas para bucle perfecto
   - Auto-rotación continua con requestAnimationFrame
   - Pausa con hover, touch o flechas
   - Arranca SOLO cuando existe overflow (tras cargar imágenes)
*/

// WhatsApp
const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

// Utils
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

// Data
async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

// Tarjeta
function card(product) {
  const el = document.createElement("article");
  el.className = "card";
  el.setAttribute("role", "listitem");

  const href = `https://wa.me/${WA_PHONE}?text=${WA_MSG}%0A${encodeURIComponent(product.name)}`;

  el.innerHTML = `
    <div class="card__img">
      <img src="${product.image}" alt="${product.name}" loading="lazy">
    </div>
    <div class="card__body">
      <h3 class="card__title">${product.name}</h3>
      ${product.description ? `<p class="card__sub">${product.description}</p>` : ""}
      ${product.price ? `<div class="card__price">${money(product.price)}</div>` : ""}
      <div class="card__actions">
        <a class="btn btn-primary card__btn" target="_blank" href="${href}">
          Consultar por WhatsApp
        </a>
      </div>
    </div>
  `;
  return el;
}

/* Espera a que todas las <img> dentro de un contenedor estén “cargadas” */
function waitImages(container) {
  const imgs = Array.from(container.querySelectorAll("img"));
  if (imgs.length === 0) return Promise.resolve();
  const pend = imgs.filter(i => !i.complete);
  if (pend.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let left = pend.length;
    const done = () => (--left === 0 && resolve());
    pend.forEach(i => {
      i.addEventListener("load", done, { once: true });
      i.addEventListener("error", done, { once: true });
    });
  });
}

/* Auto-scroll continuo con bucle perfecto */
function startAutoLoop(track, { pxPerSec = 26, pauseAfterClick = 1200 } = {}) {
  if (track._autoStarted) return;
  track._autoStarted = true;

  // Duplicar tarjetas si aún no se ha hecho (para el bucle)
  if (!track._cloned) {
    const originalChildren = Array.from(track.children);
    const clones = originalChildren.map(n => n.cloneNode(true));
    track.append(...clones);
    track._cloned = true;
  }

  // Metadatos de bucle
  const calcHalf = () => (track._halfWidth = track.scrollWidth / 2);
  calcHalf();

  // Animación
  let last = 0;
  let paused = false;
  let pauseUntil = 0;

  const tick = (ts) => {
    if (!last) last = ts;

    if (pauseUntil > ts) {
      requestAnimationFrame(tick);
      return;
    }

    if (!paused) {
      const dt = (ts - last) / 1000;
      track.scrollLeft += pxPerSec * dt;

      // loop suave (volvemos al primer “bloque”)
      if (track.scrollLeft >= track._halfWidth) {
        track.scrollLeft -= track._halfWidth;
      }
    }

    last = ts;
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);

  // API para flechas
  track._pauseAfterClick = () => {
    pauseUntil = performance.now() + pauseAfterClick;
  };

  // Pausas por hover/touch
  const setPaused = (v) => { paused = v; };
  track.addEventListener("mouseenter", () => setPaused(true));
  track.addEventListener("mouseleave", () => setPaused(false));
  track.addEventListener("touchstart", () => setPaused(true), { passive: true });
  track.addEventListener("touchend",   () => setPaused(false));

  // Recalcular mitad cuando cambie el layout
  let t;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      calcHalf();
      track.scrollLeft = track.scrollLeft % track._halfWidth;
    }, 120);
  };
  window.addEventListener("resize", onResize);
}

/* Configura flechas y auto */
async function setupCarousel(carouselEl, itemsCount) {
  const track   = carouselEl.querySelector(".track");
  const prevBtn = carouselEl.querySelector(".nav-btn.prev");
  const nextBtn = carouselEl.querySelector(".nav-btn.next");
  if (!track) return;

  // Un solo producto: centrar y ocultar flechas
  if (itemsCount <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    track.style.justifyContent  = "center";
    track.classList.add("no-scrollbar");
    return;
  }

  // Paso de flechas
  const step = () => Math.max(track.clientWidth * 0.9, 280);
  const go = (dx) => track.scrollBy({ left: dx, behavior: "smooth" });

  prevBtn.addEventListener("click", () => {
    track._pauseAfterClick?.();
    go(-step());
  });
  nextBtn.addEventListener("click", () => {
    track._pauseAfterClick?.();
    go(+step());
  });

  // Espera a que las imágenes tengan tamaño y verifica overflow real
  await waitImages(track);

  const hasOverflow = track.scrollWidth > track.clientWidth + 1;

  // Auto-scroll sólo si hay >4 items y realmente hay overflow
  if (itemsCount > 4 && hasOverflow) {
    startAutoLoop(track, { pxPerSec: 26, pauseAfterClick: 1200 });
  }
}

/* Render de cada sección */
async function renderSection(sectionEl, items) {
  const track = sectionEl.querySelector(".track");
  if (!track) return;

  track.innerHTML = "";
  items.forEach((p) => track.appendChild(card(p)));

  await setupCarousel(sectionEl.querySelector(".carousel"), items.length);
}

/* Arranque */
(async () => {
  try {
    const data = await loadData();
    document.querySelectorAll(".catalog-section").forEach(async (sec) => {
      const key  = sec.getAttribute("data-category"); // women, men, black, red, lavit
      const list = Array.isArray(data[key]) ? data[key] : [];
      await renderSection(sec, list);
    });
  } catch (e) {
    console.error(e);
  }
})();
