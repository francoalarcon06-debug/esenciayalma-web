// =======================
// Catálogo – Esencia y Alma
// =======================

const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

// Mapeo legible para nombres de categorías
const CATEGORY_LABELS = {
  women: "Perfumes de Mujer",
  men: "Perfumes de Hombre",
  black: "Línea Black Parfums",
  red: "Línea Red Parfums",
  lavit: "Línea LAVIT Body Splash",
  hogar: "Artículos para el hogar",
};

// -------- Utils --------
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};
const parsePesos = (s) => Number(String(s).replace(/[^\d]/g, "")) || 0;

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

const PERFUMERIA_KEYS = ["women","men","black","red","lavit"];

// Notar: leemos SIEMPRE desde location.search para preservar `scope` al reemplazar la URL
function currentParams() {
  return new URLSearchParams(location.search);
}
function setParams(obj) {
  const cur = currentParams();
  const p = new URLSearchParams();

  // preservar 'scope' si existe
  const scope = cur.get("scope");
  if (scope) p.set("scope", scope);

  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") p.set(k, v);
  }
  const query = p.toString();
  const newUrl = query ? `${location.pathname}?${query}` : `${location.pathname}${scope ? `?scope=${scope}` : ""}`;
  history.replaceState(null, "", newUrl);
}

async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

