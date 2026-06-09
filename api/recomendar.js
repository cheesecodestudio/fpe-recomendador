import fs from "node:fs";
import path from "node:path";
import Groq from "groq-sdk";
import { parse } from "csv-parse/sync";

const MODEL = process.env.AI_MODEL || "llama-3.3-70b-versatile";

const FALLBACK_RESPONSE = {
  resumen:
    "No encontramos una coincidencia suficientemente clara con tus respuestas.",
  recomendaciones: [],
  nota_final:
    "Puedes ajustar tus preferencias o revisar directamente el portal oficial del FPE para confirmar opciones disponibles.",
};

const recommendationSchema = `{
  "resumen": "string",
  "recomendaciones": [
    {
      "id": "string",
      "por_que_encaja": "string",
      "empleos_posibles": ["string (1 a 4 items)"],
      "que_revisar": ["string (1 a 4 items)"],
      "proximo_paso": "string"
    }
  ],
  "nota_final": "string"
}`;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function loadCareers() {
  const csvPath = path.join(
    process.cwd(),
    "data",
    "fpe_carreras_costa_rica_2026.csv",
  );
  const csv = fs.readFileSync(csvPath, "utf8");
  return parse(csv, { columns: true, skip_empty_lines: true, trim: true });
}

function validateProfile(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};
  const areas = Array.isArray(safe.areas_interes)
    ? safe.areas_interes.slice(0, 3)
    : [];
  const modalidades = Array.isArray(safe.modalidad_preferida)
    ? safe.modalidad_preferida.slice(0, 4)
    : [];

  return {
    situacion_actual: String(safe.situacion_actual || ""),
    objetivo_principal: String(safe.objetivo_principal || ""),
    areas_interes: areas.map((x) => String(x)),
    fortalezas: Array.isArray(safe.fortalezas)
      ? safe.fortalezas.map((x) => String(x)).slice(0, 12)
      : [],
    modalidad_preferida: modalidades.map((x) => String(x)),
    tiempo_semana: String(safe.tiempo_semana || ""),
    plazo_preferido: String(safe.plazo_preferido || ""),
    zona: String(safe.zona || ""),
    importancia_rapidez: Math.min(
      5,
      Math.max(1, Number(safe.importancia_rapidez || 3)),
    ),
    importancia_empleabilidad: Math.min(
      5,
      Math.max(1, Number(safe.importancia_empleabilidad || 3)),
    ),
    comentario: String(safe.comentario || "").slice(0, 500),
  };
}

function durationMatches(plazo, months) {
  const m = Number(months || 0);
  if (!m || !plazo || plazo === "No tengo preferencia") return true;
  if (plazo === "Menos de 12 meses") return m < 12;
  if (plazo === "12 a 18 meses") return m >= 12 && m <= 18;
  if (plazo === "19 a 24 meses") return m >= 19 && m <= 24;
  if (plazo === "25 a 36 meses") return m >= 25 && m <= 36;
  if (plazo === "Mas de 36 meses" || plazo === "Más de 36 meses") return m > 36;
  return true;
}

function modalityMatches(userModalities, careerModality) {
  const selected = Array.isArray(userModalities) ? userModalities : [];
  const modality = normalizeText(careerModality);
  if (!selected.length || selected.includes("Cualquiera")) return true;

  return selected.some((item) => {
    const m = normalizeText(item);
    if (m === "presencial")
      return modality.includes("presencial") || modality.includes("in-person");
    if (m === "hibrida")
      return modality.includes("hibrid") || modality.includes("mixta");
    if (m === "en linea")
      return (
        modality.includes("online") ||
        modality.includes("linea") ||
        modality.includes("virtual")
      );
    return false;
  });
}

function cityMatches(userZone, careerCity, careerModality) {
  const zone = normalizeText(userZone);
  const city = normalizeText(careerCity);
  const modality = normalizeText(careerModality);
  if (!zone || zone.includes("cualquier")) return true;
  if (zone.includes("en linea")) {
    return (
      modality.includes("online") ||
      modality.includes("linea") ||
      modality.includes("virtual")
    );
  }
  return city.includes(zone);
}

function matchesEmployabilityArea(searchable) {
  return /tecnologia|software|datos|data|ciberseguridad|salud|idiomas|ingles|administracion|contabilidad|mecanica|refrigeracion|oficios/.test(
    searchable,
  );
}

function scoreCareer(career, profile) {
  let score = 0;
  const searchable = normalizeText(
    [
      career.programa,
      career.institucion,
      career.ciudad,
      career.modalidad,
      career.nivel,
      career.categoria,
      career.etiquetas,
    ].join(" "),
  );

  for (const interest of profile.areas_interes) {
    const ni = normalizeText(interest);
    if (!ni || ni.includes("no estoy seguro")) continue;
    if (normalizeText(career.categoria).includes(ni)) score += 5;
    if (searchable.includes(ni)) score += 4;
  }

  if (modalityMatches(profile.modalidad_preferida, career.modalidad))
    score += 3;
  if (cityMatches(profile.zona, career.ciudad, career.modalidad)) score += 3;
  if (durationMatches(profile.plazo_preferido, career.duracion_meses))
    score += 2;

  const objetivo = normalizeText(profile.objetivo_principal);
  const nivel = normalizeText(career.nivel);
  const months = Number(career.duracion_meses || 0);

  if (objetivo.includes("empleo mas rapido") && months > 0 && months <= 18)
    score += 2;
  if (objetivo.includes("carrera tecnica") && nivel.includes("tecnico"))
    score += 2;
  if (
    objetivo.includes("titulo universitario") &&
    (nivel.includes("bachillerato") || nivel.includes("licenciatura"))
  )
    score += 2;

  const rapidez = Number(profile.importancia_rapidez || 3);
  if (rapidez >= 4 && months > 0 && months <= 18) score += 1 + (rapidez - 3);

  const empleabilidad = Number(profile.importancia_empleabilidad || 3);
  if (empleabilidad >= 4 && matchesEmployabilityArea(searchable))
    score += 1 + (empleabilidad - 3);

  return score;
}

