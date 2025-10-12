/* Carrusel continuo con transform + rAF (siempre en movimiento)
   - Bucle perfecto: [originales][clones] + módulo del ancho del bloque
   - Flechas empujan (manualOffset) sin pausar el auto
   - SIN pausas por hover/touch (siempre se mueve)
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
      i.addEventListener("load", done, { once:true });
      i.addEventListener("error", done, { once:true });
    });
  });
}

// ========= Motor de cinta (transform) =========
function initLoop(track, { speed = 24 } = {}) {
  if (track._loopInited) return;
  track._loopInited = true;

  // Guardamos los nodos originales (cards)
  const originals = [...track.children];
  if (originals.length === 0) return;

  // Creamos una fila interna (row) y pasamos los hijos
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = getComputedStyle(track).gap || "16px";
  row.style.willChange = "transform";
  row.style.transform = "translateX(0px)";
  // pequeña transición para que el empuje de flechas se sienta agradable
  row.style.transition = "transform .14s ease-out";

  // El track actúa como viewport
  track.style.overflow = "hidden";
  track.style.position = "relative";

  originals.forEach(n => row.appendChild(n));
  // Clonamos el mismo bloque para bucle perfecto
  originals.forEach(n => row.appendChild(n.cloneNode(true)));

  track.appendChild(row);

  // Medir ancho del primer bloque (originals)
  const gap = parseFloat(row.style.gap) || 16;
  const measureBlockWidth = () => {
    let w = 0;
    for (let i = 0; i < originals.length; i++) {
      const r = row.children[i].getBoundingClientRect();
      w += r.width;
    }
    w += gap * Math.max(originals.length - 1, 0);
    track._blockW = Math.max(w, 1);
  };
  measureBlockWidth();

  // Estado de animación
  let last = 0;
  let autoOffset = 0;    // avance automático acumulado
  let manualOffset = 0;  // empuje manual (flechas)
  let rafId = 0;

  const mod = (x, m) => ((x % m) + m) % m; // módulo positivo
  const render = () => {
    const x = -mod(autoOffset + manualOffset, track._blockW);
    row.style.transform = `translateX(${x}px)`;
  };

  const tick = (ts) => {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;

    // SIEMPRE AVANZA (no hay pausa por hover/touch)
    autoOffset += speed * dt;
    render();

    rafId = requestAnimationFrame(tick);
  };

  render();
  rafId = requestAnimationFrame(tick);

  // API pública para flechas y control externo
  track._loopAPI = {
    nudge(dx) {
      manualOffset += dx;
      render(); // no pausamos el auto; sigue corriendo
    },
    setSpeed(s) { speed = s; },
    remesure() { measureBlockWidth(); render(); }
  };

  // Recalcular al cambiar el tamaño
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => track._loopAPI.remesure(), 120);
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

  // Siempre auto (aunque haya pocos); si hay 0, no hacemos nada
  if (items.length === 0) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }

  // Si hay 1, ocultar flechas pero el loop igual corre (con el clon)
  if (items.length === 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }

  // Espera a que imágenes tengan tamaño y arranca
  await waitImages(track);
  initLoop(track, { speed: 24 });

  // Flechas: empujan la cinta (sin pausar la animación)
  const step = () => Math.max(track.clientWidth * 0.9, 280);
  prevBtn.addEventListener("click", () => track._loopAPI?.nudge(+step()));
  nextBtn.addEventListener("click", () => track._loopAPI?.nudge(-step()));
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
