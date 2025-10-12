/* Carrusel continuo estable (sin scrollLeft):
   - Convierte .track en viewport y crea una fila .row (flex)
   - Duplica las tarjetas para bucle perfecto
   - Anima con requestAnimationFrame usando transform: translateX()
   - Flechas: empujan suavemente (pausa breve y reanuda)
*/

const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

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

/* Espera a que las <img> dentro de container tengan tamaño */
function waitImages(container) {
  const imgs = [...container.querySelectorAll("img")];
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

/* ----- Motor de carrusel con transform ----- */
function makeLooper(track, { pxPerSec = 26, enableAuto = true } = {}) {
  if (track._looper) return;
  track._looper = true;

  // Guardar tarjetas originales
  const firstSet = [...track.children];
  if (firstSet.length === 0) return;

  // Crear estructura viewport/row
  track.classList.add("is-viewport");      // overflow hidden
  const row = document.createElement("div");
  row.className = "loop-row";              // flex horizontal
  track.appendChild(row);

  // Mover originales
  firstSet.forEach(n => row.appendChild(n));
  // Clonar para bucle perfecto
  firstSet.forEach(n => row.appendChild(n.cloneNode(true)));

  // Medir ancho del primer bloque
  const measureBlockWidth = () => {
    const n = firstSet.length;
    let w = 0;
    for (let i = 0; i < n; i++) w += row.children[i].getBoundingClientRect().width;
    // sumar gaps (se leen del estilo computado del row)
    const gap = parseFloat(getComputedStyle(row).gap || "16") || 16;
    w += gap * Math.max(n - 1, 0);
    track._blockW = w;
  };

  measureBlockWidth();

  // Estado de animación
  let last = 0;
  let offset = 0;          // avance acumulado automático (px)
  let manual = 0;          // empuje manual con flechas (px)
  let paused = !enableAuto;

  const normalize = (x, m) => {
    // módulo positivo en [0, m)
    return ((x % m) + m) % m;
    // render aplica signo negativo para desplazar a la izquierda
  };

  const render = () => {
    const total = track._blockW || 1;
    // desplazamiento a la izquierda
    const x = -normalize(offset + manual, total);
    row.style.transform = `translateX(${x}px)`;
  };

  const tick = (ts) => {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;

    if (!paused) {
      offset += pxPerSec * dt;
      render();
    }
    track._raf = requestAnimationFrame(tick);
  };

  // Arrancar
  render();
  track._raf = requestAnimationFrame(tick);

  // API pública
  track._looperAPI = {
    nudge(dx) {                   // flechas
      manual += dx;
      paused = true;
      render();
      clearTimeout(track._resumeT);
      track._resumeT = setTimeout(() => { paused = !enableAuto ? true : false; }, 1000);
    },
    pause(v) { paused = v; },
    setSpeed(s) { pxPerSec = s; },
    remesure() { measureBlockWidth(); render(); }
  };

  // Hover/touch pausa
  const section = track.closest(".catalog-section") || track;
  section.addEventListener("mouseenter", () => track._looperAPI.pause(true));
  section.addEventListener("mouseleave", () => track._looperAPI.pause(!enableAuto ? true : false));
  section.addEventListener("touchstart", () => track._looperAPI.pause(true), { passive: true });
  section.addEventListener("touchend",   () => track._looperAPI.pause(!enableAuto ? true : false));

  // Resize recalcula bloque
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => track._looperAPI.remesure(), 120);
  });
}

/* Configurar flechas y animación (si aplica) */
async function setupCarousel(carouselEl, itemsCount) {
  const track   = carouselEl.querySelector(".track");
  const prevBtn = carouselEl.querySelector(".nav-btn.prev");
  const nextBtn = carouselEl.querySelector(".nav-btn.next");
  if (!track) return;

  // Espera imágenes para medir correctamente
  await waitImages(track);

  // Si sólo hay 1 item, centrar y ocultar flechas
  if (itemsCount <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    track.style.justifyContent  = "center";
    return;
  }

  // Para más de 4 items activamos auto; con 4 o menos, queda sin auto pero con flechas
  const enableAuto = itemsCount > 4;
  makeLooper(track, { pxPerSec: 22, enableAuto });

  // Flechas: empujan la fila, siempre disponibles
  const step = () => Math.max(track.clientWidth * 0.9, 280);
  prevBtn.addEventListener("click", () => track._looperAPI?.nudge(+step()));
  nextBtn.addEventListener("click", () => track._looperAPI?.nudge(-step()));
}

/* Render por sección */
async function renderSection(sectionEl, items) {
  const track = sectionEl.querySelector(".track");
  if (!track) return;

  // Limpiar (deja track vacío y sin clases previas)
  track.innerHTML = "";
  track.classList.remove("is-viewport");
  track.style.transform = "";
  if (track._raf) cancelAnimationFrame(track._raf);
  track._looper = false;
  track._looperAPI = null;

  items.forEach((p) => track.appendChild(card(p)));
  await setupCarousel(sectionEl.querySelector(".carousel"), items.length);
}

/* Bootstrap */
(async () => {
  try {
    const data = await loadData();
    for (const sec of document.querySelectorAll(".catalog-section")) {
      const key  = sec.getAttribute("data-category"); // women, men, black, red, lavit
      const list = Array.isArray(data[key]) ? data[key] : [];
      await renderSection(sec, list);
    }
  } catch (e) {
    console.error(e);
  }
})();
