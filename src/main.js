import "./styles.css";

/* ─── OPCIONES ───────────────────────────────────────────────── */
const OPTIONS = {
  situacion_actual: [
    "Tengo trabajo, pero deseo mejorar mis ingresos.",
    "Tengo trabajo, pero deseo cambiar de area.",
    "Estoy sin trabajo.",
    "Quiero terminar o retomar estudios.",
    "Quiero prepararme para un mejor empleo."
  ],
  objetivo_principal: [
    "Conseguir empleo mas rapido.",
    "Mejorar mi empleo actual.",
    "Cambiar de carrera laboral.",
    "Obtener una carrera tecnica.",
    "Obtener un titulo universitario.",
    "Aprender un idioma.",
    "Emprender o fortalecer un negocio."
  ],
  areas_interes: [
    "Tecnologia",
    "Desarrollo de software",
    "Datos / analisis de datos",
    "Ciberseguridad",
    "Administracion / negocios",
    "Contabilidad / finanzas",
    "Idiomas",
    "Salud",
    "Educacion",
    "Mecanica / oficios tecnicos",
    "Refrigeracion / aire acondicionado",
    "Belleza / servicios personales",
    "Aviacion",
    "Produccion audiovisual",
    "Recursos humanos",
    "No estoy seguro"
  ],
  fortalezas: [
    "Uso de computadora",
    "Atencion al cliente",
    "Ventas",
    "Trabajo administrativo",
    "Numeros / finanzas",
    "Reparar cosas o trabajo manual",
    "Cuidar o ayudar a personas",
    "Ensenar o explicar",
    "Aprender idiomas",
    "Organizacion y liderazgo",
    "Creatividad / diseno",
    "Ninguna experiencia especifica todavia"
  ],
  modalidad_preferida: ["Presencial", "Hibrida", "En linea", "Cualquiera"],
  tiempo_semana: ["Menos de 5 horas", "5 a 10 horas", "10 a 15 horas", "Mas de 15 horas"],
  plazo_preferido: [
    "Menos de 12 meses",
    "12 a 18 meses",
    "19 a 24 meses",
    "25 a 36 meses",
    "Mas de 36 meses",
    "No tengo preferencia"
  ],
  zona: [
    "San Jose",
    "Heredia",
    "Alajuela",
    "Liberia",
    "San Ramon",
    "Cartago",
    "Puntarenas",
    "En linea",
    "Cualquier lugar si vale la pena"
  ]
};

/* ─── REFS ───────────────────────────────────────────────────── */
const form          = document.querySelector("#recomendador-form");
const submitBtn     = document.querySelector("#submit-btn");
const loadingState  = document.querySelector("#loading-state");
const resultsNode   = document.querySelector("#resultados");
const formError     = document.querySelector("#form-error");
const areasCounter  = document.querySelector("#areas-counter");
const charCount     = document.querySelector("#char-count");
const rapidezVal    = document.querySelector("#rapidez-val");
const empleabilidadVal = document.querySelector("#empleabilidad-val");

/* ─── HELPERS ────────────────────────────────────────────────── */
function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const CHECK_ICON_SVG = `<svg class="chip-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

/* ─── FILL SELECTS ───────────────────────────────────────────── */
function fillSelect(name, values) {
  const select = form.elements.namedItem(name);
  select.innerHTML = "";
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

/* ─── FILL CHIP CHECKBOXES ───────────────────────────────────── */
function fillChips(containerId, inputName, values) {
  const container = document.querySelector(`#${containerId}`);
  container.innerHTML = "";
  for (const value of values) {
    const label = document.createElement("label");
    label.className = "chip-label";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = inputName;
    input.value = value;

    label.innerHTML = CHECK_ICON_SVG;
    label.prepend(input);
    label.append(document.createTextNode(value));
    container.append(label);
  }
}

/* ─── SELECTED VALUES ────────────────────────────────────────── */
function selectedValues(name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((n) => n.value);
}

/* ─── AREAS LIMIT ────────────────────────────────────────────── */
function updateAreasState() {
  const checked = selectedValues("areas_interes");
  const inputs  = Array.from(form.querySelectorAll('input[name="areas_interes"]'));
  const full    = checked.length >= 3;

  for (const input of inputs) {
    input.disabled = full && !input.checked;
  }

  if (areasCounter) {
    areasCounter.textContent = `${checked.length} / 3`;
    areasCounter.style.background = full ? "var(--primary)" : "var(--primary-lt)";
    areasCounter.style.color = full ? "#fff" : "var(--primary)";
  }
}