// ------- Render tarjeta (reutiliza estilos del sitio) -------
function renderCard(p) {
  const href = `https://wa.me/${WA_PHONE}?text=${WA_MSG}%0A${encodeURIComponent(p.name)}`;

  const el = document.createElement("article");
  el.className = "card";
  el.innerHTML = `
    <div class="card__img">
      <img loading="lazy" src="${p.image}" alt="${p.name}">
    </div>
    <div class="card__body">
      <div class="card__content">
        <h3 class="card__title">${p.name}</h3>
        ${p.description ? `<p class="card__sub">${p.description}</p>` : ""}
      </div>
      <div class="card__footer">
        ${p.price ? `<div class="card__price">${money(p.price)}</div>` : ""}
        <div class="card__actions">
          <a class="btn btn-primary card__btn" target="_blank" href="${href}">
            <svg class="icon-wa" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
            </svg>
            Consultar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;
  return el;
}

// ------- Estado y render -------
let ALL = [];       // [{...product, categoryKey}]
let CATS = [];      // [{key,label,count}]
let SCOPE = "";     // "", "perfumeria", "hogar"

function buildFromJSON(json) {
  ALL = [];
  CATS = [];

  // === limitar dataset según scope ===
  let allowed = null;
  if (SCOPE === "perfumeria") {
    allowed = new Set(PERFUMERIA_KEYS);
  } else if (SCOPE === "hogar") {
    allowed = new Set(["hogar"]);
  }

  for (const [key, arr] of Object.entries(json)) {
    if (allowed && !allowed.has(key)) continue; // excluir fuera de scope

    const list = Array.isArray(arr) ? arr : [];
    const count = list.length;
    if (count === 0) continue; // no mostrar categorías vacías

    CATS.push({
      key,
      label: CATEGORY_LABELS[key] || key,
      count,
    });

    list.forEach(p => ALL.push({ ...p, categoryKey: key }));
  }
}

function populateCategorySelect(select) {
  select.innerHTML = ""; // limpio
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todas las categorías";
  select.appendChild(optAll);

  CATS.forEach(c => {
    const o = document.createElement("option");
    o.value = c.key;
    o.textContent = c.label;
    select.appendChild(o);
  });
}

function applyFilters({ category, min, max, sort }) {
  let list = ALL.slice();

  if (category) list = list.filter(p => p.categoryKey === category);

  const minN = parsePesos(min);
  const maxN = parsePesos(max);
  if (minN) list = list.filter(p => parsePesos(p.price) >= minN);
  if (maxN) list = list.filter(p => parsePesos(p.price) <= maxN);

  switch (sort) {
    case "priceAsc":
      list.sort((a,b) => parsePesos(a.price) - parsePesos(b.price));
      break;
    case "priceDesc":
      list.sort((a,b) => parsePesos(b.price) - parsePesos(a.price));
      break;
    case "nameAsc":
      list.sort((a,b) => a.name.localeCompare(b.name, "es"));
      break;
    // relevance: deja el orden natural
  }

  return list;
}

function renderGrid(items) {
  const grid = qs("#grid");
  grid.innerHTML = "";

  if (items.length === 0) {
    const tpl = qs("#emptyTpl").content.cloneNode(true);
    grid.appendChild(tpl);
    const btn = grid.querySelector("#emptyClear");
    if (btn) btn.addEventListener("click", clearFilters);
    return;
  }

  items.forEach(p => grid.appendChild(renderCard(p)));
  qs("#count").textContent = `${items.length} resultado${items.length===1?"":"s"}`;
}

// Limpia controles pero conserva el `scope`
function clearFilters() {
  qs("#fCategory").value = "";
  qs("#fMin").value = "";
  qs("#fMax").value = "";
  qs("#fSort").value = "relevance";
  setParams({}); // mantiene 'scope' gracias a setParams
  const items = applyFilters({});
  renderGrid(items);
}

// === Badge dentro del panel de filtros con botón para quitar el scope (ARRIBA DEL SELECT) ===
function injectScopeBadge() {
  if (SCOPE !== "perfumeria" && SCOPE !== "hogar") return;

  const form = document.getElementById("filtersForm");
  if (!form) return;

  const label = SCOPE === "hogar" ? "Hogar" : "Perfumería";
  const badge = document.createElement("div");
  badge.setAttribute("id", "scopeBadge");
  badge.innerHTML = `
    <span style="font-weight:700;">${label}</span>
    <button type="button" aria-label="Quitar vista ${label}" title="Quitar vista ${label}">×</button>
  `;
  Object.assign(badge.style, {
    // Chip del ancho del contenido (texto + X)
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    alignSelf: "flex-start",
    width: "auto",
    maxWidth: "100%",
    marginBottom: "8px",
    padding: "6px 10px",
    borderRadius: "12px",
    fontSize: "13px",
    color: "#c43c73",
    background: "#ffe3ef",
  });
  const btn = badge.querySelector("button");
  Object.assign(btn.style, {
    appearance: "none",
    border: "none",
    background: "transparent",
    fontSize: "18px",
    lineHeight: "1",
    cursor: "pointer",
    color: "#c43c73",
    padding: "2px 4px",
  });

  // Insertar el badge como PRIMER elemento del formulario de filtros (arriba de "Tipo de producto")
  form.insertBefore(badge, form.firstElementChild);

  // Al hacer click en la X, quitamos el scope de la URL y recargamos mostrando todas las categorías
  btn.addEventListener("click", () => {
    const params = currentParams();
    params.delete("scope");
    const query = params.toString();
    const url = query ? `${location.pathname}?${query}` : location.pathname;
    location.href = url;
  });
}

// ------- Arranque -------
(async () => {
  try {
    const params = currentParams();
    SCOPE = (params.get("scope") || "").toLowerCase();

    const data = await loadData();
    buildFromJSON(data);

    // Llenar select categoría dinámicamente (solo categorías existentes y no vacías)
    const $cat = qs("#fCategory");
    populateCategorySelect($cat);

    // Cargar estado inicial desde URL (si viene ?category=women, etc.)
    const initState = {
      category: params.get("category") || "",
      min: params.get("min") || "",
      max: params.get("max") || "",
      sort: params.get("sort") || "relevance",
    };

    // Ajustes según scope
    if (SCOPE === "perfumeria" && initState.category === "hogar") {
      initState.category = "";
    }
    if (SCOPE === "hogar" && initState.category && initState.category !== "hogar") {
      initState.category = "";
    }

    // Prellenar controles
    $cat.value = initState.category || "";
    qs("#fMin").value = initState.min || "";
    qs("#fMax").value = initState.max || "";
    qs("#fSort").value = initState.sort;

    // Render inicial
    renderGrid(applyFilters(initState));

    // Badge informativo de scope dentro del panel de filtros (con X) — arriba del select
    injectScopeBadge();

    // Eventos
    qs("#filtersForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const state = {
        category: $cat.value,
        min: qs("#fMin").value,
        max: qs("#fMax").value,
        sort: qs("#fSort").value,
      };
      setParams(state); // conserva 'scope'
      renderGrid(applyFilters(state));
    });

    qs("#clearBtn").addEventListener("click", clearFilters);

    qs("#fSort").addEventListener("change", () => {
      const state = {
        category: $cat.value,
        min: qs("#fMin").value,
        max: qs("#fMax").value,
        sort: qs("#fSort").value,
      };
      setParams(state); // conserva 'scope'
      renderGrid(applyFilters(state));
    });

  } catch (err) {
    console.error(err);
    qs("#grid").innerHTML = `<p style="padding:24px">No fue posible cargar el catálogo.</p>`;
  }
})();