function compactCareer(career) {
  return [
    career.id,
    career.programa,
    career.institucion,
    career.ciudad,
    Number(career.costo_colones || 0),
    Number(career.duracion_meses || 0),
    career.modalidad,
    career.nivel,
    career.categoria,
    career.etiquetas,
  ];
}

function pickCandidates(careers, profile) {
  const scored = careers
    .map((career) => ({ ...career, _score: scoreCareer(career, profile) }))
    .sort((a, b) => b._score - a._score);

  const top = scored.slice(0, 15);
  if (top.length >= 8) return top;

  const selectedIds = new Set(top.map((item) => item.id));
  for (const career of scored) {
    if (selectedIds.has(career.id)) continue;
    top.push(career);
    selectedIds.add(career.id);
    if (top.length >= Math.min(8, scored.length)) break;
  }

  return top;
}

function enrichRecommendation(item, careersById) {
  const career = careersById.get(item.id);
  if (!career) return null;

  return {
    id: career.id,
    programa: career.programa,
    institucion: career.institucion,
    ciudad: career.ciudad,
    costo_colones: Number(career.costo_colones || 0),
    costo_texto: career.costo_texto || "",
    duracion_meses: Number(career.duracion_meses || 0),
    duracion_texto: career.duracion_texto || "",
    modalidad: career.modalidad,
    nivel: career.nivel,
    categoria: career.categoria,
    por_que_encaja: item.por_que_encaja,
    empleos_posibles: Array.isArray(item.empleos_posibles)
      ? item.empleos_posibles
      : [],
    que_revisar: Array.isArray(item.que_revisar) ? item.que_revisar : [],
    proximo_paso: item.proximo_paso,
  };
}

async function requestAI(profile, candidates) {
  if (!process.env.AI_API_KEY) {
    throw new Error("AI_API_KEY no esta configurada en el backend.");
  }

  const client = new Groq({ apiKey: process.env.AI_API_KEY });

  const systemInstruction = `Eres un orientador educativo para adultos miembros de La Iglesia de Jesucristo de los Santos de los Ultimos Dias en Costa Rica que estan considerando opciones de estudio aprobadas por el Fondo Perpetuo para la Educacion.

Tu tarea es recomendar maximo 3 opciones de estudio usando unicamente la lista de carreras candidatas proporcionada.

Reglas obligatorias:
1. No busques informacion en internet.
2. No inventes carreras, instituciones, costos, ciudades, duraciones ni modalidades.
3. Solo puedes recomendar programas cuyo ID este incluido en la lista de carreras candidatas.
4. Si ninguna opcion encaja bien, dilo claramente y sugiere revisar mas opciones en el portal oficial del FPE.
5. La recomendacion no reemplaza el portal oficial del FPE, la entrevista con el obispo o presidente de rama, ni la decision personal y familiar.
6. Usa lenguaje sencillo, directo y util.
7. No prometas empleo. Puedes decir "podria ayudar a prepararse para" o "podria orientarse hacia".
8. Devuelve maximo 3 opciones.
9. Para programa, institucion, ciudad, costo, duracion, modalidad, nivel y categoria, usa exactamente los datos de la lista candidata.
10. Devuelve unicamente JSON valido con esta estructura exacta:
${recommendationSchema}`;

  const userPrompt = `Perfil del participante:
${JSON.stringify(profile, null, 2)}

Carreras candidatas:
Cada carrera viene en este formato:
[id, programa, institucion, ciudad, costo_colones, duracion_meses, modalidad, nivel, categoria, etiquetas]

${JSON.stringify(candidates.map(compactCareer), null, 2)}

Recomienda maximo 3 opciones. Prioriza opciones realistas segun intereses, modalidad, duracion, zona, objetivo y fortalezas.`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  console.log("AI raw response:", completion.choices[0]?.message);

  const text = completion.choices[0]?.message?.content || "{}";
  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  try {
    const profile = validateProfile(req.body || {});
    const careers = loadCareers();
    const candidates = pickCandidates(careers, profile);
    const candidateIds = new Set(candidates.map((c) => c.id));
    const careersById = new Map(careers.map((c) => [c.id, c]));

    if (!candidates.length) {
      return res.status(200).json(FALLBACK_RESPONSE);
    }

    const ai = await requestAI(profile, candidates);

    const recomendaciones = (ai.recomendaciones || [])
      .filter((item) => item && item.id && candidateIds.has(item.id))
      .map((item) => enrichRecommendation(item, careersById))
      .filter(Boolean)
      .slice(0, 3);

    if (!recomendaciones.length) {
      return res.status(200).json(FALLBACK_RESPONSE);
    }

    return res.status(200).json({
      resumen: String(ai.resumen || FALLBACK_RESPONSE.resumen),
      recomendaciones,
      nota_final:
        String(ai.nota_final || "") ||
        "Confirma siempre programa, costo, requisitos y disponibilidad en el portal oficial del FPE, con la institucion educativa y con tu obispo o presidente de rama.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "No se pudo generar la recomendacion. Intenta nuevamente.",
    });
  }
}
