/* Carrusel continuo con transform + rAF (siempre en movimiento)
   - Bucle real SIN duplicar DOM (reciclaje de items)
   - Flechas con easing y salto = 3 tarjetas desde el borde
   - Sin pausas por hover/touch
*/

const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

// -------- Utils --------
const money = (v) => `$${(Number(String(v).replace(/[^\d]/g, "")) || 0).toLocaleString("es-CL")}`;

async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

/* ====== Inyección de CSS (una sola vez) ====== */
(() => {
  if (document.getElementById("card-equalize-css")) return;
  const s = document.createElement("style");
  s.id = "card-equalize-css";
  s.textContent = `
    .card{height:100%}
    .card__body{display:flex;flex-direction:column;height:100%}
    .card__content{flex:1 1 auto}
    .card__footer{margin-top:auto;display:flex;flex-direction:column;gap:12px}

    /* Forzar que cualquier imagen LLENE el marco fijo sin dejar bordes */
    .card__img{overflow:hidden}
    .card__img img{width:100%;height:100%;object-fit:cover;object-position:center center}

    /* Gestos: permitir scroll vertical del documento y drag horizontal del carrusel */
    .is-viewport, .carousel .track{ touch-action: pan-y; }
    .is-viewport{ cursor: grab; }
    .is-viewport.dragging{ cursor: grabbing; }

    /* Evitar selección de texto durante el drag horizontal */
    .is-viewport.dragging, .is-viewport.dragging *{
      user-select:none; -webkit-user-select:none; -webkit-touch-callout:none;
    }
  `;
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
      <img src="${product.image}" alt="${product.name}" loading="lazy" draggable="false">
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
            <!-- WhatsApp (Bootstrap Icons, MIT). Hereda color con currentColor -->
            <svg class="icon-wa" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.49-.084-.182-.133-.38-.232"/>
            </svg>
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
  const pend = [...container.querySelectorAll("img")].filter(i => !i.complete);
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

  const originals = [...track.children];
  if (originals.length === 0) return;

  // --- CONGELAR ancho real de cada tarjeta para evitar reflow y cambios de clamping ---
  originals.forEach(cardEl => {
    const w = Math.round(cardEl.getBoundingClientRect().width);
    cardEl.style.flex = `0 0 ${w}px`;
    cardEl.style.width = `${w}px`;
    cardEl.dataset._frozenW = String(w);
  });

  // Contenedor interno en fila
  const row = document.createElement("div");
  const GAP = parseFloat(getComputedStyle(track).gap || "16") || 16;

  Object.assign(row.style, {
    display: "flex",
    gap: `${GAP}px`,
    willChange: "transform",
    transform: "translate3d(0,0,0)",
    transition: "none"
  });

  // El track actúa como viewport
  Object.assign(track.style, { overflow: "hidden", position: "relative" });
  track.classList.add("is-viewport");

  originals.forEach(n => row.appendChild(n));
  track.appendChild(row);
  track._row = row; // guardamos referencia para poder desmontar

  const widthOf = (el) => {
    const fw = parseFloat(el.dataset._frozenW || "");
    return Number.isFinite(fw) && fw > 0 ? fw : el.getBoundingClientRect().width;
  };
  const childCount = () => row.children.length;
  const spanAt = (i) => {
    const c = row.children[i];
    return c ? widthOf(c) + (i < childCount() - 1 ? GAP : 0) : 0;
  };
  const spanFirst  = () => spanAt(0);
  const spanSecond = () => spanAt(1);
  const spanThird  = () => spanAt(2);
  const spanLast   = () => (childCount() ? widthOf(row.children[childCount()-1]) : 0);
  const spanPrevLast = () => (childCount() > 1 ? widthOf(row.children[childCount()-2]) + GAP : 0);

  const moveFirstToEnd  = () => row.appendChild(row.children[0]);
  const moveLastToStart = () => row.insertBefore(row.children[childCount()-1], row.firstChild);

  let lastTs = 0, offset = 0;
  let tweenActive = false, tweenStart = 0, tweenDur = 0, tweenTarget = 0, tweenPrev = 0;

  // ===== Auto-scroll e inercia =====
  const BASE_SPEED = speed;
  let autoSpeed = speed;      // velocidad actual del auto-scroll (se mezcla suavemente)
  let targetAuto = speed;     // objetivo al que queremos volver
  const AUTO_BLEND_SEC = 0.45;// tiempo aprox para volver a la velocidad base

  // Fling con inercia: velocidad adicional que decae con el tiempo (px/s)
  let momentumVel = 0;                 // px/s
  const MOMENTUM_DECAY = 0.90;         // fricción por frame (~60fps)
  const MOMENTUM_EPS = 2;              // umbral para detener

  const startTweenOffset = (delta, duration = 500) => {
    if (tweenActive) {
      tweenTarget = (tweenTarget - tweenPrev) + delta;
      tweenPrev = 0; tweenStart = performance.now(); tweenDur = duration;
      return;
    }
    tweenActive = true; tweenTarget = delta; tweenPrev = 0;
    tweenStart = performance.now(); tweenDur = duration;
  };

  const applyTweenStep = (now) => {
    if (!tweenActive) return;
    const t = Math.min(1, (now - tweenStart) / tweenDur);
    const cur = easeOutCubic(t) * tweenTarget;
    offset += (cur - tweenPrev);
    tweenPrev = cur;
    if (t >= 1) tweenActive = tweenPrev = tweenTarget = 0;
  };

  const recycleAndRender = () => {
    let s;
    while (offset >= (s = spanFirst())) { offset -= s; moveFirstToEnd(); }
    while (offset < 0) { const back = spanLast(); moveLastToStart(); offset += back; }
    row.style.transform = `translate3d(${-offset}px,0,0)`;
  };

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000; lastTs = ts;

    // aplicar mezcla suave para recuperar autoSpeed -> targetAuto
    const k = 1 - Math.pow(0.001, dt / AUTO_BLEND_SEC); // independencia del framerate
    autoSpeed += (targetAuto - autoSpeed) * k;

    // decaimiento de la inercia
    if (Math.abs(momentumVel) > MOMENTUM_EPS) {
      momentumVel *= Math.pow(MOMENTUM_DECAY, dt * 60);
      if (Math.abs(momentumVel) <= MOMENTUM_EPS) momentumVel = 0;
    }

    // avance total
    offset += (autoSpeed + momentumVel) * dt;

    applyTweenStep(ts);
    recycleAndRender();
    requestAnimationFrame(tick);
  };

  recycleAndRender();
  requestAnimationFrame(tick);

  // Saltos de 3 tarjetas
  const forwardThree  = () => Math.max(spanFirst() - offset, 0) + spanSecond() + spanThird();
  const backwardThree = () => offset + spanLast() + spanPrevLast();

  // API pública para flechas
  track._loopAPI = {
    nudgeForward : (px) => startTweenOffset(+px, 520),
    nudgeBackward: (px) => startTweenOffset(-px, 520),
    remeasure    : recycleAndRender,
    _stepForward : forwardThree,
    _stepBackward: backwardThree
  };

  // ====== GESTOS (drag/touch con bloqueo de dirección + fling) ======
  let deciding = false;   // estamos decidiendo si es horizontal o vertical
  let dragging = false;   // arrastre horizontal activo
  let startX = 0, startY = 0;
  let startOffset = 0;
  let lastX = 0, lastT = 0;
  let dragMoved = false;  // para cancelar clics fantasma
  let cancelNextClick = false;

  const DRAG_THRESHOLD = 8;  // px para decidir dirección
  const CLICK_CANCEL_THRESHOLD = 6; // px para anular click

  const onPointerDown = (e) => {
    deciding = true;
    dragging = false;
    dragMoved = false;
    track.classList.remove("dragging");

    startX = lastX = e.clientX;
    startY = e.clientY;
    lastT  = performance.now();
    startOffset = offset;

    // Pausar auto-scroll suavemente hacia 0
    targetAuto = 0;
    momentumVel = 0;       // cortar cualquier inercia activa
    tweenActive = false; tweenTarget = tweenPrev = 0;
  };

  const onPointerMove = (e) => {
    if (deciding) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dragging = true;
          deciding = false;
          track.classList.add("dragging");
          try { track.setPointerCapture(e.pointerId); } catch(_) {}
          e.preventDefault(); // bloquear selección/scroll nativo horizontal
        } else {
          deciding = false;
          dragging = false;
        }
      }
      return;
    }

    if (!dragging) return;

    e.preventDefault(); // necesario para que no seleccione texto ni haga scroll lateral
    const nowX = e.clientX;
    const dx = nowX - startX;
    if (Math.abs(dx) > CLICK_CANCEL_THRESHOLD) dragMoved = true;

    offset = startOffset - dx; // arrastre directo
    recycleAndRender();

    lastX = nowX;
    lastT = performance.now();
  };

  const onPointerUp = (e) => {
    // si se soltó antes de decidir, simplemente reanudar
    if (deciding && !dragging) {
      deciding = false;
      targetAuto = BASE_SPEED;
      return;
    }

    if (!dragging) return;
    dragging = false;
    track.classList.remove("dragging");
    try { track.releasePointerCapture(e.pointerId); } catch (_) {}

    // anular click si realmente hubo arrastre
    if (dragMoved) {
      cancelNextClick = true;
      setTimeout(() => (cancelNextClick = false), 120);
    }

    // velocidad horizontal en px/s basada en el último tramo
    const dtMs = Math.max(16, performance.now() - lastT);
    const vx = (e.clientX - lastX) / dtMs * 1000; // px/s
    momentumVel = -vx * 0.8; // inercia proporcional

    targetAuto = BASE_SPEED; // volver suave al auto-scroll
  };

  // Cancelar clicks fantasma tras un drag
  const onClickCapture = (ev) => {
    if (cancelNextClick) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  track.addEventListener("click", onClickCapture, true);
  track.addEventListener("pointerdown", onPointerDown, { passive: false });
  track.addEventListener("pointermove", onPointerMove, { passive: false });
  track.addEventListener("pointerup", onPointerUp, { passive: false });
  track.addEventListener("pointercancel", onPointerUp, { passive: false });

  // Ajuste ante resize (debounce simple)
  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(recycleAndRender, 120);
  });
}

