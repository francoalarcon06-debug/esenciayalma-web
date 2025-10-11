// js/catalog.js  (reemplazar todo)
const WA_PHONE = "56912345678"; // cámbialo si quieres
const WA_MSG = encodeURIComponent("Hola, me interesa este producto 👇");

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

function updateArrows(track, prevBtn, nextBtn) {
  const max = track.scrollWidth - track.clientWidth - 1;
  prevBtn.disabled = track.scrollLeft <= 0;
  nextBtn.disabled = track.scrollLeft >= max;
}

function setupCarousel(carouselEl) {
  const track = carouselEl.querySelector(".track");
  const prevBtn = carouselEl.querySelector(".prev");
  const nextBtn = carouselEl.querySelector(".next");

  const step = () => Math.max(track.clientWidth * 0.9, 280);

  prevBtn.addEventListener("click", () =>
    track.scrollBy({ left: -step(), behavior: "smooth" })
  );
  nextBtn.addEventListener("click", () =>
    track.scrollBy({ left: step(), behavior: "smooth" })
  );

  const onScroll = () => updateArrows(track, prevBtn, nextBtn);
  track.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  if (track.children.length <= 1) {
    // Un solo producto: centrar y ocultar flechas
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    track.style.justifyContent = "center";
    track.style.gridAutoColumns = "minmax(260px, 420px)";
  } else {
    onScroll();
  }
}

function renderSection(sectionEl, items) {
  const track = sectionEl.querySelector(".track");
  track.innerHTML = "";
  items.forEach((p) => track.appendChild(card(p)));
  setupCarousel(sectionEl.querySelector(".carousel"));
}

(async () => {
  try {
    const data = await loadData();
    // Las keys deben coincidir con data-category de cada sección del index:
    // women, men, black, red, lavit
    document.querySelectorAll(".catalog-section").forEach((sec) => {
      const key = sec.getAttribute("data-category");
      const list = Array.isArray(data[key]) ? data[key] : [];
      renderSection(sec, list);
    });
  } catch (err) {
    console.error(err);
  }
})();
