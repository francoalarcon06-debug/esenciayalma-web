// js/catalog.js  (REEMPLAZAR TODO)

// ——— Ajustes WhatsApp ———
const WA_PHONE = "56912345678"; // cámbialo si quieres
const WA_MSG = encodeURIComponent("Hola, me interesa este producto 👇");

// ——— Utilidades ———
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

// Inyecta estilos para ocultar scrollbar (Firefox + WebKit)
(() => {
  const css = `
    .no-scrollbar{ scrollbar-width: none; }
    .no-scrollbar::-webkit-scrollbar{ display: none; }
  `;
  const style = document.createElement("style");
  style.id = "catalog-no-scrollbar-style";
  style.textContent = css;
  if (!document.getElementById(style.id)) document.head.appendChild(style);
})();

async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

function card(product) {
  const a = document.createElement("article");
  a.className = "card";
  a.setAttribute("role", "listitem");

  const href = `https://wa.me/${WA_PHONE}?text=${WA_MSG}%0A${encodeURIComponent(
    product.name
  )}`;

  a.innerHTML = `
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
  return a;
}

// ——— Carrusel ———

function setupCarousel(carouselEl, { itemsCount }) {
  const track   = carouselEl.querySelector(".track");
  const prevBtn = carouselEl.querySelector(".prev");
  const nextBtn = carouselEl.querySelector(".next");

  // Paso “gran” para las flechas (≈ una vista)
  const step = () => Math.max(track.clientWidth * 0.9, 280);

  // Si solo hay 1 ítem, centramos y ocultamos flechas
  if (itemsCount <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    track.style.justifyContent = "center";
    track.style.gridAutoColumns = "minmax(260px, 420px)";
    return;
  }

  // — Auto-scroll continuo —
  // Para un bucle suave duplicamos los ítems y desplazamos de manera constante.
  const LOOP_ENABLED = itemsCount > 4; // activa auto-scroll si hay más de 4

  let rafId = null;
  let lastTs = 0;
  let paused = false;

  const speedPxPerSec = 18; // velocidad (px/seg). Baja este número para más lento.

  // Duplicamos contenido solo una vez si hay loop
  if (LOOP_ENABLED && !track.dataset.loopCloned) {
    const original = Array.from(track.children);
    const clones = original.map((n) => n.cloneNode(true));
    track.append(...clones);
    track.dataset.loopCloned = "1";
    track.classList.add("no-scrollbar"); // ocultar barra
  }

  // Función para envolver el scroll (sin “saltos” visibles)
  const wrapIfNeeded = () => {
    if (!LOOP_ENABLED) return;
    const half = track.scrollWidth / 2; // porque duplicamos
    if (track.scrollLeft >= half) {
      track.scrollLeft -= half;
    } else if (track.scrollLeft < 0) {
      track.scrollLeft += half;
    }
  };

  const animate = (ts) => {
    if (paused) { // si está pausado, seguimos pidiendo frames pero sin mover
      lastTs = ts;
      rafId = requestAnimationFrame(animate);
      return;
    }
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000; // segundos desde el frame anterior
    lastTs = ts;

    // Avanza suavemente
    track.scrollLeft += speedPxPerSec * dt;
    wrapIfNeeded();

    rafId = requestAnimationFrame(animate);
  };

  const start = () => {
    if (rafId == null && LOOP_ENABLED) {
      rafId = requestAnimationFrame(animate);
    }
  };
  const stop = () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  };

  // Pausas controladas
  const pause = (ms) => {
    paused = true;
    if (ms) setTimeout(() => (paused = false), ms);
  };

  // Controles con flechas (mantienen el loop; pausan y reanudan)
  prevBtn.addEventListener("click", () => {
    pause(1200);
    track.scrollBy({ left: -step(), behavior: "smooth" });
    // pequeño wrap por si cruzamos límites
    setTimeout(wrapIfNeeded, 700);
  });

  nextBtn.addEventListener("click", () => {
    pause(1200);
    track.scrollBy({ left: step(), behavior: "smooth" });
    setTimeout(wrapIfNeeded, 700);
  });

  // Pausar mientras el usuario interactúa (hover, focus, touch)
  track.addEventListener("mouseenter", () => (paused = true));
  track.addEventListener("mouseleave", () => (paused = false));
  track.addEventListener("touchstart", () => (paused = true), { passive: true });
  track.addEventListener("touchend",   () => (paused = false));

  // Si NO hay loop (≤4 items), mostramos/ocultamos flechas según posición.
  if (!LOOP_ENABLED) {
    const updateArrows = () => {
      const max = track.scrollWidth - track.clientWidth - 1;
      prevBtn.disabled = track.scrollLeft <= 0;
      nextBtn.disabled = track.scrollLeft >= max;
    };
    track.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    updateArrows();
  } else {
    // Con loop no hay principio/fin: flechas siempre habilitadas
    prevBtn.disabled = false;
    nextBtn.disabled = false;
    // Arrancamos el auto-scroll
    start();
    // Reajusta si cambia el tamaño y puede “romper” el medio
    window.addEventListener("resize", wrapIfNeeded);
  }
}

// Render de cada sección
function renderSection(sectionEl, items) {
  const track = sectionEl.querySelector(".track");
  track.innerHTML = "";
  items.forEach((p) => track.appendChild(card(p)));
  setupCarousel(sectionEl.querySelector(".carousel"), { itemsCount: items.length });
}

// ——— Inicio ———
(async () => {
  try {
    const data = await loadData();
    document.querySelectorAll(".catalog-section").forEach((sec) => {
      const key = sec.getAttribute("data-category"); // women, men, black, red, lavit
      const list = Array.isArray(data[key]) ? data[key] : [];
      renderSection(sec, list);
    });
  } catch (err) {
    console.error(err);
  }
})();
