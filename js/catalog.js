/* Carrusel continuo con transform + rAF (siempre en movimiento)
   - Bucle real SIN duplicar DOM: reciclamos items (primero→final / último→inicio)
   - Flechas empujan el offset sin pausar el auto
   - Sin pausas por hover/touch
*/

const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

// -------- Utils --------
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

// Espera a que las imágenes tengan tamaño (para medir bien)
function waitImages(container) {
  const imgs = [...container.querySelectorAll("img")];
  const pend = imgs.filter(i => !i.complete);
  if (pend.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let left = pend.length;
    const done = () => { if (--left === 0) resolve(); };
    pend.forEach(i => {
      i.addEventListener("load", done,  { once:true });
      i.addEventListener("error", done, { once:true });
    });
  });
}

// ========= Motor de cinta (transform + reciclaje) =========
function initLoop(track, { speed = 24 } = {}) {
  if (track._loopInited) return;
  track._loopInited = true;

  // Tomamos los hijos actuales (tarjetas)
  const originals = [...track.children];
  if (originals.length === 0) return;

  // Contenedor interno en fila
  const row = document.createElement("div");
  const gapCss = getComputedStyle(track).gap || "16px";
  const GAP = parseFloat(gapCss) || 16;

  row.style.display    = "flex";
  row.style.gap        = `${GAP}px`;
  row.style.willChange = "transform";
  row.style.transform  = "translateX(0px)";
  row.style.transition = "none";            // sin transición: rAF controla todo

  // El track actúa como viewport
  track.style.overflow = "hidden";
  track.style.position = "relative";

  originals.forEach(n => row.appendChild(n));
  track.appendChild(row);

  // Helpers para medir spans (ancho del primer/último ítem + gap a su vecino)
  const spanFirst = () => {
    if (row.children.length === 0) return 1;
    const first = row.children[0];
    const w = first.getBoundingClientRect().width;
    // gap solo aplica entre items; si hay 1, gap=0
    return w + (row.children.length > 1 ? GAP : 0);
  };
  const spanLast = () => {
    if (row.children.length === 0) return 1;
    const last = row.children[row.children.length - 1];
    const w = last.getBoundingClientRect().width;
    return w + (row.children.length > 1 ? GAP : 0);
  };

  // Reciclaje
  const moveFirstToEnd = () => {
    const first = row.children[0];
    if (first) row.appendChild(first);
  };
  const moveLastToStart = () => {
    const last = row.children[row.children.length - 1];
    if (last) row.insertBefore(last, row.firstChild);
  };

  // Estado
  let lastTs = 0;
  let offset = 0;  // avance acumulado en px (siempre >=0 y < span del primero tras reciclar)

  const recycleAndRender = () => {
    // Hacia adelante
    let s;
    while (offset >= (s = spanFirst())) {
      offset -= s;
      moveFirstToEnd();
    }
    // Hacia atrás (por si flechas suman negativo)
    while (offset < 0) {
      const back = spanLast();
      moveLastToStart();
      offset += back;
    }
    row.style.transform = `translateX(${-offset}px)`;
  };

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    offset += speed * dt;          // avance continuo
    recycleAndRender();

    requestAnimationFrame(tick);
  };

  // primer render
  recycleAndRender();
  requestAnimationFrame(tick);

  // API pública para flechas
  track._loopAPI = {
    nudge(dx) { offset += (dx * -1); recycleAndRender(); }, // dx>0 = mover a la derecha visual
    setSpeed(s) { speed = s; },
    remeasure() { recycleAndRender(); } // por si necesitas forzar un ajuste
  };

  // Ajuste ante resize
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => track._loopAPI.remeasure(), 120);
  });
}

// Configura una sección: crea tarjetas, espera imágenes y arma el loop
async function setupCarouselSection(sectionEl, items) {
  const carousel = sectionEl.querySelector(".carousel");
  const track    = carousel.querySelector(".track");
  const prevBtn  = carousel.querySelector(".nav-btn.prev");
  const nextBtn  = carousel.querySelector(".nav-btn.next");

  // Poblar tarjetas
  track.innerHTML = "";
  items.forEach(p => track.appendChild(card(p)));

  if (items.length === 0) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }
  if (items.length === 1) { // seguirá en loop, pero ocultamos flechas
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }

  await waitImages(track);
  initLoop(track, { speed: 24 });

  // Flechas empujan offset (no pausan el auto)
  const step = () => Math.max(track.clientWidth * 0.9, 280);
  prevBtn.addEventListener("click", () => track._loopAPI?.nudge(+step())); // ver a la izquierda
  nextBtn.addEventListener("click", () => track._loopAPI?.nudge(-step())); // ver a la derecha
}

// -------- Arranque --------
(async () => {
  try {
    const data = await loadData();
    const sections = document.querySelectorAll(".catalog-section");
    for (const sec of sections) {
      const key  = sec.getAttribute("data-category"); // women, men, black, red, lavit
      const list = Array.isArray(data[key]) ? data[key] : [];
      await setupCarouselSection(sec, list);
    }
  } catch (e) {
    console.error(e);
  }
})();

