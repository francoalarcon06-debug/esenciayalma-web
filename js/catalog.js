/* Carrusel continuo con transform + rAF (siempre en movimiento)
   - Bucle real SIN duplicar DOM (reciclaje de items)
   - Flechas con easing y salto = 3 tarjetas desde el borde
   - Sin pausas por hover/touch
   - HOME 100% dinámico con orden/visibilidad desde data/home.config.json (opcional)
*/

const WA_PHONE = "56961114225";
const WA_GREET = "Hola, me interesa este producto";

// -------- Utils --------
const money = (v) => `$${(Number(String(v).replace(/[^\d]/g, "")) || 0).toLocaleString("es-CL")}`;

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const niceTitleFromSlug = (s) =>
  String(s || "")
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No pude cargar ${url}`);
  return res.json();
}

async function loadProductsAny() {
  // Soporta:
  // 1) Array de productos: [{id, name, price, image, category}, ...]
  // 2) Objeto por categorías: { women:[...], men:[...], ... }
  const data = await loadJSON("data/products.json");
  if (Array.isArray(data)) {
    // agrupamos por category (slug)
    const byCat = new Map();
    data.forEach((p) => {
      const k = slug(p.category || "");
      if (!k) return;
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k).push(p);
    });
    return byCat;
  } else {
    // asumimos objeto { cat: array }
    const byCat = new Map();
    Object.keys(data || {}).forEach((k) => {
      const ks = slug(k);
      const arr = Array.isArray(data[k]) ? data[k] : [];
      if (ks) byCat.set(ks, arr);
    });
    return byCat;
  }
}

async function loadHomeConfig() {
  try {
    // opcional
    const cfg = await loadJSON("data/home.config.json");
    // normalizamos campos esperados
    return {
      order: Array.isArray(cfg.order) ? cfg.order.map(slug) : [],
      visibility: cfg.visibility || {},
      titles: cfg.titles || {},
      subtitles: cfg.subtitles || {}
    };
  } catch (_) {
    // si no existe, defaults
    return { order: [], visibility: {}, titles: {}, subtitles: {} };
  }
}

/* ====== Inyección de CSS (una sola vez) para alinear precio/botón ====== */
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
  `;
  document.head.appendChild(s);
})();