/* ─── MODALIDAD RULE ─────────────────────────────────────────── */
function enforceModalidadRule(lastChanged) {
  const inputs    = Array.from(form.querySelectorAll('input[name="modalidad_preferida"]'));
  const cualquiera = inputs.find((i) => i.value === "Cualquiera");
  if (!cualquiera) return;

  if (lastChanged.value === "Cualquiera" && lastChanged.checked) {
    for (const input of inputs) {
      if (input !== cualquiera) input.checked = false;
    }
    return;
  }

  if (lastChanged.value !== "Cualquiera" && lastChanged.checked) {
    cualquiera.checked = false;
    return;
  }

  if (!selectedValues("modalidad_preferida").length) {
    cualquiera.checked = true;
  }
}

/* ─── RANGE LIVE VALUES ──────────────────────────────────────── */
function bindRange(inputName, displayEl) {
  const input = form.elements.namedItem(inputName);
  if (!input || !displayEl) return;
  input.addEventListener("input", () => { displayEl.textContent = input.value; });
}

/* ─── CHAR COUNT ─────────────────────────────────────────────── */
function bindCharCount() {
  const textarea = form.elements.namedItem("comentario");
  if (!textarea || !charCount) return;
  textarea.addEventListener("input", () => {
    const len = textarea.value.length;
    charCount.textContent = len;
    charCount.style.color = len > 450 ? "var(--danger)" : "var(--subtle)";
  });
}

