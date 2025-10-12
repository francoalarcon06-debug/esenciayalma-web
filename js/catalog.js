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
            <img class="icon-wa" src="assets/images/Logo whatsapp.png" alt="WhatsApp">
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

  originals.forEach(n => row.appendChild(n));
  track.appendChild(row);

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
    row.style.transform = `translateX(${-offset}px)`;
  };

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000; lastTs = ts;
    offset += speed * dt;
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

  // Ajuste ante resize (debounce simple)
  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(recycleAndRender, 120);
  });
}

// Configura una sección: crea tarjetas, espera imágenes y arma el loop
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

  // Modo carrusel solo si hay > 4 productos; si no, modo estático centrado
  if (items.length > 4) {
    initLoop(track, { speed: 24 });

    prevBtn.style.display = "";
    nextBtn.style.display = "";
    prevBtn.addEventListener("click", () => {
      const step = track._loopAPI?._stepBackward?.() || Math.max(track.clientWidth * 0.9, 280);
      track._loopAPI?.nudgeBackward(step);
    });
    nextBtn.addEventListener("click", () => {
      const step = track._loopAPI?._stepForward?.() || Math.max(track.clientWidth * 0.9, 280);
      track._loopAPI?.nudgeForward(step);
    });
  } else {
    track.classList.add("static");
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }
}

// -------- Arranque --------
(async () => {
  try {
    const data = await loadData();
    for (const sec of document.querySelectorAll(".catalog-section")) {
      const key  = sec.getAttribute("data-category"); // women, men, black, red, lavit
      const list = Array.isArray(data[key]) ? data[key] : [];
      await setupCarouselSection(sec, list);
    }
  } catch (e) {
    console.error(e);
  }
})();
