/* js/catalog.js — Carrusel auto (fluido, infinito) + flechas
   - Auto-rotación continua (sin pausas)
   - Cuando llega al “final” vuelve al primero sin salto (contenido clonado)
   - Flechas siguen funcionando (pausan y luego reanudan)
   - Sin barra de desplazamiento visible
*/

// -------- Config WhatsApp ----------
const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

// -------- Utilidades ---------------
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

// Ocultar scrollbars globalmente
(() => {
  const css = `
    .no-scrollbar{ scrollbar-width: none; -ms-overflow-style: none; }
    .no-scrollbar::-webkit-scrollbar{ display: none; width:0; height:0; }
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

// -------- Carrusel: núcleo ---------

/**
 * Inicia auto-scroll suave e infinito.
 * Si el contenido es más largo que el contenedor, duplica los ítems
 * y anima con requestAnimationFrame a velocidad constante.
 */
function startInfiniteAutoScroll(scroller, opts = {}) {
  const {
    pxPerSec = 24,   // velocidad (px/seg) — sube o baja si quieres
    pauseMsAfterClick = 1200, // pausa breve tras usar flechas
  } = opts;

  // No hay nada que desplazar
  if (scroller.scrollWidth <= scroller.clientWidth + 1) return;

  // Evitar dobles inicios
  if (scroller._autoStarted) return;
  scroller._autoStarted = true;

  // Duplicar contenido SOLO una vez para que el bucle sea perfecto
  if (!scroller.dataset.cloned) {
    const children = Array.from(scroller.children).map((n) => n.cloneNode(true));
    scroller.append(...children);
    scroller.dataset.cloned = "1";
  }

  scroller.classList.add("no-scrollbar");

  let raf = null;
  let lastTs = 0;
  let paused = false;
  let clickPauseUntil = 0;

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;

    // pausa por interacción manual (flechas/drag)
    if (clickPauseUntil > ts) {
      raf = requestAnimationFrame(tick);
      return;
    }

    if (!paused) {
      const dt = (ts - lastTs) / 1000; // segundos
      const deltaPx = pxPerSec * dt;
      scroller.scrollLeft += deltaPx;

      // Mitad = largo real (porque duplicamos)
      const half = scroller.scrollWidth / 2;
      if (scroller.scrollLeft >= half) scroller.scrollLeft = 0;
    }

    lastTs = ts;
    raf = requestAnimationFrame(tick);
  };

  // Iniciar animación
  raf = requestAnimationFrame(tick);

  // Pausas por hover/touch
  scroller.addEventListener("mouseenter", () => (paused = true));
  scroller.addEventListener("mouseleave", () => (paused = false));
  scroller.addEventListener("touchstart", () => (paused = true), { passive: true });
  scroller.addEventListener("touchend",   () => (paused = false));

  // API para pausar brevemente tras flechas
  scroller._pauseAfterClick = () => {
    clickPauseUntil = performance.now() + pauseMsAfterClick;
  };

  // Recalcular al redimensionar
  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // si el ancho cambió mucho, reiniciamos a 0 para evitar “micro saltos”
      scroller.scrollLeft = scroller.scrollLeft % (scroller.scrollWidth / 2);
    }, 120);
  };
  window.addEventListener("resize", onResize);
}

// Configurar flechas + auto-scroll
function setupCarousel(carouselEl, itemsCount) {
  const scroller = carouselEl.querySelector(".track");
  const prevBtn  = carouselEl.querySelector(".prev");
  const nextBtn  = carouselEl.querySelector(".next");

  // Si hay 1 producto: centrar y quitar flechas
  if (itemsCount <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    scroller.style.justifyContent   = "center";
    scroller.style.gridAutoColumns  = "minmax(260px, 420px)";
    scroller.classList.add("no-scrollbar");
    return;
  }

  // Paso de las flechas ~ casi un viewport de carrusel
  const step = () => Math.max(scroller.clientWidth * 0.9, 280);

  const go = (dx) => {
    scroller._pauseAfterClick?.();
    scroller.scrollBy({ left: dx, behavior: "smooth" });
  };

  prevBtn.addEventListener("click", () => go(-step()));
  nextBtn.addEventListener("click", () => go(step()));

  // Auto-scroll infinito si hay más de 4 (tu requisito)
  if (itemsCount > 4) {
    // velocidad ajustable: 20–30 px/s suele verse muy bien
    startInfiniteAutoScroll(scroller, { pxPerSec: 26, pauseMsAfterClick: 1300 });
  } else {
    // sin auto-scroll: igualmente ocultamos la barra
    scroller.classList.add("no-scrollbar");
  }
}

// Renderizar una sección (mujer/hombre/…)
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
