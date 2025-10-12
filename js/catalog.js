/* Carrusel continuo sin duplicar nodos (reciclaje de ítems)
   - Bucle perfecto moviendo el primer/último hijo al final/inicio al cruzar el borde
   - Animación con transform + rAF (suave, sin “pegues”)
   - Flechas empujan sin romper el bucle
   - Sin clones (cumple tu requisito)
*/

const WA_PHONE = "56912345678";
const WA_MSG   = encodeURIComponent("Hola, me interesa este producto 👇");

// -------- Utils --------
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

// Espera a que las imágenes tengan tamaño (para medir bien)
function waitImages(container) {
  const imgs = [...container.querySelectorAll("img")];
  const pend = imgs.filter(i => !i.complete);
  if (pend.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let left = pend.length;
    const done = () => { if (--left === 0) resolve(); };
    pend.forEach(i => {
      i.addEventListener("load", done, { once:true });
      i.addEventListener("error", done, { once:true });
    });
  });
}

/* ================= Motor de cinta (reciclaje) =================
   Estructura: .track contiene directamente las .card (sin clones)
   Avanzamos con offset; cuando el primer ítem sale entero por la izquierda
   restamos su ancho+gap al offset y movemos ese ítem al final.
   Si vamos hacia atrás (flecha prev) y offset < 0, tomamos el último
   y lo movemos al inicio, sumando su ancho+gap al offset.
*/
function initLooper(track, { speed = 24 } = {}) {
  if (track._looper) return;
  track._looper = true;

  // El track actuará como viewport.
  track.style.overflow = "hidden";
  track.style.position = "relative";
  // Leemos el gap del track (usa gap:16px en tu CSS)
  const gap = parseFloat(getComputedStyle(track).gap || "16") || 16;

  // Estado
  let lastTs = 0;
  let offset = 0; // avance total (px), positivo hacia la izquierda (se desplaza X negativo)
  let rafId  = 0;

  // Helpers de medida
  const itemOuterWidth = (el) => {
    // ancho visual del item en la fila + el gap que le sigue (menos en el último)
    // para reciclaje usamos “ancho del item + gap” como bloque unitario
    const w = el.getBoundingClientRect().width;
    return w + gap;
  };

  // Renderiza el translate en función del offset (negativo hacia la izquierda)
  const render = () => {
    const x = -offset;
    track.style.transform = `translateX(${x}px)`;
  };

  const tick = (ts) => {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    // Avance continuo
    offset += speed * dt;

    // Mientras el primer item haya salido por completo, recíclalo al final
    let loopGuard = 0; // evita loops infinitos si algo raro pasa
    while (track.children.length > 0 && loopGuard++ < 50) {
      const first = track.children[0];
      const need = itemOuterWidth(first);
      if (offset >= need) {
        // Ajustamos offset quitando el ancho del primer bloque que salió
        offset -= need;
        // Movemos el primer hijo al final
        track.appendChild(first);
        // Continuamos por si salen varios en un frame
      } else {
        break;
      }
    }

    // Si offset se hizo negativo (por flecha hacia atrás), traemos items desde el final
    loopGuard = 0;
    while (offset < 0 && track.children.length > 0 && loopGuard++ < 50) {
      const last = track.children[track.children.length - 1];
      const need = itemOuterWidth(last);
      // Al traer uno desde el final al inicio, debemos aumentar offset para compensar
      offset += need;
      track.insertBefore(last, track.children[0]);
    }

    render();
    rafId = requestAnimationFrame(tick);
  };

  render();
  rafId = requestAnimationFrame(tick);

  // API pública (flechas)
  track._loopAPI = {
    nudge(dx) {
      // dx > 0 significa mover “hacia la derecha” visual → reducimos offset
      // dx < 0 significa mover “hacia la izquierda” visual → aumentamos offset
      offset -= dx;
      // Normalizamos inmediatamente por si cruzamos umbrales
      // (dejamos que el próximo frame haga reciclaje extra si queda pendiente)
      render();
    },
    setSpeed(s) { speed = s; },
  };

  // Re-medida en resize (por cambios de ancho responsivo)
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      // No necesitamos recalcular nada global, el reciclaje usa medidas “al vuelo”.
      // Forzamos un render para evitar micro desalineaciones perceptibles.
      render();
    }, 120);
  });
}

// Configura una sección: crea tarjetas, espera imágenes y arma el loop
async function setupCarouselSection(sectionEl, items) {
  const carousel = sectionEl.querySelector(".carousel");
  const track    = carousel.querySelector(".track");
  const prevBtn  = carousel.querySelector(".nav-btn.prev");
  const nextBtn  = carousel.querySelector(".nav-btn.next");

  // Poblar tarjetas
  track.innerHTML = "";
  items.forEach(p => track.appendChild(card(p)));

  // Si no hay items, oculta flechas
  if (items.length === 0) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }
  // Con 1 item, igual reciclamos (no hará nada visible), pero ocultamos flechas
  if (items.length === 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }

  // Espera a que imágenes tengan tamaño y arranca
  await waitImages(track);
  initLooper(track, { speed: 24 });

  // Flechas: empujan la cinta sin romper el bucle
  const step = () => Math.max(track.clientWidth * 0.9, 280);
  prevBtn.addEventListener("click", () => track._loopAPI?.nudge(+step())); // derecha
  nextBtn.addEventListener("click", () => track._loopAPI?.nudge(-step())); // izquierda
}

// -------- Arranque --------
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
