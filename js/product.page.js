// Página de detalle con layout 2 columnas (Imagen | Detalle)

const PHONE = "56961114225";
const BASE_WA_GREET = "Hola, me interesa este producto";

const money = (v) =>
  `$${(Number(String(v).replace(/[^\d]/g, "")) || 0).toLocaleString("es-CL")}`;

function getParams() {
  const p = new URLSearchParams(location.search);
  return { c: (p.get("c") || "").toLowerCase(), i: Number(p.get("i") || "0") };
}

async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

/* ====== Caja de Descripción ====== */
function descriptionBoxHTML(p) {
  const raw =
    (typeof p.longDescription === "string" && p.longDescription.trim()) ||
    (typeof p.description === "string" && p.description.trim()) ||
    "";

  if (!raw) return "";

  // Permite párrafos separados por líneas en blanco
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);

  const body =
    paragraphs.length > 1
      ? paragraphs.map((t) => `<p>${t}</p>`).join("")
      : `<p>${raw}</p>`;

  return `
    <div class="p-descbox">
      <h2>Descripción</h2>
      <div class="p-descbody">${body}</div>
    </div>
  `;
}

/* ====== Badge Despacho (usando imagen externa truck.png) ====== */
function shippingBadgeHTML() {
  return `
    <div class="p-trust p-trust--single">
      <div class="p-trust__item">
        <img src="assets/images/truck.png" alt="Camión de despacho" class="truck-icon">
        <span><strong>Despacho a todo Chile</strong></span>
      </div>
    </div>
  `;
}

/* ====== Link volver (sin filtros) ====== */
function catalogUrlForCategory() {
  return "catalogo.html";
}

/* ====== Helpers Variants ====== */
function hasVariants(p) {
  return Array.isArray(p?.variants) && p.variants.length > 0;
}
function getDefaultVariant(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const idx100 = variants.findIndex((v) => Number(v.ml) === 100);
  return idx100 >= 0 ? variants[idx100] : variants[0];
}
function waHrefFor(p, variant, productUrlAbs) {
  const extra =
    variant && variant.ml != null && variant.price != null
      ? ` (${variant.ml} ml – ${money(variant.price)})`
      : "";
  const waText = `${BASE_WA_GREET}\n"${p.name}"${extra}\n${productUrlAbs}`;
  return `https://wa.me/${PHONE}?text=${encodeURIComponent(waText)}`;
}

/* ====== Render ====== */
function renderProduct(p, categoryKey) {
  const container = document.getElementById("product");
  if (!p) {
    container.innerHTML = `<div style="padding:24px">No encontramos este producto.</div>`;
    return;
  }

  const productUrl = location.href; // absoluto
  const defaultVariant = hasVariants(p) ? getDefaultVariant(p.variants) : null;
  const displayPrice = defaultVariant ? defaultVariant.price : p.price;
  const wa = waHrefFor(p, defaultVariant, productUrl);
  const backHref = catalogUrlForCategory();

  container.innerHTML = `
    <!-- Volver dentro del recuadro -->
    <a href="${backHref}" class="btn btn-ghost crumb-btn inside">Volver al catálogo</a>

    <!-- Compartir -->
    <button id="shareBtn" type="button" class="btn btn-ghost share-float" aria-label="Compartir">
      <img class="share-icon" src="assets/images/share-arrow.png" alt="">
    </button>

    <!-- Columna izquierda -->
    <div class="p-gallery">
      <img src="${p.image}" alt="${p.name}" loading="eager">
    </div>

    <!-- Columna derecha -->
    <div class="p-right">
      <h1 class="p-title">${p.name}</h1>

      <!-- Chips de variantes (se inyectan si existen) -->
      ${hasVariants(p) ? `<div class="variant-chips" id="variantChips"></div>` : ""}

      <!-- Primero: precio + CTA -->
      ${displayPrice ? `<div class="p-price" id="priceValue">${money(displayPrice)}</div>` : ""}

      <div class="p-actions">
        <a class="btn btn-primary" id="waProductBtn" href="${wa}" target="_blank" rel="noopener">
          <svg class="icon-wa" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">
            <path fill="currentColor" d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
          </svg>
          Consultar por WhatsApp
        </a>
      </div>

      <!-- Luego: Despacho bajo el botón -->
      ${shippingBadgeHTML()}

      <!-- Descripción -->
      ${descriptionBoxHTML(p)}
    </div>
  `;

  // Compartir
  const shareBtn = container.querySelector("#shareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const title = p.name || "Producto";
      const text = "Mira este producto de Esencia y Alma";
      const url = location.href;

      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
        } catch (_) {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          shareBtn.classList.add("copied");
          setTimeout(() => shareBtn.classList.remove("copied"), 1200);
        } catch (_) {
          alert("Copia este link para compartir:\n" + url);
        }
      }
    });
  }

  /* ====== Variants (chips) ====== */
  if (hasVariants(p)) {
    const bar = container.querySelector("#variantChips");
    const priceEl = container.querySelector("#priceValue");
    const waBtn = container.querySelector("#waProductBtn");

    // Estado seleccionado
    let current = getDefaultVariant(p.variants);

    // Render chips
    p.variants.forEach((v) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "variant-chip";
      btn.textContent = `${v.ml} ml`;
      btn.setAttribute(
        "aria-pressed",
        Number(v.ml) === Number(current.ml) ? "true" : "false"
      );

      btn.addEventListener("click", () => {
        current = v;
        // Cambiar activo visualmente
        bar.querySelectorAll(".variant-chip").forEach((b) => {
          b.setAttribute("aria-pressed", "false");
        });
        btn.setAttribute("aria-pressed", "true");

        // Actualizar precio
        if (priceEl) priceEl.textContent = money(v.price);

        // Actualizar WhatsApp del producto (mensaje con tamaño + precio)
        if (waBtn) waBtn.href = waHrefFor(p, v, productUrl);
      });

      bar.appendChild(btn);
    });

    // Valor inicial coherente (por si el HTML tomó el top-level)
    if (priceEl && current?.price != null) {
      priceEl.textContent = money(current.price);
    }
    if (waBtn) waBtn.href = waHrefFor(p, current, productUrl);
  }
}

/* ====== Cargar ====== */
(async () => {
  try {
    const { c, i } = getParams();
    const data = await loadData();
    const list = Array.isArray(data[c]) ? data[c] : [];
    const product = list[i] || null;
    renderProduct(product, c);
  } catch (e) {
    console.error(e);
    renderProduct(null, "");
  }
})();
