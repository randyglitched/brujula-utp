// scoring.cjs
// Motor de matching de Brujula UTP, portado a CommonJS para poder correrlo con
// Node (testing/herramientas de auditoria). Es una copia funcional de la logica
// que tambien vive duplicada dentro de index.html (en vanilla JS, para el
// navegador). SI CAMBIAS LA LOGICA DE MATCHING, HAY QUE CAMBIARLA EN AMBOS LADOS
// - no hay single source of truth de codigo, solo de datos (data/*.json).

const fs = require("fs");
const path = require("path");

const bancoPreguntas = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "banco_preguntas.json"), "utf8")
);
const CAREERS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "perfiles_carreras.json"), "utf8")
);

const RIASEC_BANK = bancoPreguntas.riasec;
const BIG5_BANK = bancoPreguntas.big5;
const OPEN_QUESTIONS = bancoPreguntas.abiertas;
const RIASEC_ORDER = ["R", "I", "A", "S", "E", "C"];

function normalizarRespuesta(valorLikert, esReverso) {
  const valor = esReverso ? 6 - valorLikert : valorLikert;
  return ((valor - 1) / 4) * 100;
}

function construirVectorRiasec(resp) {
  const vector = {};
  RIASEC_ORDER.forEach((dim) => {
    const valores = RIASEC_BANK[dim].map((item) => normalizarRespuesta(resp[item.id], false));
    vector[dim] = valores.reduce((a, b) => a + b, 0) / valores.length;
  });
  return vector;
}

function construirVectorBig5(resp) {
  const vector = {};
  Object.keys(BIG5_BANK).forEach((rasgo) => {
    const valores = BIG5_BANK[rasgo].map((item) => normalizarRespuesta(resp[item.id], item.reverso));
    vector[rasgo] = valores.reduce((a, b) => a + b, 0) / valores.length;
  });
  return vector;
}

// Centra un vector restandole su propio promedio a cada dimension. Esto hace
// que la comparacion se fije en el "perfil" (que dimensiones son relativamente
// altas o bajas para esa persona/carrera) y no en el nivel absoluto de todas las
// respuestas, que varia mucho segun que tan generoso es cada quien puntuando.
function centrarVector(vec) {
  const valores = Object.values(vec);
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
  const centrado = {};
  for (const k in vec) centrado[k] = vec[k] - promedio;
  return centrado;
}

function covarianza(filas) {
  const n = filas.length;
  const dims = Object.keys(filas[0]);
  const medias = {};
  dims.forEach((d) => { medias[d] = filas.reduce((acc, f) => acc + f[d], 0) / n; });
  const cov = {};
  dims.forEach((di) => {
    cov[di] = {};
    dims.forEach((dj) => {
      let suma = 0;
      filas.forEach((f) => { suma += (f[di] - medias[di]) * (f[dj] - medias[dj]); });
      cov[di][dj] = suma / n;
    });
  });
  return { cov, dims };
}

function cholesky(cov, dims, regularizacion) {
  const n = dims.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  const M = dims.map((di) => dims.map((dj) => cov[di][dj] + (di === dj ? regularizacion : 0)));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let suma = M[i][j];
      for (let k = 0; k < j; k++) suma -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(suma, 1e-9)) : suma / L[j][j];
    }
  }
  return L;
}

function resolverTriangularInferior(L, v, dims) {
  const n = dims.length;
  const b = dims.map((d) => v[d]);
  const x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let suma = b[i];
    for (let k = 0; k < i; k++) suma -= L[i][k] * x[k];
    x[i] = suma / L[i][i];
  }
  return x;
}

// Calcula la matriz de "blanqueo" (whitening) a partir de los perfiles de las
// 24 carreras: decorrelaciona el espacio de comparacion para que un grupo de
// carreras muy parecidas entre si no "reparta" injustamente su voto frente a
// una carrera que este sola en su zona del espacio (ver README/CONTEXTO para
// el historial de bugs de calibracion que llevo a esto).
function calcularBlanqueo(perfiles, extractorVector) {
  const filasCentradas = perfiles.map((c) => centrarVector(extractorVector(c)));
  const { cov, dims } = covarianza(filasCentradas);
  const trazaPromedio = dims.reduce((acc, d) => acc + cov[d][d], 0) / dims.length;
  const regularizacion = trazaPromedio * 0.15;
  const L = cholesky(cov, dims, regularizacion);
  return { L, dims };
}

function blanquear(vectorCentrado, blanqueo) {
  return resolverTriangularInferior(blanqueo.L, vectorCentrado, blanqueo.dims);
}

function similitudCosenoArray(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calcularMatch(resp) {
  const PESO_RIASEC = 0.7, PESO_BIG5 = 0.3;
  const vUsuarioRiasec = construirVectorRiasec(resp);
  const vUsuarioBig5 = construirVectorBig5(resp);

  const blanqueoRiasec = calcularBlanqueo(CAREERS, (c) => c.riasec);
  const blanqueoBig5 = calcularBlanqueo(CAREERS, (c) => ({
    apertura: c.big5.apertura,
    responsabilidad: c.big5.responsabilidad,
    extraversion: c.big5.extraversion,
    amabilidad: c.big5.amabilidad,
    estabilidad_emocional: c.big5.estabilidad,
  }));

  const vUsuarioRiasecBlanco = blanquear(centrarVector(vUsuarioRiasec), blanqueoRiasec);
  const vUsuarioBig5Blanco = blanquear(centrarVector(vUsuarioBig5), blanqueoBig5);

  const resultados = CAREERS.map((carrera) => {
    const perfilBig5 = {
      apertura: carrera.big5.apertura,
      responsabilidad: carrera.big5.responsabilidad,
      extraversion: carrera.big5.extraversion,
      amabilidad: carrera.big5.amabilidad,
      estabilidad_emocional: carrera.big5.estabilidad,
    };
    const vCarreraRiasecBlanco = blanquear(centrarVector(carrera.riasec), blanqueoRiasec);
    const vCarreraBig5Blanco = blanquear(centrarVector(perfilBig5), blanqueoBig5);

    const simRiasec = similitudCosenoArray(vUsuarioRiasecBlanco, vCarreraRiasecBlanco);
    const simBig5 = similitudCosenoArray(vUsuarioBig5Blanco, vCarreraBig5Blanco);
    const scoreFinal = (simRiasec * PESO_RIASEC + simBig5 * PESO_BIG5) * 100;
    return { ...carrera, score_final: Math.round(scoreFinal * 10) / 10 };
  });
  resultados.sort((a, b) => b.score_final - a.score_final);
  return { vectorRiasec: vUsuarioRiasec, vectorBig5: vUsuarioBig5, ranking: resultados };
}

module.exports = {
  RIASEC_BANK,
  BIG5_BANK,
  OPEN_QUESTIONS,
  CAREERS,
  RIASEC_ORDER,
  normalizarRespuesta,
  construirVectorRiasec,
  construirVectorBig5,
  centrarVector,
  calcularBlanqueo,
  blanquear,
  similitudCosenoArray,
  calcularMatch,
};