/* ====== Tarjeta con footer fijo ====== */
function card(product) {
  const el = document.createElement("article");
  el.className = "card";
  el.setAttribute("role", "listitem");

  // URL pública del detalle para incluirla en el mensaje
  const detailUrl = `${location.origin}/producto.html?c=${encodeURIComponent(product._c || product.categoryKey || "")}&i=${encodeURIComponent(typeof product._i === "number" ? product._i : (typeof product.idx === "number" ? product.idx : 0))}`;

  // Mensaje WA en el orden solicitado (saludo -> nombre -> link)
  const waText = `${WA_GREET}\n"${product.name}"\n${detailUrl}`;
  const href = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(waText)}`;

  el.innerHTML = `
    <div class="card__img">
       <img
          src="${encodeURI(product.image || '')}"
          alt="${product.name}"
          loading="lazy"
          decoding="async"
          width="1080"
          height="1050"
          onerror="this.onerror=null;this.src='assets/images/placeholder-340x330.webp'">
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
            <svg class="icon-wa" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
            </svg>
            Consultar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;

  // --- Hacer clickeable toda la tarjeta (excepto el botón de WhatsApp) ---
  el.style.cursor = "pointer";
  el.addEventListener("click", (ev) => {
    if (ev.target.closest(".card__btn")) return; // no interceptar el botón
    const c = product._c || product.categoryKey || "";
    const i = typeof product._i === "number" ? product._i : (typeof product.idx === "number" ? product.idx : 0);
    location.href = `producto.html?c=${encodeURIComponent(c)}&i=${encodeURIComponent(i)}`;
  });

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

  // Contenedor interno en fila
  const row = document.createElement("div");
  const GAP = parseFloat(getComputedStyle(track).gap || "16") || 16;

  Object.assign(row.style, {
    display: "flex",
    gap: `${GAP}px`,
    willChange: "transform",
    transform: "translateX(0px)",
    transition: "none"
  });

  // El track actúa como viewport
  Object.assign(track.style, { overflow: "hidden", position: "relative" });
  track.classList.add("is-viewport");

  originals.forEach(n => row.appendChild(n));
  track.appendChild(row);
  track._row = row; // guardamos referencia para poder desmontar

  const widthOf = (el) => el.getBoundingClientRect().width;
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

  // Auto-scroll SIEMPRE activo
  const BASE_SPEED = speed;
  let autoSpeed = speed;

  // Desplazamiento extra por dedo (solo cuando hay drag horizontal)
  let dragDelta = 0;

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
    let effective = offset + dragDelta;
    let s;

    while (effective >= (s = spanFirst())) { effective -= s; moveFirstToEnd(); }
    while (effective < 0) { const back = spanLast(); moveLastToStart(); effective += back; }

    offset = effective - dragDelta;
    row.style.transform = `translateX(${-effective}px)`;
  };

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000; lastTs = ts;

    // avanzar offset por auto-scroll
    offset += autoSpeed * dt;

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

  // ====== GESTOS (bloqueo de dirección + solo dentro de .card + sin pausar auto-scroll) ======
  let deciding = false;
  let dragging = false;
  let startX = 0, startY = 0;
  let lastX = 0, lastT = 0;
  let dragMoved = false;
  let cancelNextClick = false;

  const DRAG_THRESHOLD = 10;
  const CLICK_CANCEL_THRESHOLD = 6;

  const isFromCard = (target) => !!(target && target.closest(".card"));

  const onPointerDown = (e) => {
    if (!isFromCard(e.target)) { deciding = dragging = false; return; }
    deciding = true;
    dragging = false;
    dragMoved = false;

    startX = lastX = e.clientX;
    startY = e.clientY;
    lastT  = performance.now();
  };

  const onPointerMove = (e) => {
    if (!deciding && !dragging) return;

    if (deciding) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dragging = true;
          deciding = false;
          track.classList.add("dragging");
          try { track.setPointerCapture(e.pointerId); } catch(_) {}
          e.preventDefault();
        } else {
          deciding = false;
          dragging = false;
        }
      }
      return;
    }

    if (!dragging) return;

    e.preventDefault();
    const nowX = e.clientX;
    const dxMove = nowX - lastX;
    if (Math.abs(nowX - startX) > CLICK_CANCEL_THRESHOLD) dragMoved = true;

    dragDelta -= dxMove;
    recycleAndRender();

    lastX = nowX;
    lastT = performance.now();
  };

  const onPointerUp = (e) => {
    if (deciding && !dragging) { deciding = false; return; }
    if (!dragging) return;

    dragging = false;
    deciding = false;
    track.classList.remove("dragging");
    try { track.releasePointerCapture(e.pointerId); } catch (_) {}

    if (dragMoved) {
      cancelNextClick = true;
      setTimeout(() => (cancelNextClick = false), 120);
    }

    const dtMs = Math.max(16, performance.now() - lastT);
    const vx = (e.clientX - lastX) / dtMs; // px/ms
    const inertia = -vx * 260 * 0.9;

    if (Math.abs(inertia) > 12) {
      let start = performance.now();
      const from = dragDelta;
      const to = dragDelta + inertia;
      const dur = 420;
      const step = (ts) => {
        const t = Math.min(1, (ts - start) / dur);
        const cur = from + easeOutCubic(t) * (to - from);
        dragDelta = cur;
        recycleAndRender();
        if (t < 1) requestAnimationFrame(step);
        else {
          offset += dragDelta;
          dragDelta = 0;
          recycleAndRender();
        }
      };
      requestAnimationFrame(step);
    } else {
      offset += dragDelta;
      dragDelta = 0;
      recycleAndRender();
    }
  };

  const onClickCapture = (ev) => {
    if (cancelNextClick) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  track.addEventListener("click", onClickCapture, true);
  track.addEventListener("pointerdown", onPointerDown, { passive: true });
  track.addEventListener("pointermove", onPointerMove, { passive: false });
  track.addEventListener("pointerup", onPointerUp, { passive: false });
  track.addEventListener("pointercancel", onPointerUp, { passive: false });

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
  if (row) {
    while (row.firstChild) track.insertBefore(row.firstChild, row);
    row.remove();
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
  const MIN_CARD = 260;
  const gap = getGap(track);
  const w = track.clientWidth || 0;
  const per = MIN_CARD + gap;
  const visible = Math.max(1, Math.floor((w + gap) / per));
  return visible;
}

/* ===== DOM helpers para secciones ===== */
function q(sel, ctx = document) { return ctx.querySelector(sel); }
function qa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

function findSectionByCategory(cat) {
  return q(`.catalog-section[data-category="${cat}"]`);
}

function createSection(cat, title, subtitle) {
  const sec = document.createElement("section");
  sec.id = cat;
  sec.className = "catalog-section";
  sec.setAttribute("data-category", cat);
  sec.innerHTML = `
    <div class="container">
      <h2 class="sec-title">${title}</h2>
      <p class="sec-sub">${subtitle || ""}</p>
      <div class="carousel">
        <button class="nav-btn prev" aria-label="Anterior">❮</button>
        <div class="track no-scrollbar" role="list"></div>
        <button class="nav-btn next" aria-label="Siguiente">❯</button>
      </div>
      <div class="sec-bottom"><a href="catalogo.html?category=${encodeURIComponent(cat)}" class="sec-link--bottom">Ver todo</a></div>
    </div>
  `;
  return sec;
}

function ensureSection(cat, title, subtitle, insertBeforeEl) {
  let sec = findSectionByCategory(cat);
  if (!sec) {
    sec = createSection(cat, title, subtitle);
    if (insertBeforeEl) {
      insertBeforeEl.parentNode.insertBefore(sec, insertBeforeEl);
    } else {
      const footer = q("footer");
      if (footer) footer.parentNode.insertBefore(sec, footer);
      else document.body.appendChild(sec);
    }
  } else {
    const t = q(".sec-title", sec);
    const s = q(".sec-sub", sec);
    if (t) t.textContent = title;
    if (s) s.textContent = subtitle || "";
    const link = q(".sec-bottom .sec-link--bottom", sec);
    if (link) link.href = `catalogo.html?category=${encodeURIComponent(cat)}`;
  }
  return sec;
}

function moveBefore(el, before) {
  if (el && before && el !== before) {
    before.parentNode.insertBefore(el, before);
  }
}

/* ====== Configura una sección (render de productos + carrusel) ====== */
async function setupCarouselSection(sectionEl, items) {
  const carousel = sectionEl.querySelector(".carousel");
  const track    = carousel.querySelector(".track");
  const prevBtn  = carousel.querySelector(".nav-btn.prev");
  const nextBtn  = carousel.querySelector(".nav-btn.next");
  const key      = sectionEl.getAttribute("data-category") || "";

  track.innerHTML = "";
  track.classList.remove("static");

  const withMeta = (Array.isArray(items) ? items : []).map((p, i) => ({ ...p, _c: key, _i: i }));
  withMeta.forEach(p => track.appendChild(card(p)));

  if (withMeta.length === 0) {
    destroyLoop(track);
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }

  const applyMode = () => {
    const visibleCards = computeVisibleCards(track);
    const shouldCarousel = withMeta.length > visibleCards;

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

  applyMode();

  waitImages(track).then(() => {
    track._loopAPI?.remeasure?.();
    applyMode();
  }).catch(() => {});

  if (!sectionEl._responsiveInited) {
    sectionEl._responsiveInited = true;
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => applyMode(), 120);
    };
    addEventListener("resize", onResize, { passive: true });
    const ro = new ResizeObserver(() => applyMode());
    ro.observe(track);
    sectionEl._ro = ro;
  }
}

