// =======================
// Catálogo – Esencia y Alma
// =======================

const WA_PHONE = "56961114225";
const WA_GREET = "Hola, me interesa este producto";

// CAMBIO: relación de aspecto “oficial” del marco de imagen (1080 × 1050)
const MEDIA_W = 1080;
const MEDIA_H = 1050;

// Tamaño de página para la paginación
const PAGE_SIZE = 20;

// Mapeo legible para nombres de categorías
// Ahora se carga dinámicamente desde data/home.config.json (json.titles)
let CATEGORY_LABELS = {};

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

// Cargar títulos de categorías desde home.config.json
async function loadHomeConfig() {
  try {
    const res = await fetch("data/home.config.json", { cache: "no-store" });
    if (!res.ok) throw new Error("No pude cargar data/home.config.json");
    const json = await res.json();
    CATEGORY_LABELS = json.titles || {};
  } catch (err) {
    console.error("Error cargando home.config.json, usando labels por defecto", err);
    CATEGORY_LABELS = {
      women: "Perfumes de Mujer",
      men: "Perfumes de Hombre",
      colonias: "Colonias",
      black: "Black Parfums",
      red: "Red Parfums",
      lavit: "LAVIT Body Splash",
      hogar: "Artículos para el hogar",
      juvenil: "Juvenil",
      "packs-promocionales": "Packs Promocionales",
      essien: "Essien",
    };
  }
}

// ------- Render tarjeta -------
function renderCard(p) {
  const detailUrl = `${location.origin}/producto.html?c=${encodeURIComponent(p.categoryKey || "")}&i=${encodeURIComponent(typeof p.idx === "number" ? p.idx : 0)}`;
  const waText = `${WA_GREET}\n"${p.name}"\n${detailUrl}`;
  const href = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(waText)}`;

  const el = document.createElement("article");
  el.className = "card";
  el.innerHTML = `
    <div class="card__img" style="--media-w:${MEDIA_W};--media-h:${MEDIA_H};">
      <img
        class="card__media"
        src="${p.image}"
        alt="${p.name?.replace(/"/g, "&quot;") || "Producto"}"
        width="${MEDIA_W}"
        height="${MEDIA_H}"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      >
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
            <svg class="icon-wa" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" d="..."/></svg>
            Consultar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;

  el.style.cursor = "pointer";
  el.addEventListener("click", (ev) => {
    if (ev.target.closest(".card__btn")) return;
    const c = p.categoryKey || "";
    const i = typeof p.idx === "number" ? p.idx : 0;
    location.href = `producto.html?c=${encodeURIComponent(c)}&i=${encodeURIComponent(i)}`;
  });

  return el;
}

// ------- Estado global -------
let ALL = [];
let CATS = [];
let SCOPE = "";

let CURRENT_STATE = null;
let CURRENT_PAGE = 1;
let FILTERED = [];

// ------- Construcción inicial -------
function buildFromJSON(json) {
  ALL = [];
  CATS = [];

  let allowed = null;
  if (SCOPE === "perfumeria") {
    allowed = new Set(PERFUMERIA_KEYS);
  } else if (SCOPE === "hogar") {
    allowed = new Set(["hogar"]);
  }

  for (const [key, arr] of Object.entries(json)) {
    if (allowed && !allowed.has(key)) continue;

    const list = Array.isArray(arr) ? arr : [];
    if (list.length === 0) continue;

    CATS.push({
      key,
      label: CATEGORY_LABELS[key] || key,
      count: list.length,
    });

    list.forEach((p, i) => ALL.push({ ...p, categoryKey: key, idx: i }));
  }
}

