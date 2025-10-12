/* Carrusel continuo con transform + rAF (siempre en movimiento)
   - Bucle real SIN duplicar DOM: reciclamos items (primero→final / último→inicio)
   - Flechas: desplazamiento SUAVE con easing y salto = 3 tarjetas desde el borde
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

/* ====== Inyección de CSS (una sola vez) para alinear precio/botón ====== */
(function injectEqualizeCSS(){
  if (document.getElementById("card-equalize-css")) return;
  const css = `
    /* La card ya es flex-columna en tu CSS, pero aseguramos el alto completo */
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

/* ====== Tarjeta con footer fijo ====== */
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

// Easing para el nudge suave
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

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
  row.style.transition = "none";

  // El track actúa como viewport
  track.style.overflow = "hidden";
  track.style.position = "relative";

  originals.forEach(n => row.appendChild(n));
  track.appendChild(row);

  // Helpers de medida
  const childCount = () => row.children.length;

  const widthOf = (el) => el.getBoundingClientRect().width;

  // ancho del i-ésimo hijo + gap a su vecino derecho (si lo hay)
  const spanAt = (i) => {
    const c = row.children[i];
    if (!c) return 0;
    return widthOf(c) + (i < childCount() - 1 ? GAP : 0);
  };

  const spanFirst  = () => spanAt(0);
  const spanSecond = () => spanAt(1);
  const spanThird  = () => spanAt(2);

  const spanLast = () => {
    const i = childCount() - 1;
    if (i < 0) return 0;
    // último no tiene gap a la derecha
    return widthOf(row.children[i]);
  };
  const spanBeforeLast = () => {
    const i = childCount() - 2;
    if (i < 0) return 0;
    // antes del último SÍ tiene gap a la derecha
    return widthOf(row.children[i]) + GAP;
  };

  // Reciclaje
  const moveFirstToEnd = () => {
    const first = row.children[0];
    if (first) row.appendChild(first);
  };
  const moveLastToStart = () => {
    const last = row.children[childCount() - 1];
    if (last) row.insertBefore(last, row.firstChild);
  };

  // Estado
  let lastTs = 0;
  let offset = 0; // avance acumulado en px

  // Tween del nudge (suave)
  let tweenActive = false;
  let tweenStart = 0;
  let tweenDur = 0;
  let tweenTarget = 0;   // delta de offset a aplicar en total
  let tweenPrev = 0;     // delta aplicado hasta el frame anterior

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

    if (t >= 1) {
      tweenActive = false;
      tweenPrev = 0;
      tweenTarget = 0;
    }
  };

  // Recicla según offset y pinta
  const recycleAndRender = () => {
    let s;
    while (offset >= (s = spanFirst())) {
      offset -= s;
      moveFirstToEnd();
    }
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

    // auto avance continuo
    offset += speed * dt;

    // aplicar tween suave de flechas
    applyTweenStep(ts);

    recycleAndRender();
    requestAnimationFrame(tick);
  };

  recycleAndRender();
  requestAnimationFrame(tick);

  // ---- Cálculo del “salto de 3 perfumes” desde el borde ----
  const forwardThree = () => {
    const remFirst = Math.max(spanFirst() - offset, 0);
    const s2 = spanSecond();
    const s3 = spanThird();
    return remFirst + s2 + s3;
  };

  const backwardThree = () => {
    const sLast  = spanLast();
    const sPrev  = spanBeforeLast();
    return offset + sLast + sPrev;
  };

  // API pública para flechas
  track._loopAPI = {
    nudge(deltaDisplayPx) {
      // deltaDisplayPx > 0 = desplazarse visualmente a la izquierda (PREV)
      startTweenOffset(-deltaDisplayPx, 520);
    },
    nudgeForward(deltaPx)  { startTweenOffset(+deltaPx, 520); }, // NEXT
    nudgeBackward(deltaPx) { startTweenOffset(-deltaPx, 520); }, // PREV
    setSpeed(s) { speed = s; },
    remeasure() { recycleAndRender(); },

    // Exponemos helpers para 3-cards
    _stepForward: forwardThree,
    _stepBackward: backwardThree
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

  // Flechas: salto suave = 3 perfumes desde el borde
  prevBtn.addEventListener("click", () => {
    const step = track._loopAPI?._stepBackward?.() || Math.max(track.clientWidth * 0.9, 280);
    track._loopAPI?.nudgeBackward(step);
  });
  nextBtn.addEventListener("click", () => {
    const step = track._loopAPI?._stepForward?.() || Math.max(track.clientWidth * 0.9, 280);
    track._loopAPI?.nudgeForward(step);
  });
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
