// Página de detalle de producto (3 columnas + compartir flotante + confianza)
const PHONE = "56912345678";
const BASE_WA_MSG = "Hola, me interesa este producto 👇";

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

/** Especificaciones simples por categoría */
function buildSpecs(categoryKey, product) {
  const specs = [];
  const mapTipo = {
    women: "Perfume",
    men: "Perfume",
    black: "Perfume",
    red: "Perfume",
    lavit: "Body Splash",
    hogar: "Artículo para el hogar",
  };
  const mapGenero = { women: "Mujer", men: "Hombre" };

  if (mapGenero[categoryKey]) specs.push({ label: "Género", value: mapGenero[categoryKey] });
  specs.push({ label: "Tipo", value: mapTipo[categoryKey] || "Producto" });
  if (product?.description) {
    specs.push({ label: "Descripción breve", value: product.description });
  }

  return specs;
}

function specsToHTML(specs) {
  if (!specs || specs.length === 0) return "";
  const items = specs
    .map((s) => `<li><strong>${s.label}:</strong> <span>${s.value}</span></li>`)
    .join("");
  return `
    <div class="p-specs">
      <h2>Especificaciones principales</h2>
      <ul>${items}</ul>
    </div>
  `;
}

/** Solo “Despacho a todo Chile” — para columna derecha, bajo WhatsApp */
function shippingBadgeHTML() {
  return `
    <div class="p-trust p-trust--single">
      <div class="p-trust__item">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h13a3 3 0 0 1 3 3v6h-2v-3H5v3H3V8a1 1 0 0 1 1-1Zm2 6h12v-3a1 1 0 0 0-1-1H5v4Zm14 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>
        <span><strong>Despacho a todo Chile</strong></span>
      </div>
    </div>
  `;
}

function renderProduct(p, categoryKey) {
  const container = document.getElementById("product");
  if (!p) {
    container.innerHTML = `<div style="padding:24px">No encontramos este producto.</div>`;
    return;
  }

  const wa = `https://wa.me/${PHONE}?text=${encodeURIComponent(
    BASE_WA_MSG
  )}%0A${encodeURIComponent(p.name)}`;

  const specsHTML = specsToHTML(buildSpecs(categoryKey, p));

  container.innerHTML = `
    <!-- Botón de compartir flotante (solo ícono) -->
    <button id="shareBtn" type="button" class="btn btn-ghost share-float" aria-label="Compartir">
      <svg class="icon-share" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 8.5V6l6 6-6 6v-2.5h-8a4.5 4.5 0 0 1 0-9h8Z"/>
      </svg>
    </button>

    <!-- Columna izquierda: imagen -->
    <div class="p-gallery">
      <img src="${p.image}" alt="${p.name}" loading="eager">
    </div>

    <!-- Columna central: título y especificaciones (sin descripción bajo el nombre) -->
    <div class="p-info">
      <h1>${p.name}</h1>
      ${specsHTML}
    </div>

    <!-- Columna derecha: precio + CTA + envío -->
    <div class="p-buy">
      ${p.price ? `<div class="p-price">${money(p.price)}</div>` : ""}
      <div class="p-actions" style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
        <a class="btn btn-primary" href="${wa}" target="_blank" rel="noopener">
          <svg class="icon-wa" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">
            <path fill="currentColor" d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
          </svg>
          Consultar por WhatsApp
        </a>
      </div>
      ${shippingBadgeHTML()}
    </div>
  `;

  // — Compartir: Web Share API + fallback copiar al portapapeles
  const shareBtn = container.querySelector("#shareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const title = p.name || "Producto";
      const text  = "Mira este producto de Esencia y Alma";
      const url   = location.href;

      if (navigator.share) {
        try { await navigator.share({ title, text, url }); }
        catch (_) { /* cancelado */ }
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
}

// -------- Arranque --------
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