function populateCategorySelect(select) {
  select.innerHTML = "";
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

// =========================================
// FILTROS — BÚSQUEDA SOLO POR NOMBRE
// =========================================
function applyFilters({ category, min, max, sort, search }) {
  let list = ALL.slice();

  if (category) list = list.filter(p => p.categoryKey === category);

  const minN = parsePesos(min);
  const maxN = parsePesos(max);
  if (minN) list = list.filter(p => parsePesos(p.price) >= minN);
  if (maxN) list = list.filter(p => parsePesos(p.price) <= maxN);

  const term = (search || "").trim().toLowerCase();
  if (term) {
    list = list.filter(p => {
      const name = (p.name || "").toLowerCase();
      return name.includes(term);   // <---- SOLO NOMBRE
    });
  }

  switch (sort) {
    case "priceAsc": list.sort((a,b) => parsePesos(a.price) - parsePesos(b.price)); break;
    case "priceDesc": list.sort((a,b) => parsePesos(b.price) - parsePesos(a.price)); break;
    case "nameAsc": list.sort((a,b) => a.name.localeCompare(b.name, "es")); break;
  }

  return list;
}

// =========================================
// Render — Conteo, grilla, paginación
// =========================================
function updateCount(total, page, pageSize) {
  const el = qs("#count");
  if (!el) return;

  if (!total) {
    el.textContent = "0 resultados";
    return;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  el.textContent = `${start} - ${end} de ${total} resultados`;
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
}

function renderPager(total, page, totalPages) {
  const pager = qs("#pager");
  if (!pager) return;

  if (total <= PAGE_SIZE || totalPages <= 1) {
    pager.innerHTML = "";
    return;
  }

  const parts = [];

  const prevDisabled = page <= 1 ? "disabled" : "";
  parts.push(`<button class="pager-btn pager-prev" data-page="${page - 1}" ${prevDisabled}>‹</button>`);

  const pages = [];
  const add = (n) => { if (n > 0 && n <= totalPages && !pages.includes(n)) pages.push(n); };

  add(1); add(page - 1); add(page); add(page + 1); add(totalPages);
  pages.sort((a,b) => a - b);

  let last = 0;
  for (const p of pages) {
    if (last && p - last > 1) parts.push(`<span class="pager-ellipsis">…</span>`);

    if (p === page)
      parts.push(`<button class="pager-page pager-page--current" data-page="${p}" aria-current="page">${p}</button>`);
    else
      parts.push(`<button class="pager-page" data-page="${p}">${p}</button>`);

    last = p;
  }

  const nextDisabled = page >= totalPages ? "disabled" : "";
  parts.push(`<button class="pager-btn pager-next" data-page="${page + 1}" ${nextDisabled}>›</button>`);

  pager.innerHTML = `<div class="pager-inner">${parts.join("")}</div>`;
}

function updateView(state, pageOverride) {
  FILTERED = applyFilters(state);
  const total = FILTERED.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  let page = pageOverride || state.page || 1;
  if (page > totalPages) page = totalPages;

  CURRENT_STATE = { ...state, page };
  CURRENT_PAGE = page;

  updateCount(total, page, PAGE_SIZE);

  if (!total) {
    renderGrid([]);
    renderPager(0, 1, 1);
    return;
  }

  const start = (page - 1) * PAGE_SIZE;
  renderGrid(FILTERED.slice(start, start + PAGE_SIZE));
  renderPager(total, page, totalPages);
}

// =========================================
// Acción: limpiar filtros
// =========================================
function clearFilters() {
  qs("#fCategory").value = "";
  qs("#fMin").value = "";
  qs("#fMax").value = "";
  qs("#fSort").value = "relevance";

  const s = qs("#searchInput");
  if (s) s.value = "";

  setParams({});
  updateView({ category:"", min:"", max:"", sort:"relevance", search:"", page:1 }, 1);
}

// =========================================
// Badge de "scope"
// =========================================
function injectScopeBadge() {
  if (SCOPE !== "perfumeria" && SCOPE !== "hogar") return;

  const form = document.getElementById("filtersForm");
  if (!form) return;

  const label = SCOPE === "hogar" ? "Hogar" : "Perfumería";
  const badge = document.createElement("div");
  badge.id = "scopeBadge";
  badge.innerHTML = `
    <span style="font-weight:700;">${label}</span>
    <button type="button">×</button>
  `;
  Object.assign(badge.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    marginBottom: "8px",
    borderRadius: "12px",
    background: "#ffe3ef",
    color: "#c43c73",
    fontSize: "13px",
  });

  const btn = badge.querySelector("button");
  Object.assign(btn.style, {
    appearance:"none",
    border:"none",
    background:"transparent",
    fontSize:"18px",
    cursor:"pointer",
    color:"#c43c73"
  });

  form.insertBefore(badge, form.firstElementChild);

  btn.addEventListener("click", () => {
    const p = currentParams();
    p.delete("scope");
    p.delete("page");
    p.delete("q");
    location.href = p.toString() ? `${location.pathname}?${p}` : location.pathname;
  });
}

// =========================================
// Paginar
// =========================================
function goToPage(page) {
  if (!CURRENT_STATE) return;
  const nextPage = Math.max(1, page | 0);
  const state = { ...CURRENT_STATE, page: nextPage };

  setParams({
    category: state.category,
    min: state.min,
    max: state.max,
    sort: state.sort,
    q: state.search,
    page: nextPage
  });

  updateView(state, nextPage);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =========================================
// ARRANQUE
// =========================================
(async () => {
  try {
    const params = currentParams();
    SCOPE = (params.get("scope") || "").toLowerCase();

    await loadHomeConfig();
    const data = await loadData();
    buildFromJSON(data);

    const $cat = qs("#fCategory");
    populateCategorySelect($cat);

    const $search = qs("#searchInput");

    const initState = {
      category: params.get("category") || "",
      min: params.get("min") || "",
      max: params.get("max") || "",
      sort: params.get("sort") || "relevance",
      search: params.get("q") || "",
      page: parseInt(params.get("page") || "1", 10) || 1,
    };

    if (SCOPE === "perfumeria" && initState.category === "hogar") initState.category = "";
    if (SCOPE === "hogar" && initState.category !== "hogar") initState.category = "";

    $cat.value = initState.category;
    qs("#fMin").value = initState.min;
    qs("#fMax").value = initState.max;
    qs("#fSort").value = initState.sort;
    if ($search) $search.value = initState.search;

    updateView(initState, initState.page);

    injectScopeBadge();

    // FORM submit
    qs("#filtersForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const state = {
        category: $cat.value,
        min: qs("#fMin").value,
        max: qs("#fMax").value,
        sort: qs("#fSort").value,
        search: $search ? $search.value : "",
        page: 1,
      };
      setParams({
        category: state.category, min: state.min, max: state.max,
        sort: state.sort, q: state.search, page: 1,
      });
      updateView(state, 1);
    });

    qs("#clearBtn").addEventListener("click", clearFilters);

    qs("#fSort").addEventListener("change", () => {
      const state = {
        category: $cat.value,
        min: qs("#fMin").value,
        max: qs("#fMax").value,
        sort: qs("#fSort").value,
        search: $search ? $search.value : "",
        page: 1,
      };
      setParams({
        category: state.category, min: state.min, max: state.max,
        sort: state.sort, q: state.search, page: 1,
      });
      updateView(state, 1);
    });

    $cat.addEventListener("change", () => {
      const state = {
        category: $cat.value,
        min: qs("#fMin").value,
        max: qs("#fMax").value,
        sort: qs("#fSort").value,
        search: $search ? $search.value : "",
        page: 1,
      };
      setParams({
        category: state.category, min: state.min, max: state.max,
        sort: state.sort, q: state.search, page: 1,
      });
      updateView(state, 1);
    });

    // =========================================
    // BÚSQUEDA EN VIVO + ENTER
    // =========================================
    if ($search) {
      const runSearch = () => {
        const state = {
          category: $cat.value,
          min: qs("#fMin").value,
          max: qs("#fMax").value,
          sort: qs("#fSort").value,
          search: $search.value,
          page: 1,
        };
        setParams({
          category: state.category,
          min: state.min,
          max: state.max,
          sort: state.sort,
          q: state.search,
          page: 1,
        });
        updateView(state, 1);
      };

      $search.addEventListener("input", runSearch);

      $search.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          runSearch();
        }
      });
    }

    // Máscara dinero
    function attachMoneyMask(input) {
      if (!input) return;
      const format = raw => {
        const digits = String(raw).replace(/\D/g, "").slice(0, 5);
        return digits ? Number(digits).toLocaleString("es-CL") : "";
      };
      input.addEventListener("input", () => {
        const next = format(input.value);
        if (input.value !== next) input.value = next;
      });
      ["blur","change"].forEach(evt => input.addEventListener(evt, () => input.value = format(input.value)));
      input.value = format(input.value);
    }

    attachMoneyMask(qs("#fMin"));
    attachMoneyMask(qs("#fMax"));

    // Paginar (delegado)
    qs("#pager")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-page]");
      if (btn && !btn.disabled) {
        const page = parseInt(btn.dataset.page || "1", 10);
        if (page && page !== CURRENT_PAGE) goToPage(page);
      }
    });

  } catch (err) {
    console.error(err);
    qs("#grid").innerHTML = `<p style="padding:24px">No fue posible cargar el catálogo.</p>`;
  }
})();