/* ─── SHOW / HIDE ERROR ──────────────────────────────────────── */
function showFormError(message) {
  if (!formError) return;
  formError.hidden = false;
  formError.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${escapeHtml(message)}`;
  formError.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearFormError() {
  if (!formError) return;
  formError.hidden = true;
  formError.textContent = "";
}

/* ─── READ FORM ──────────────────────────────────────────────── */
function readForm() {
  return {
    situacion_actual:      form.elements.namedItem("situacion_actual").value,
    objetivo_principal:    form.elements.namedItem("objetivo_principal").value,
    areas_interes:         selectedValues("areas_interes"),
    fortalezas:            selectedValues("fortalezas"),
    modalidad_preferida:   selectedValues("modalidad_preferida"),
    tiempo_semana:         form.elements.namedItem("tiempo_semana").value,
    plazo_preferido:       form.elements.namedItem("plazo_preferido").value,
    zona:                  form.elements.namedItem("zona").value,
    importancia_rapidez:   Number(form.elements.namedItem("importancia_rapidez").value),
    importancia_empleabilidad: Number(form.elements.namedItem("importancia_empleabilidad").value),
    comentario:            String(form.elements.namedItem("comentario").value || "").slice(0, 500)
  };
}

/* ─── VALIDATE ───────────────────────────────────────────────── */
function validatePayload(payload) {
  if (!payload.areas_interes.length)      return "Selecciona al menos un area de interes.";
  if (payload.areas_interes.length > 3)   return "Solo se permiten hasta 3 areas de interes.";
  if (!payload.modalidad_preferida.length) return "Selecciona al menos una modalidad posible.";
  if (payload.comentario.length > 500)    return "El comentario supera los 500 caracteres.";
  return "";
}

/* ─── RENDER RESULTS ─────────────────────────────────────────── */
const FALLBACK_EMPTY = "No encontramos una coincidencia clara con tus respuestas. Puedes ajustar tus preferencias o revisar directamente el portal oficial del FPE.";

function renderResults(payload) {
  const recomendaciones = Array.isArray(payload?.recomendaciones) ? payload.recomendaciones : [];

  const summaryHtml = payload?.resumen
    ? `<div class="result-summary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;color:var(--accent);margin-top:.1rem"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <span>${escapeHtml(payload.resumen)}</span>
       </div>`
    : "";

  if (!recomendaciones.length) {
    resultsNode.innerHTML = `
      ${summaryHtml}
      <div class="result-empty"><p>${escapeHtml(FALLBACK_EMPTY)}</p></div>
    `;
    resultsNode.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const cardsHtml = recomendaciones.map((item, idx) => {
    const empleos = (item.empleos_posibles || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");
    const revisar = (item.que_revisar || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");
    const costo   = item.costo_texto || (item.costo_colones ? `CRC ${Number(item.costo_colones).toLocaleString("es-CR")}` : "Consultar");
    const duracion = item.duracion_texto || (item.duracion_meses ? `${item.duracion_meses} meses` : "Consultar");

    return `
      <article class="result-card">
        <div class="result-card-header">
          <div class="result-card-number">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Opcion ${idx + 1}
          </div>
          <h3>${escapeHtml(item.programa)}</h3>
          <p class="institution">${escapeHtml(item.institucion)}</p>
        </div>
        <div class="result-card-body">
          <div class="result-meta">
            <div class="meta-item">
              <span class="meta-label">Ciudad</span>
              <span class="meta-value">${escapeHtml(item.ciudad)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Modalidad</span>
              <span class="meta-value">${escapeHtml(item.modalidad)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Duracion</span>
              <span class="meta-value">${escapeHtml(duracion)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Costo aprox.</span>
              <span class="meta-value">${escapeHtml(costo)}</span>
            </div>
          </div>

          <div>
            <p class="result-section-title">Por que puede encajar</p>
            <div class="result-encaja">${escapeHtml(item.por_que_encaja)}</div>
          </div>

          ${empleos ? `<div>
            <p class="result-section-title">Posibles areas de empleo</p>
            <ul class="result-list">${empleos}</ul>
          </div>` : ""}

          ${revisar ? `<div>
            <p class="result-section-title">Que revisar antes de decidir</p>
            <ul class="result-list">${revisar}</ul>
          </div>` : ""}

          <div class="result-proximo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;margin-top:.1rem"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
            <span><strong>Proximo paso:</strong> ${escapeHtml(item.proximo_paso)}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  const disclaimerHtml = `
    <div class="result-disclaimer">
      Esta herramienta solo orienta con base en una lista de programas aprobados del FPE.
      Antes de tomar una decision, confirme la informacion en el portal oficial del FPE,
      consulte con la institucion educativa y converse con su obispo o presidente de rama.
    </div>
  `;

  resultsNode.innerHTML = summaryHtml + cardsHtml + disclaimerHtml;
  resultsNode.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ─── RENDER ERROR ───────────────────────────────────────────── */
function renderError(message) {
  resultsNode.innerHTML = `<div class="result-error">${escapeHtml(message)}</div>`;
  resultsNode.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ─── SUBMIT ─────────────────────────────────────────────────── */
async function onSubmit(event) {
  event.preventDefault();
  clearFormError();

  const payload = readForm();
  const error   = validatePayload(payload);
  if (error) {
    showFormError(error);
    return;
  }

  submitBtn.disabled   = true;
  loadingState.hidden  = false;
  resultsNode.innerHTML = "";
  loadingState.scrollIntoView({ behavior: "smooth", block: "center" });

  try {
    const response = await fetch("/api/recomendar", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("No se pudieron generar recomendaciones en este momento.");

    const result = await response.json();
    renderResults(result);
  } catch (err) {
    renderError(err?.message || "Ocurrio un error inesperado.");
  } finally {
    submitBtn.disabled  = false;
    loadingState.hidden = true;
  }
}

/* ─── INIT ───────────────────────────────────────────────────── */
function init() {
  fillSelect("situacion_actual",   OPTIONS.situacion_actual);
  fillSelect("objetivo_principal", OPTIONS.objetivo_principal);
  fillSelect("tiempo_semana",      OPTIONS.tiempo_semana);
  fillSelect("plazo_preferido",    OPTIONS.plazo_preferido);
  fillSelect("zona",               OPTIONS.zona);

  fillChips("areas-interes",       "areas_interes",       OPTIONS.areas_interes);
  fillChips("fortalezas",          "fortalezas",          OPTIONS.fortalezas);
  fillChips("modalidad-preferida", "modalidad_preferida", OPTIONS.modalidad_preferida);

  // Default: Cualquiera checked
  const cualquieraInput = form.querySelector('input[name="modalidad_preferida"][value="Cualquiera"]');
  if (cualquieraInput) cualquieraInput.checked = true;

  // Live range labels
  bindRange("importancia_rapidez",       rapidezVal);
  bindRange("importancia_empleabilidad", empleabilidadVal);

  // Live char count
  bindCharCount();

  // Change events
  form.addEventListener("change", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name === "areas_interes")      updateAreasState();
    if (target.name === "modalidad_preferida") enforceModalidadRule(target);
  });

  form.addEventListener("submit", onSubmit);
}

init();
