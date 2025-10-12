/* Carrusel continuo SIN duplicar items (reciclaje de nodos)
   - Anima con transform + requestAnimationFrame (suave, sin pegues)
   - Bucle perfecto: cuando el 1º sale por izquierda, se mueve al final; y viceversa
   - Flechas empujan la cinta sin romper la animación
   - No depende del layout previo: crea una fila interna (row) y mueve ahí las cards
*/

const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

/* ---------- Utils ---------- */
const money = (v) => {
  const n = Number(String(v).replace(/[^\d]/g, "")) || 0;
  return `$${n.toLocaleString("es-CL")}`;
};

async function loadData() {
  const res = await fetch("data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar data/products.json");
  return res.json();
}

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
  return el;
}

function waitImages(container) {
  const imgs = [...container.querySelectorAll("img")];
  const pend = imgs.filter(i => !i.complete);
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

/* ---------- Motor del carrusel (reciclaje) ---------- */
function initLooper(track, { speed = 24 } = {}) {
  if (track._looperInited) return;
  track._looperInited = true;

  // 1) Crear una fila interna (row) y mover las cards ahí
  const originalItems = [...track.children];
  if (originalItems.length === 0) return;

  // El track actuará como viewport; la animación se aplica a row
  track.style.overflow = "hidden";
  track.style.position = "relative";
  track.style.transform = ""; // nos aseguramos de no animar el track

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "stretch";
  row.style.gap = getComputedStyle(track).gap || "16px";
  row.style.willChange = "transform";
  row.style.transform = "translateX(0px)"; // animaremos esto
  row.style.transition = "none"; // SIN transiciones, todo por rAF

  // Mover hijos existentes al row
  originalItems.forEach(n => row.appendChild(n));
  track.innerHTML = "";
  track.appendChild(row);

  // Medición: ancho de item + gap a la derecha
  const GAP = parseFloat(row.style.gap) || 16;
  const itemOuterWidth = (el, includeGap = true) => {
    const w = el.getBoundingClientRect().width;
    return includeGap ? (w + GAP) : w;
  };

  // Estado de animación
  let lastTs = 0;
  let offset = 0; // px de avance acumulado hacia la izquierda (positivos)
  let rafId  = 0;

  // Render
  const render = () => {
    row.style.transform = `translateX(${-offset}px)`;
  };

  // Reciclaje hacia delante (cuando el 1º salió entero por la izquierda)
  const recycleForward = () => {
    let guard = 0;
    while (row.children.length && guard++ < 100) {
      const first = row.children[0];
      const need  = itemOuterWidth(first); // ancho completo + gap
      if (offset >= need) {
        offset -= need;        // compensamos lo que “salió”
        row.appendChild(first); // movemos al final
      } else {
        break;
      }
    }
  };

  // Reciclaje hacia atrás (cuando offset < 0 por empuje de flecha hacia derecha)
  const recycleBackward = () => {
    let guard = 0;
    while (offset < 0 && row.children.length && guard++ < 100) {
      const last = row.children[row.children.length - 1];
      const need = itemOuterWidth(last);  // ancho + gap
      row.insertBefore(last, row.children[0]); // lo traemos delante
      offset += need;                     // compensamos para mantener continuidad
    }
  };

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    // Avance continuo SIEMPRE
    offset += speed * dt;

    recycleForward();   // mueve nodos si cruzamos un umbral
    render();
    rafId = requestAnimationFrame(tick);
  };

  render();
  rafId = requestAnimationFrame(tick);

  // API pública para flechas
  track._loopAPI = {
    nudge(dx) {
      // dx positivo = empujar la cinta visualmente a la derecha -> offset disminuye
      // dx negativo = empujar a la izquierda -> offset aumenta
      offset -= dx;
      recycleBackward(); // si offset < 0, traemos items del final al principio
      recycleForward();  // por si el empuje cruzó varios elementos hacia la izquierda
      render();
    },
    setSpeed(s) { speed = s; }
  };

  // Re-medir y corregir en Resize (layouts responsivos)
  let rto;
  window.addEventListener("resize", () => {
    clearTimeout(rto);
    rto = setTimeout(() => {
      // No necesitamos caches de anchos; reciclamos con medidas en vivo
      // Forzamos un render para evitar micro desalineaciones perceptibles
      recycleBackward();
      recycleForward();
      render();
    }, 120);
  });
}

/* ---------- Setup por sección ---------- */
async function setupCarouselSection(sectionEl, items) {
  const carousel = sectionEl.querySelector(".carousel");
  const track    = carousel.querySelector(".track");
  const prevBtn  = carousel.querySelector(".nav-btn.prev");
  const nextBtn  = carousel.querySelector(".nav-btn.next");

  // Rellenar tarjetas
  track.innerHTML = "";
  items.forEach(p => track.appendChild(card(p)));

  // Sin items → ocultar flechas
  if (items.length === 0) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }
  // 1 item → flechas no aportan
  if (items.length === 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }

  // Espera a que las imágenes tengan tamaño para medir bien
  await waitImages(track);

  // Arrancar carrusel siempre
  initLooper(track, { speed: 24 });

  // Flechas: empujan sin romper el bucle (no hay pausa)
  const step = () => Math.max(track.clientWidth * 0.9, 280);
  prevBtn.addEventListener("click", () => track._loopAPI?.nudge(+step())); // derecha
  nextBtn.addEventListener("click", () => track._loopAPI?.nudge(-step())); // izquierda
}

/* ---------- Bootstrap ---------- */
(async () => {
  try {
    const data = await loadData();
    const sections = document.querySelectorAll(".catalog-section");
    for (const sec of sections) {
      const key  = sec.getAttribute("data-category"); // women, men, black, red, lavit
      const list = Array.isArray(data[key]) ? data[key] : [];
      await setupCarouselSection(sec, list);
    }
  } catch (e) {
    console.error(e);
  }
})();