// Desmontar el loop y dejar el DOM como estaba (para volver a modo estático)
function destroyLoop(track) {
  if (!track._loopInited) return;
  const row = track._row;

  // mover hijos al track y limpiar widths "congelados"
  if (row) {
    const cards = [...row.children];
    while (row.firstChild) track.insertBefore(row.firstChild, row);
    row.remove();
    cards.forEach(el => {
      el.style.flex = "";
      el.style.width = "";
      delete el.dataset._frozenW;
    });
  }

  track._loopInited = false;
  track._loopAPI = undefined;
  track._row = undefined;
  track.style.overflow = "";
  track.style.position = "";
  track.classList.remove("is-viewport","dragging");
}

/* ===== helpers de medición ===== */
function getGap(track) {
  return parseFloat(getComputedStyle(track).gap || "16") || 16;
}
function computeVisibleCards(track) {
  // La tarjeta tiene min-width: 260px en CSS
  const MIN_CARD = 260;
  const gap = getGap(track);
  const w = track.clientWidth || 0;
  // fórmula: cuántas caben completas
  const per = MIN_CARD + gap;
  const visible = Math.max(1, Math.floor((w + gap) / per));
  return visible;
}

/* ====== Configura una sección ====== */
async function setupCarouselSection(sectionEl, items) {
  const carousel = sectionEl.querySelector(".carousel");
  const track    = carousel.querySelector(".track");
  const prevBtn  = carousel.querySelector(".nav-btn.prev");
  const nextBtn  = carousel.querySelector(".nav-btn.next");

  track.innerHTML = "";
  track.classList.remove("static");
  items.forEach(p => track.appendChild(card(p)));

  if (items.length === 0) {
    destroyLoop(track);
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }

  await waitImages(track);

  // función que decide y aplica el modo según el ancho real
  const applyMode = () => {
    const visibleCards = computeVisibleCards(track);
    const shouldCarousel = items.length > visibleCards;

    if (shouldCarousel) {
      track.classList.remove("static");
      if (!track._loopInited) {
        initLoop(track, { speed: 24 });
      } else {
        track._loopAPI?.remeasure?.();
      }
      prevBtn.style.display = "";
      nextBtn.style.display = "";
      prevBtn.onclick = () => {
        const step = track._loopAPI?._stepBackward?.() || Math.max(track.clientWidth * 0.9, 280);
        track._loopAPI?.nudgeBackward(step);
      };
      nextBtn.onclick = () => {
        const step = track._loopAPI?._stepForward?.() || Math.max(track.clientWidth * 0.9, 280);
        track._loopAPI?.nudgeForward(step);
      };
    } else {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      prevBtn.onclick = nextBtn.onclick = null;
      destroyLoop(track);
      track.classList.add("static");
    }
  };

  // aplicar ahora
  applyMode();

  // actualizar automáticamente en rotación/cambio de tamaño
  if (!sectionEl._responsiveInited) {
    sectionEl._responsiveInited = true;
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        applyMode();
      }, 120);
    };
    addEventListener("resize", onResize, { passive: true });

    const ro = new ResizeObserver(() => applyMode());
    ro.observe(track);
    sectionEl._ro = ro;
  }
}

// -------- Arranque --------
(async () => {
  try {
    const data = await loadData();
    for (const sec of document.querySelectorAll(".catalog-section")) {
      const key  = sec.getAttribute("data-category"); // women, men, black, red, lavit, hogar
      const list = Array.isArray(data[key]) ? data[key] : [];
      await setupCarouselSection(sec, list);
    }
  } catch (e) {
    console.error(e);
  }
})();
