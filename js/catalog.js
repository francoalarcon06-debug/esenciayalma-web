// js/catalog.js  — versión con rotación continua infinita

// — Configuración de WhatsApp —
const WA_PHONE = "56912345678";
const WA_MSG = encodeURIComponent("Hola, me interesa este producto 👇");

// — Función para formatear precios —
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

// — Ocultar scrollbars globalmente —
(() => {
  const css = `
    .no-scrollbar { scrollbar-width: none; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
  `;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
})();

// — Cargar datos —
async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

// — Crear una tarjeta de producto —
function card(product) {
  const a = document.createElement("article");
  a.className = "card";
  a.setAttribute("role", "listitem");

  const href = `https://wa.me/${WA_PHONE}?text=${WA_MSG}%0A${encodeURIComponent(product.name)}`;

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

// — Configurar carrusel —
function setupCarousel(carouselEl, { itemsCount }) {
  const track   = carouselEl.querySelector(".track");
  const prevBtn = carouselEl.querySelector(".prev");
  const nextBtn = carouselEl.querySelector(".next");

  // Paso (usado por las flechas)
  const step = () => Math.max(track.clientWidth * 0.9, 280);

  // Si hay un solo producto: centramos
  if (itemsCount <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    track.style.justifyContent = "center";
    track.style.gridAutoColumns = "minmax(260px, 420px)";
    return;
  }

  // — Activar auto-scroll solo si hay más de 4 productos —
  const LOOP = itemsCount > 4;
  const speed = 0.25; // velocidad del desplazamiento (px por frame aprox)
  let rafId = null;
  let paused = false;

  // Duplicamos el contenido del carrusel para permitir un bucle sin saltos
  if (LOOP && !track.dataset.loopCloned) {
    const clones = Array.from(track.children).map((c) => c.cloneNode(true));
    track.append(...clones);
    track.dataset.loopCloned = "1";
    track.classList.add("no-scrollbar");
  }

  // — Movimiento continuo —
  const loopScroll = () => {
    if (!paused && LOOP) {
      track.scrollLeft += speed;
      const max = track.scrollWidth / 2;
      if (track.scrollLeft >= max) {
        track.scrollLeft = 0; // reinicio perfecto, sin salto
      }
    }
    rafId = requestAnimationFrame(loopScroll);
  };
  loopScroll();

  // — Controles manuales —
  prevBtn.addEventListener("click", () => {
    paused = true;
    track.scrollBy({ left: -step(), behavior: "smooth" });
    setTimeout(() => (paused = false), 1200);
  });

  nextBtn.addEventListener("click", () => {
    paused = true;
    track.scrollBy({ left: step(), behavior: "smooth" });
    setTimeout(() => (paused = false), 1200);
  });

  // — Pausar mientras el usuario interactúa —
  track.addEventListener("mouseenter", () => (paused = true));
  track.addEventListener("mouseleave", () => (paused = false));
  track.addEventListener("touchstart", () => (paused = true), { passive: true });
  track.addEventListener("touchend", () => (paused = false));
}

// — Renderizar cada sección —
function renderSection(sectionEl, items) {
  const track = sectionEl.querySelector(".track");
  track.innerHTML = "";
  items.forEach((p) => track.appendChild(card(p)));
  setupCarousel(sectionEl.querySelector(".carousel"), { itemsCount: items.length });
}

// — Iniciar todo —
(async () => {
  try {
    const data = await loadData();
    document.querySelectorAll(".catalog-section").forEach((sec) => {
      const key = sec.getAttribute("data-category");
      const list = Array.isArray(data[key]) ? data[key] : [];
      renderSection(sec, list);
    });
  } catch (err) {
    console.error(err);
  }
})();

