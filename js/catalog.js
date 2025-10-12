// js/catalog.js  (REEMPLAZAR TODO EL ARCHIVO)

// === WhatsApp ===
const WA_PHONE = "56912345678"; // cámbialo si quieres
const WA_MSG = encodeURIComponent("Hola, me interesa este producto 👇");

// === Utilidades ===
const money = (v) => {
  // acepta "16000", "$16.000", "16.000", etc.
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

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

// Actualiza estado de flechas en carrusel NO-infinito
function updateArrows(track, prevBtn, nextBtn) {
  const max = track.scrollWidth - track.clientWidth - 1;
  prevBtn.disabled = track.scrollLeft <= 0;
  nextBtn.disabled = track.scrollLeft >= max;
}

// Configura un carrusel (con auto-scroll infinito si hay > 4 ítems)
function setupCarousel(carouselEl) {
  const track = carouselEl.querySelector(".track");
  const prevBtn = carouselEl.querySelector(".prev");
  const nextBtn = carouselEl.querySelector(".next");

  const items = Array.from(track.children);
  const total = items.length;

  // Helpers para medidas
  const getGap = () => {
    const s = getComputedStyle(track);
    return parseFloat(s.columnGap || s.gap || "0");
  };
  const getCardWidth = () => {
    const first = track.querySelector(".card");
    return first ? first.getBoundingClientRect().width : 0;
  };
  const stepPx = () => Math.max(getCardWidth() + getGap(), 280);

  // --- Caso 1: un solo producto (centrado y sin flechas) ---
  if (total <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    track.style.justifyContent = "center";
    track.style.gridAutoColumns = "minmax(260px, 420px)";
    return;
  }

  // --- Caso 2: auto-scroll infinito si hay más de 4 productos ---
  if (total > 4) {
    // Clonamos las primeras 4 tarjetas para transición suave de bucle
    const clones = items.slice(0, 4).map((n) => n.cloneNode(true));
    clones.forEach((c) => track.appendChild(c));

    let index = 0;         // índice dentro de los "originales"
    let timerId = null;
    const intervalMs = 3500; // velocidad de auto-scroll

    function step(dir = 1) {
      const delta = dir * stepPx();
      track.style.scrollBehavior = "smooth";
      track.scrollBy({ left: delta, behavior: "smooth" });
      index += dir;

      // Reseteo silencioso cuando pasamos el último original
      if (index >= total) {
        const after = 450; // esperar a que termine el scroll suave
        setTimeout(() => {
          track.style.scrollBehavior = "auto";
          track.scrollLeft = 0;
          index = 0;
        }, after);
      }

      if (index < 0) {
        // Si retrocedemos antes de 0, saltamos al final de los originales
        track.style.scrollBehavior = "auto";
        track.scrollLeft = total * (getCardWidth() + getGap());
        index = total - 1;
      }
    }

    function startAuto() {
      stopAuto();
      timerId = setInterval(() => step(1), intervalMs);
    }
    function stopAuto() {
      if (timerId) clearInterval(timerId), (timerId = null);
    }

    // Flechas (mantienen el bucle y reinician temporizador)
    prevBtn.addEventListener("click", () => { stopAuto(); step(-1); startAuto(); });
    nextBtn.addEventListener("click", () => { stopAuto(); step(1);  startAuto(); });

    // Pausa al pasar el mouse por la sección
    const section = carouselEl.closest("section");
    section?.addEventListener("mouseenter", stopAuto);
    section?.addEventListener("mouseleave", startAuto);

    // Recalcula posición tras un resize
    window.addEventListener("resize", () => {
      track.style.scrollBehavior = "auto";
      track.scrollLeft = index * (getCardWidth() + getGap());
    });

    // En carrusel infinito las flechas no se deshabilitan
    prevBtn.disabled = false;
    nextBtn.disabled = false;

    startAuto();
    return;
  }

  // --- Caso 3: 2 a 4 productos (sin bucle; flechas con límites) ---
  const boundedStep = () => Math.max(track.clientWidth * 0.9, 280);
  prevBtn.addEventListener("click", () =>
    track.scrollBy({ left: -boundedStep(), behavior: "smooth" })
  );
  nextBtn.addEventListener("click", () =>
    track.scrollBy({ left: boundedStep(), behavior: "smooth" })
  );
  const onScroll = () => updateArrows(track, prevBtn, nextBtn);
  track.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
}

function renderSection(sectionEl, items) {
  const track = sectionEl.querySelector(".track");
  track.innerHTML = "";
  items.forEach((p) => track.appendChild(card(p)));
  setupCarousel(sectionEl.querySelector(".carousel"));
}

// === Bootstrap ===
(async () => {
  try {
    const data = await loadData();
    // Las keys deben coincidir con data-category del index: women, men, black, red, lavit
    document.querySelectorAll(".catalog-section").forEach((sec) => {
      const key = sec.getAttribute("data-category");
      const list = Array.isArray(data[key]) ? data[key] : [];
      renderSection(sec, list);
    });
  } catch (err) {
    console.error(err);
  }
})();
