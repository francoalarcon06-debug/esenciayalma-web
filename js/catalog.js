/* Carrusel continuo con transform + rAF (siempre en movimiento)
   - Bucle real SIN duplicar DOM: reciclamos items (primero→final / último→inicio)
   - Flechas: desplazamiento SUAVE con easing y salto = 3 tarjetas desde el borde
   - Pausa automática al pasar el mouse sobre una tarjeta
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

/* ====== Inyección de CSS (una sola vez) ====== */
(function injectEqualizeCSS(){
  if (document.getElementById("card-equalize-css")) return;
  const css = `
    .card{height:100%}
    .card__body{display:flex;flex-direction:column;height:100%}
    .card__content{flex:1 1 auto}
    .card__footer{margin-top:auto;display:flex;flex-direction:column;gap:12px}
  `;
  const s = document.createElement("style");
  s.id = "card-equalize-css";
  s.textContent = css;
  document.head.appendChild(s);
})();

/* ====== Tarjeta ====== */
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
      <div class="card__content">
        <h3 class="card__title">${product.name}</h3>
        ${product.description ? `<p class="card__sub">${product.description}</p>` : ""}
      </div>
      <div class="card__footer">
        ${product.price ? `<div class="card__price">${money(product.price)}</div>` : ""}
        <div class="card__actions">
          <a class="btn btn-primary card__btn" target="_blank" href="${href}">
            Consultar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;
  return el;
}

// Espera a que las imágenes tengan tamaño
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

// Easing
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// ========= Motor de cinta (transform + reciclaje) =========
function initLoop(track, { speed = 24 } = {}) {
  if (track._loopInited) return;
  track._loopInited = true;

  const originals = [...track.children];
  if (originals.length === 0) return;

  const row = document.createElement("div");
  const gapCss = getComputedStyle(track).gap || "16px";
  const GAP = parseFloat(gapCss) || 16;

  row.style.display    = "flex";
  row.style.gap        = `${GAP}px`;
  row.style.willChange = "transform";
  row.style.transform  = "translateX(0px)";
  row.style.transition = "none";

  track.style.overflow = "hidden";
  track.style.position = "relative";

  originals.forEach(n => row.appendChild(n));
  track.appendChild(row);

  const widthOf = (el) => el.getBoundingClientRect().width;
  const spanAt = (i) => {
    const c = row.children[i];
    if (!c) return 0;
    return widthOf(c) + (i < row.children.length - 1 ? GAP : 0);
  };

  const moveFirstToEnd = () => {
    const first = row.children[0];
    if (first) row.appendChild(first);
  };
  const moveLastToStart = () => {
    const last = row.children[row.children.length - 1];
    if (last) row.insertBefore(last, row.firstChild);
  };

  let lastTs = 0;
  let offset = 0;
  let paused = false; // 👈 agregado para controlar la pausa

  let tweenActive = false;
  let tweenStart = 0;
  let tweenDur = 0;
  let tweenTarget = 0;
  let tweenPrev = 0;

  const startTweenOffset = (delta, duration = 500) => {
    if (tweenActive) {
      const remaining = tweenTarget - tweenPrev;
      tweenTarget = remaining + delta;
      tweenPrev = 0;
      tweenStart = performance.now();
      tweenDur = duration;
      return;
    }
    tweenActive = true;
    tweenTarget = delta;
    tweenPrev   = 0;
    tweenStart  = performance.now();
    tweenDur    = duration;
  };

  const applyTweenStep = (now) => {
    if (!tweenActive) return;
    const t = Math.min(1, (now - tweenStart) / tweenDur);
    const cur = easeOutCubic(t) * tweenTarget;
    const inc = cur - tweenPrev;
    tweenPrev = cur;
    offset += inc;
    if (t >= 1) tweenActive = false;
  };

  const recycleAndRender = () => {
    while (offset >= spanAt(0)) {
      offset -= spanAt(0);
      moveFirstToEnd();
    }
    while (offset < 0) {
      const back = spanAt(row.children.length - 1);
      moveLastToStart();
      offset += back;
    }
    row.style.transform = `translateX(${-offset}px)`;
  };

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    if (!paused) { // 👈 solo avanza si no está en pausa
      offset += speed * dt;
      applyTweenStep(ts);
      recycleAndRender();
    }

    requestAnimationFrame(tick);
  };

  recycleAndRender();
  requestAnimationFrame(tick);

  // 👇 eventos para pausar/reanudar al pasar sobre cualquier tarjeta
  row.addEventListener("mouseenter", () => paused = true);
  row.addEventListener("mouseleave", () => paused = false);

  // API pública
  track._loopAPI = {
    nudgeForward(deltaPx) { startTweenOffset(+deltaPx, 520); },
    nudgeBackward(deltaPx) { startTweenOffset(-deltaPx, 520); },
  };
}

// -------- Secciones --------
async function setupCarouselSection(sectionEl, items) {
  const carousel = sectionEl.querySelector(".carousel");
  const track    = carousel.querySelector(".track");
  const prevBtn  = carousel.querySelector(".nav-btn.prev");
  const nextBtn  = carousel.querySelector(".nav-btn.next");

  track.innerHTML = "";
  track.classList.remove("static");
  items.forEach(p => track.appendChild(card(p)));

  if (items.length === 0) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }

  await waitImages(track);

  if (items.length > 4) {
    initLoop(track, { speed: 24 });
  } else {
    track.classList.add("static");
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }
}

// -------- Inicio --------
(async () => {
  try {
    const data = await loadData();
    const sections = document.querySelectorAll(".catalog-section");
    for (const sec of sections) {
      const key  = sec.getAttribute("data-category");
      const list = Array.isArray(data[key]) ? data[key] : [];
      await setupCarouselSection(sec, list);
    }
  } catch (e) {
    console.error(e);
  }
})();
