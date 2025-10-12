/* Carrusel FLEX con auto-rotación en bucle + flechas
   - Auto cuando hay >4 productos (duplica y hace loop)
   - Flechas desplazan y pausan brevemente el auto
   - Pausa en hover/touch
*/

/* Config WhatsApp */
const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

/* Utils */
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

/* Data */
async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

/* Tarjeta */
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

/* Auto-scroll infinito con loop */
function startAuto(scroller, { pxPerSec = 28, pauseAfterClick = 1200 } = {}) {
  if (scroller._autoStarted) return;
  scroller._autoStarted = true;

  // Sólo auto si de verdad hay overflow
  if (scroller.scrollWidth <= scroller.clientWidth + 1) return;

  // Duplicar contenido para que el loop sea perfecto
  if (!scroller._cloned) {
    const originals = Array.from(scroller.children);
    scroller.append(...originals.map(n => n.cloneNode(true)));
    scroller._halfWidth = scroller.scrollWidth / 2; // después de clonar
    scroller._cloned = true;
  }

  let last = 0;
  let paused = false;
  let pauseUntil = 0;
  let rafId = 0;

  const tick = (ts) => {
    if (!last) last = ts;

    // pausa por clic en flechas
    if (pauseUntil > ts) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    if (!paused) {
      const dt = (ts - last) / 1000;
      scroller.scrollLeft += pxPerSec * dt;

      // loop suave
      if (scroller.scrollLeft >= scroller._halfWidth) {
        scroller.scrollLeft -= scroller._halfWidth;
      }
    }

    last = ts;
    rafId = requestAnimationFrame(tick);
  };

  // Iniciar
  rafId = requestAnimationFrame(tick);

  // Exponer API para flechas
  scroller._pauseAfterClick = () => {
    pauseUntil = performance.now() + pauseAfterClick;
  };

  // Pausas por hover/touch
  const setPaused = (v) => { paused = v; };
  scroller.addEventListener("mouseenter", () => setPaused(true));
  scroller.addEventListener("mouseleave", () => setPaused(false));
  scroller.addEventListener("touchstart", () => setPaused(true), { passive: true });
  scroller.addEventListener("touchend",   () => setPaused(false));

  // Ajuste al redimensionar (recalcular mitad)
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      scroller._halfWidth = scroller.scrollWidth / 2;
      // normalizar posición dentro de la mitad
      scroller.scrollLeft = scroller.scrollLeft % scroller._halfWidth;
    }, 120);
  });
}

/* Flechas + modo auto si aplica */
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
    track.classList.add("no-scrollbar");
    return;
  }

  // Paso de flecha: casi un viewport
  const step = () => Math.max(track.clientWidth * 0.9, 280);

  // Si hay >4, activar auto-rotación (loop)
  if (itemsCount > 4) {
    startAuto(track, { pxPerSec: 30, pauseAfterClick: 1200 });

    // flechas: desplazan y ponen pausa breve
    const go = (dx) => {
      track._pauseAfterClick?.();
      track.scrollBy({ left: dx, behavior: "smooth" });
    };
    prevBtn.addEventListener("click", () => go(-step()));
    nextBtn.addEventListener("click", () => go(+step()));
  } else {
    // Modo clásico con flechas (sin auto)
    const go = (dx) => track.scrollBy({ left: dx, behavior: "smooth" });
    prevBtn.addEventListener("click", () => go(-step()));
    nextBtn.addEventListener("click", () => go(+step()));
  }
}

/* Render sección */
function renderSection(sectionEl, items) {
  const track = sectionEl.querySelector(".track");
  if (!track) return;
  track.innerHTML = "";
  items.forEach((p) => track.appendChild(card(p)));
  setupCarousel(sectionEl.querySelector(".carousel"), items.length);
}

/* Arranque */
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
