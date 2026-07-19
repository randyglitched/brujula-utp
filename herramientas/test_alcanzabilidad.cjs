// herramientas/test_alcanzabilidad.cjs
//
// Confirma que las 24 carreras pueden salir como resultado #1 (ninguna esta
// matematicamente bloqueada por tener un "gemelo" casi identico que siempre le
// gane). Para cada carrera, construye una respuesta sintetica "perfecta" (que
// reproduce exactamente su perfil RIASEC + Big Five) y corre el motor de
// matching real (scoring.cjs) para ver en que puesto queda.
//
// Correr despues de CUALQUIER cambio a data/perfiles_carreras.json:
//   node herramientas/test_alcanzabilidad.cjs

const {
  RIASEC_BANK,
  BIG5_BANK,
  RIASEC_ORDER,
  CAREERS,
  calcularMatch,
} = require("../scoring.cjs");

// Inversa de normalizarRespuesta(valorLikert, esReverso): dado un score 0-100
// objetivo, calcula que respuesta likert (1-5) lo produce.
function likertParaScore(score, esReverso) {
  const valorEfectivo = (score / 100) * 4 + 1;
  const valorLikert = esReverso ? 6 - valorEfectivo : valorEfectivo;
  return Math.min(5, Math.max(1, Math.round(valorLikert)));
}

function generarRespuestaPerfecta(carrera) {
  const resp = {};
  RIASEC_ORDER.forEach((dim) => {
    const score = carrera.riasec[dim];
    RIASEC_BANK[dim].forEach((item) => {
      resp[item.id] = likertParaScore(score, false);
    });
  });
  const mapaBig5 = {
    apertura: carrera.big5.apertura,
    responsabilidad: carrera.big5.responsabilidad,
    extraversion: carrera.big5.extraversion,
    amabilidad: carrera.big5.amabilidad,
    estabilidad_emocional: carrera.big5.estabilidad,
  };
  Object.keys(BIG5_BANK).forEach((rasgo) => {
    const score = mapaBig5[rasgo];
    BIG5_BANK[rasgo].forEach((item) => {
      resp[item.id] = likertParaScore(score, item.reverso);
    });
  });
  return resp;
}

console.log(`Probando alcanzabilidad de las ${CAREERS.length} carreras...\n`);

let alcanzables = 0;
const noAlcanzables = [];

CAREERS.forEach((carrera) => {
  const resp = generarRespuestaPerfecta(carrera);
  const resultado = calcularMatch(resp);
  const puesto = resultado.ranking.findIndex((c) => c.id === carrera.id) + 1;
  const ganador = resultado.ranking[0];

  if (puesto === 1) {
    alcanzables += 1;
    console.log(`OK   #1  ${carrera.nombre}`);
  } else {
    noAlcanzables.push({ carrera, puesto, ganador });
    console.log(
      `FAIL #${puesto}  ${carrera.nombre}  (le gana: ${ganador.nombre}, score ${ganador.score_final} vs ${
        resultado.ranking.find((c) => c.id === carrera.id).score_final
      })`
    );
  }
});

console.log(`\n${alcanzables} / ${CAREERS.length} carreras pueden salir como resultado #1.`);

if (noAlcanzables.length > 0) {
  console.log(
    `\nATENCION: ${noAlcanzables.length} carrera(s) nunca pueden ganar ni con su propio perfil perfecto de respuesta.`
  );
  console.log("Esto suele significar que tienen un perfil RIASEC/Big5 casi identico a otra carrera");
  console.log("que le gana sistematicamente. Revisar diferenciacion en data/perfiles_carreras.json.");
  process.exitCode = 1;
} else {
  console.log("Todas las carreras son alcanzables. Sin bloqueos estructurales detectados.");
}
