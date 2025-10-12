/* Carrusel continuo SIN duplicar tarjetas (reciclaje de nodos)
   - Siempre en movimiento (rAF + transform)
   - Bucle perfecto: cuando el 1º sale por la izquierda se mueve al final (y viceversa)
   - Flechas empujan sin pausar el auto ni provocar “rebotes”
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
        <a class="btn btn-primary card__btn" target="_blank" href="${href}">Consultar por WhatsApp</a>
      </div>
    </div>
  `;
  return el;
}

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

// ========= Motor de cinta (reciclaje, sin clones) =========
function initLoop(track, { speed = 24 } = {}) {
  if (track._loopInited) return;
  track._loopInited = true;

  // 1) Crear una fila interna (row) y mover las cards ahí
  const originals = [...track.children];
  if (originals.length === 0) return;

  track.style.overflow = "hidden";
  track.style.position = "relative";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "stretch";
  row.style.gap = getComputedStyle(track).gap || "16px";
  row.style.willChange = "transform";
  row.style.transform = "translateX(0px)";
  row.style.transition = "none"; // toda la suavidad la da rAF

  originals.forEach(n => row.appendChild(n));
  track.innerHTML = "";
  track.appendChild(row);

  const GAP = parseFloat(row.style.gap) || 16;
  const itemOuterWidth = (el) => el.getBoundingClientRect().width + GAP;

  // Estado
  let lastTs = 0;
  let offset = 0; // avance acumulado hacia la izquierda (px)
  let rafId  = 0;

  const render = () => { row.style.transform = `translateX(${-offset}px)`; };

  // Mueve 1º→final cuando salió por completo (bucle hacia la izq)
  const recycleForward = () => {
    let guard = 0;
    while (row.children.length && guard++ < 100) {
      const first = row.children[0];
      const need  = itemOuterWidth(first);
      if (offset >= need) {
        offset -= need;        // compensar lo que “se fue”
        row.appendChild(first); // enviar al final
      } else break;
    }
  };

  // Mueve último→inicio cuando empujamos hacia la dcha (offset < 0)
  const recycleBackward = () => {
    let guard = 0;
    while (offset < 0 && row.children.length && guard++ < 100) {
      const last = row.children[row.children.length - 1];
      const need = itemOuterWidth(last);
      row.insertBefore(last, row.children[0]); // traer delante
      offset += need;                          // compensar
    }
  };

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    offset += speed * dt;   // SIEMPRE avanza
    recycleForward();
    render();
    rafId = requestAnimationFrame(tick);
  };

  render();
  rafId = requestAnimationFrame(tick);

  // API para flechas (empujan sin pausar ni provocar “rebote”)
  track._loopAPI = {
    nudge(dx) {
      // dx positivo = ver todo desplazarse a la derecha → offset disminuye
      offset -= dx;
      recycleBackward();
      recycleForward();
      render();
    },
    setSpeed(s) { speed = s; },
    remeasure() { recycleBackward(); recycleForward(); render(); }
  };

  // Reajuste en resize
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => track._loopAPI.remeasure(), 120);
  });
}

// ========= Setup por sección =========
async function setupCarouselSection(sectionEl, items) {
  const carousel = sectionEl.querySelector(".carousel");
  const track    = carousel.querySelector(".track");
  const prevBtn  = carousel.querySelector(".nav-btn.prev");
  const nextBtn  = carousel.querySelector(".nav-btn.next");

  track.innerHTML = "";
  items.forEach(p => track.appendChild(card(p)));

  if (items.length === 0) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }
  if (items.length === 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }

  await waitImages(track);
  initLoop(track, { speed: 24 });

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
