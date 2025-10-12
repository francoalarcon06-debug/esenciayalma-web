/* Carrusel FLEX con auto-rotación en bucle + flechas
   Arranca el auto SOLO cuando hay overflow real (tras cargar imágenes)
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

/* -------- Auto-scroll infinito -------- */
function reallyStartAuto(scroller, { pxPerSec = 28, pauseAfterClick = 1200 } = {}) {
  if (scroller._autoStarted) return;
  scroller._autoStarted = true;

  // Duplicar contenido para bucle perfecto una sola vez
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

    // pausa por click en flechas
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

  rafId = requestAnimationFrame(tick);

  // API para flechas
  scroller._pauseAfterClick = () => {
    pauseUntil = performance.now() + pauseAfterClick;
  };

  // Pausas por hover/touch
  const setPaused = (v) => { paused = v; };
  scroller.addEventListener("mouseenter", () => setPaused(true));
  scroller.addEventListener("mouseleave", () => setPaused(false));
  scroller.addEventListener("touchstart", () => setPaused(true), { passive: true });
  scroller.addEventListener("touchend",   () => setPaused(false));

  // Recalcular mitad si cambia el layout
  let t;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      scroller._halfWidth = scroller.scrollWidth / 2;
      scroller.scrollLeft = scroller.scrollLeft % scroller._halfWidth;
    }, 120);
  };
  window.addEventListener("resize", onResize);
}

/* Espera a que haya overflow real y entonces inicia el auto */
function ensureAutoWhenOverflow(scroller, opts) {
  const tryStart = () => {
    const hasOverflow = scroller.scrollWidth > scroller.clientWidth + 1;
    if (hasOverflow) {
      reallyStartAuto(scroller, opts);
      if (ro) ro.disconnect();
      imgs.forEach(img => img.removeEventListener("load", tryStart));
    }
  };

  // 1) Reintento por si ya hay overflow (por si no hay imágenes o ya están cacheadas)
  tryStart();

  // 2) Observa cambios de tamaño del contenido
  const ro = new ResizeObserver(() => tryStart());
  ro.observe(scroller);

  // 3) Cuando cargan imágenes (lazy), vuelve a intentar
  const imgs = Array.from(scroller.querySelectorAll("img"));
  imgs.forEach(img => img.addEventListener("load", tryStart, { passive: true }));
}

/* Flechas + arranque auto cuando aplique */
function setupCarousel(carouselEl, itemsCount) {
  const track   = carouselEl.querySelector(".track");
  const prevBtn = carouselEl.querySelector(".nav-btn.prev");
  const nextBtn = carouselEl.querySelector(".nav-btn.next");
  if (!track) return;

  // Un solo producto: ocultar flechas
  if (itemsCount <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    track.style.justifyContent  = "center";
    track.classList.add("no-scrollbar");
    return;
  }

  // Paso de flecha
  const step = () => Math.max(track.clientWidth * 0.9, 280);

  // >4 => auto-rotación con loop. Esperamos overflow real.
  if (itemsCount > 4) {
    ensureAutoWhenOverflow(track, { pxPerSec: 30, pauseAfterClick: 1200 });

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
