/* js/catalog.js — Carrusel continuo (CSS animado) + flechas + bucle perfecto */

/* ========== Config WhatsApp ========== */
const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

/* ========== Utils ========== */
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

/* Ocultar scrollbars (por si quedan rastros en algún modo no-marquee) */
(() => {
  const css = `
    .no-scrollbar{ scrollbar-width:none; -ms-overflow-style:none; }
    .no-scrollbar::-webkit-scrollbar{ display:none; width:0; height:0; }

    /* Vista tipo cinta: track como "viewport" que enmascara */
    .marquee-viewport{ position:relative; overflow:hidden; }

    /* Capa de desplazamiento manual (flechas) */
    .marquee-shift{ will-change: transform; transform: translateX(var(--shift, 0px)); }

    /* Fila animada en bucle (dos copias) */
    .marquee-row{
      display:flex; align-items:stretch; gap:var(--gap,16px);
      will-change: transform;
      animation-name: marquee-linear;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
      animation-play-state: running;
      /* La distancia (negativa) y la duración se fijan por elemento:
         --dist: -<px>;
         --dur: <s>;
      */
      animation-duration: var(--dur, 30s);
    }

    /* Animación genérica: usa variable --dist */
    @keyframes marquee-linear {
      from { transform: translateX(0); }
      to   { transform: translateX(var(--dist)); }
    }
  `;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
})();

/* ========== Data ========== */
async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

/* ========== UI: Tarjeta ========== */
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

/* ========== Carrusel continuo basado en CSS (marquee) ========== */
/* Convierte .track en un "viewport" y crea:
   .track.marquee-viewport
     > .marquee-shift (mueve con flechas mediante --shift)
         > .marquee-row (ANIMADA: se traduce -dist px, en 'dur' seg, en bucle)
            [items ...] + [clones ...]
*/
function makeMarquee(track, { pxPerSec = 20 } = {}) {
  if (track._marquee) return; // ya configurado
  track._marquee = true;

  // El track original hace de viewport (enmascara)
  track.classList.add("marquee-viewport", "no-scrollbar");
  track.style.overflowX = "hidden";          // evitamos scroll manual
  track.style.scrollBehavior = "auto";       // que nada frene la animación
  // Conservamos el gap original si existe en tu CSS (site.css usa gap:16px)
  const computed = getComputedStyle(track);
  const gapPx = parseFloat(computed.gap || computed.columnGap || "16") || 16;

  // Crear contenedores
  const shift = document.createElement("div");
  shift.className = "marquee-shift";
  const row = document.createElement("div");
  row.className = "marquee-row";
  row.style.setProperty("--gap", `${gapPx}px`);

  // Mover hijos actuales a la fila
  const items = Array.from(track.children);
  items.forEach((ch) => row.appendChild(ch));

  // Duplicar para bucle perfecto
  const clones = items.map((n) => n.cloneNode(true));
  clones.forEach((c) => row.appendChild(c));

  // Inyectar estructura
  shift.appendChild(row);
  track.appendChild(shift);

  // Calcular ancho de la copia original (items.length)
  const calcDistance = () => {
    // sumatoria de anchos + gaps entre items (solo de la primera mitad)
    let width = 0;
    for (let i = 0; i < items.length; i++) {
      width += items[i].getBoundingClientRect().width;
    }
    const totalGaps = Math.max(items.length - 1, 0) * gapPx;
    const dist = width + totalGaps;

    // distancia negativa hasta donde debe moverse la fila animada
    row.style.setProperty("--dist", `${-dist}px`);

    // duración = distancia / velocidad
    const dur = Math.max(dist / pxPerSec, 8); // mínimo para suavidad
    row.style.setProperty("--dur", `${dur}s`);
  };

  // Necesitamos esperar al frame de layout para medir
  requestAnimationFrame(calcDistance);

  // Pausa/Resume on hover/touch
  const section = track.closest("section") || track;
  section.addEventListener("mouseenter", () => (row.style.animationPlayState = "paused"));
  section.addEventListener("mouseleave", () => (row.style.animationPlayState = "running"));
  section.addEventListener("touchstart", () => (row.style.animationPlayState = "paused"), { passive: true });
  section.addEventListener("touchend",   () => (row.style.animationPlayState = "running"));

  // Recalcular en resize (por cambios responsivos)
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      // Reiniciar la animación para aplicar nueva distancia/duración
      row.style.animation = "none";
      calcDistance();
      // forzar reflujo y reactivar
      row.offsetHeight; // eslint-disable-line no-unused-expressions
      row.style.animationName = "marquee-linear";
    }, 120);
  });

  // Exponer control de desplazamiento por flechas: variable --shift en .marquee-shift
  track._marqueeApi = {
    nudge(dx) {
      const current = parseFloat(getComputedStyle(shift).getPropertyValue("--shift")) || 0;
      shift.style.setProperty("--shift", `${current + dx}px`);
    },
    pause(ms = 1000) {
      row.style.animationPlayState = "paused";
      if (ms) setTimeout(() => (row.style.animationPlayState = "running"), ms);
    },
  };
}

/* ========== Carrusel con flechas ==========
   - Si hay >4 items => modo marquee (auto continuo)
   - Si hay <=4 => comportamiento scroll normal con flechas
*/
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

  // Paso de flechas (~ casi un viewport)
  const step = () => Math.max(track.clientWidth * 0.9, 280);

  if (itemsCount > 4) {
    // === MODO MARQUEE (auto continuo) ===
    makeMarquee(track, { pxPerSec: 20 }); // ajusta velocidad aquí (px/seg)

    // Flechas: empujan la capa "shift" sin romper la animación
    prevBtn.addEventListener("click", () => {
      track._marqueeApi?.pause(800);
      track._marqueeApi?.nudge(+step());
    });
    nextBtn.addEventListener("click", () => {
      track._marqueeApi?.pause(800);
      track._marqueeApi?.nudge(-step());
    });
  } else {
    // === MODO CLÁSICO (scroll con flechas) ===
    track.classList.add("no-scrollbar");
    track.style.overflowX = "auto";
    track.style.scrollBehavior = "smooth";

    const go = (dx) => track.scrollBy({ left: dx, behavior: "smooth" });
    prevBtn.addEventListener("click", () => go(-step()));
    nextBtn.addEventListener("click", () => go(+step()));
  }
}

/* ========== Render por sección ========== */
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