/* ====== Orden y visibilidad (HOME) ====== */
function computeHomeOrder(allCats, cfg) {
  const orderCfg = Array.isArray(cfg.order) ? cfg.order.map(slug) : [];
  const setCfg = new Set(orderCfg);
  const rest = allCats.filter(c => !setCfg.has(c)).sort((a, b) => a.localeCompare(b));
  return [...orderCfg, ...rest];
}
function isVisible(cat, cfg) {
  const v = cfg.visibility || {};
  return v[cat] !== false; // por defecto visible
}

/* ===== Arranque (HOME dinámico) ===== */
(async () => {
  try {
    const [byCat, cfg] = await Promise.all([loadProductsAny(), loadHomeConfig()]);

    const allCats = Array.from(byCat.keys());
    if (!allCats.length) return;

    const finalOrder = computeHomeOrder(allCats, cfg);
    const footer = q("footer");
    const insertBeforeEl = footer || null;

    // Crear / actualizar / reordenar secciones visibles
    finalOrder.forEach((cat) => {
      if (!isVisible(cat, cfg)) return;
      const title = (cfg.titles && cfg.titles[cat]) || niceTitleFromSlug(cat);
      const subtitle = (cfg.subtitles && cfg.subtitles[cat]) || "";
      const sec = ensureSection(cat, title, subtitle, insertBeforeEl);
      if (insertBeforeEl) moveBefore(sec, insertBeforeEl);
    });

    // Render de productos según visibilidad
    finalOrder.forEach((cat) => {
      if (!isVisible(cat, cfg)) return;
      const items = byCat.get(cat) || [];
      const sec = findSectionByCategory(cat);
      if (sec) setupCarouselSection(sec, items);
    });

    // Ocultar secciones sin productos o desactivadas
    qa(".catalog-section").forEach((sec) => {
      const cat = sec.getAttribute("data-category");
      const active = isVisible(cat, cfg);
      const items = byCat.get(cat) || [];
      sec.style.display = (active && items.length) ? "" : "none";

      // Actualizar el link "Ver todo"
      const link = sec.querySelector(".sec-link--bottom");
      if (link) {
        const k = (cat || "").trim();
        link.href = k ? `catalogo.html?category=${encodeURIComponent(k)}` : `catalogo.html`;
      }
    });

  } catch (e) {
    console.error(e);
  }
})();
