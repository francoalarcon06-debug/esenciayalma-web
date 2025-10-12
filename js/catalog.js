/* js/catalog.js — Carrusel auto continuo + bucle + flechas
   - Detecta el elemento que realmente scrollea (track o su contenedor)
   - Duplica el contenido para bucle sin saltos
   - Auto-rotación constante (requestAnimationFrame)
   - Flechas funcionan (pausa breve y reanuda)
   - Oculta barras de scroll
*/

// -------- Config WhatsApp ----------
const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

// -------- Utilidades ---------------
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

// Ocultar scrollbars (Firefox/Chrome/Edge/Safari)
(() => {
  const css = `
    .no-scrollbar{ scrollbar-width:none; -ms-overflow-style:none; }
    .no-scrollbar::-webkit-scrollbar{ display:none; width:0; height:0; }
  `;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
})();

// Cargar datos del catálogo
async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

// Tarjeta de producto
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

/** Devuelve el elemento que realmente scrollea (track o su padre). */
function getScroller(track) {
  const cand = [track, track.parentElement];
  for (const el of cand) {
    if (!el) continue;
    const sw = el.scrollWidth, cw = el.clientWidth;
    if (sw - cw > 1) return el;
  }
  return track;
}

/** Auto-scroll infinito suave con requestAnimationFrame. */
function startInfiniteAutoScroll(scroller, track, opts = {}) {
  const {
    pxPerSec = 20,            // velocidad continua (px/seg)
    pauseMsAfterClick = 1200, // pausa breve tras flechas
  } = opts;

  if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
  if (scroller._autoStarted) return;
  scroller._autoStarted = true;

  // Duplica el contenido para bucle infinito
  if (!track.dataset.cloned) {
    const clones = Array.from(track.children).map((n) => n.cloneNode(true));
    track.append(...clones);
    track.dataset.cloned = "1";
  }

  scroller.classList.add("no-scrollbar");

  let raf = null;
  let lastTs = 0;
  let paused = false;
  let clickPauseUntil = 0;

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;

    // Pausa tras click en flechas
    if (clickPauseUntil > ts) {
      raf = requestAnimationFrame(tick);
      return;
    }

    if (!paused) {
      const dt = (ts - lastTs) / 1000;
      const delta = pxPerSec * dt;
      scroller.scrollLeft += delta;

      // Bucle infinito (volver al inicio)
      const half = scroller.scrollWidth / 2;
      if (scroller.scrollLeft >= half) scroller.scrollLeft = 0;
    }

    lastTs = ts;
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  // Pausa por hover o touch
  scroller.addEventListener("mouseenter", () => (paused = true));
  scroller.addEventListener("mouseleave", () => (paused = false));
  scroller.addEventListener("touchstart", () => (paused = true), { passive: true });
  scroller.addEventListener("touchend",   () => (paused = false));

  // API: Pausar temporalmente tras click
  scroller._pauseAfterClick = () => {
    clickPauseUntil = performance.now() + pauseMsAfterClick;
  };

  // Reajuste en resize
  let t = null;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const half = scroller.scrollWidth / 2;
      scroller.scrollLeft = scroller.scrollLeft % half;
    }, 100);
  };
  window.addEventListener("resize", onResize);
}

/** Configura flechas + auto-scroll si aplica. */
function setupCarousel(carouselEl, itemsCount) {
  const track   = carouselEl.querySelector(".track");
  const prevBtn = carouselEl.querySelector(".prev");
  const nextBtn = carouselEl.querySelector(".next");

  const scroller = getScroller(track);

  if (itemsCount <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    track.style.justifyContent  = "center";
    track.style.gridAutoColumns = "minmax(260px, 420px)";
    scroller.classList.add("no-scrollbar");
    return;
  }

  const step = () => Math.max(scroller.clientWidth * 0.9, 280);

  const go = (dx) => {
    scroller._pauseAfterClick?.();
    scroller.scrollBy({ left: dx, behavior: "smooth" });
  };

  prevBtn.addEventListener("click", () => go(-step()));
  nextBtn.addEventListener("click", () => go(step()));

  // Auto-scroll continuo si hay más de 4 productos
  if (itemsCount > 4) {
    startInfiniteAutoScroll(scroller, track, {
      pxPerSec: 20,           // velocidad (ajustable)
      pauseMsAfterClick: 1300 // pausa tras flechas
    });
  } else {
    scroller.classList.add("no-scrollbar");
  }
}

// Renderizar una sección
function renderSection(sectionEl, items) {
  const track = sectionEl.querySelector(".track");
  track.innerHTML = "";
  items.forEach((p) => track.appendChild(card(p)));
  setupCarousel(sectionEl.querySelector(".carousel"), items.length);
}

// -------- Arranque ----------
(async () => {
  try {
    const data = await loadData();
    document.querySelectorAll(".catalog-section").forEach((sec) => {
      const key  = sec.getAttribute("data-category"); // women, men, black, red, lavit
      const list = Array.isArray(data[key]) ? data[key] : [];
      renderSection(sec, list);
    });
  } catch (e) {
    console.error(e);
  }
})();

