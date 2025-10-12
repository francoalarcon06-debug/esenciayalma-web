/* js/catalog.js — Auto carrusel continuo garantizado (sobre .track)
   - scrollLeft en .track (no en el contenedor)
   - fuerza overflow-x:auto y quita smooth de CSS durante la animación
   - clona items para bucle perfecto
   - flechas funcionan, con pausa breve y reanudación
*/

// -------- WhatsApp ----------
const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

// -------- Utilidades ----------
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

// Ocultar scrollbars
(() => {
  const css = `
    .no-scrollbar{ scrollbar-width:none; -ms-overflow-style:none; }
    .no-scrollbar::-webkit-scrollbar{ display:none; width:0; height:0; }
  `;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
})();

// Cargar datos
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

/* ========== Auto-scroll continuo en .track ========== */
function startContinuous(track, { pxPerSec = 28, pauseAfterClickMs = 1200 } = {}) {
  // Asegurar que .track sea scrolleable y sin smooth (el smooth frena el rAF)
  track.style.overflowX = "auto";
  track.style.scrollBehavior = "auto";
  track.classList.add("no-scrollbar");

  // Sin overflow: nada que animar
  if (track.scrollWidth <= track.clientWidth + 1) return;
  if (track._autoStarted) return;
  track._autoStarted = true;

  // Clonar hijos para bucle perfecto
  if (!track.dataset.cloned) {
    const clones = Array.from(track.children).map(n => n.cloneNode(true));
    track.append(...clones);
    track.dataset.cloned = "1";
  }

  let lastTs = 0;
  let paused = false;
  let pauseUntil = 0;

  const step = (ts) => {
    if (!lastTs) lastTs = ts;

    // Pausa breve tras flechas
    if (pauseUntil > ts) {
      requestAnimationFrame(step);
      return;
    }

    if (!paused) {
      const dt = (ts - lastTs) / 1000;
      // mover en píxeles por segundo
      track.scrollLeft += pxPerSec * dt;

      // mitad = ancho real previo al clonado
      const half = track.scrollWidth / 2;
      if (track.scrollLeft >= half) track.scrollLeft = 0;
    }

    lastTs = ts;
    requestAnimationFrame(step);
  };

  // Pausar al interactuar
  track.addEventListener("mouseenter", () => (paused = true));
  track.addEventListener("mouseleave", () => (paused = false));
  track.addEventListener("touchstart", () => (paused = true), { passive: true });
  track.addEventListener("touchend",   () => (paused = false));

  // API: pausa tras click de flechas
  track._pauseAfterClick = () => {
    pauseUntil = performance.now() + pauseAfterClickMs;
  };

  requestAnimationFrame(step);
}

/* ========== Carrusel (flechas + auto si > 4) ========== */
function setupCarousel(carouselEl, itemsCount) {
  const track   = carouselEl.querySelector(".track");
  const prevBtn = carouselEl.querySelector(".nav-btn.prev");
  const nextBtn = carouselEl.querySelector(".nav-btn.next");
  if (!track) return;

  // Un solo producto: centrar y ocultar flechas
  if (itemsCount <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    track.style.justifyContent  = "center";
    track.style.gridAutoColumns = "minmax(260px, 420px)";
    track.classList.add("no-scrollbar");
    return;
  }

  // Paso de flechas (~un viewport)
  const step = () => Math.max(track.clientWidth * 0.9, 280);
  const go = (dx) => {
    // pausa breve el auto mientras se usa flecha
    track._pauseAfterClick?.();
    // usar smooth SOLO para el click manual
    track.style.scrollBehavior = "smooth";
    track.scrollBy({ left: dx, behavior: "smooth" });
    // y tras un ratito volver a "auto" para el rAF
    setTimeout(() => { track.style.scrollBehavior = "auto"; }, 400);
  };

  prevBtn.addEventListener("click", () => go(-step()));
  nextBtn.addEventListener("click", () => go(step()));

  // Activar auto-scroll continuo si hay más de 4 productos
  if (itemsCount > 4) {
    startContinuous(track, { pxPerSec: 28, pauseAfterClickMs: 1200 });
  } else {
    track.classList.add("no-scrollbar");
  }
}

/* ========== Renderizado por sección ========== */
function renderSection(sectionEl, items) {
  const track = sectionEl.querySelector(".track");
  if (!track) return;
  track.innerHTML = "";
  items.forEach((p) => track.appendChild(card(p)));
  setupCarousel(sectionEl.querySelector(".carousel"), items.length);
}

/* ========== Bootstrap ========== */
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
