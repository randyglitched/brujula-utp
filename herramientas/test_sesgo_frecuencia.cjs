// herramientas/test_sesgo_frecuencia.cjs
//
// Simula estudiantes respondiendo al azar y mide que tan seguido gana cada
// carrera como resultado #1. Si una carrera domina de forma desproporcionada
// (mucho mas que las demas), hay un problema de calibracion: probablemente su
// perfil es "generico"/central en el espacio RIASEC+Big5, o le faltan
// competidores cercanos que le "roben" votos parecidos a los suyos.
//
// Correr despues de CUALQUIER cambio a data/perfiles_carreras.json:
//   node herramientas/test_sesgo_frecuencia.cjs [N]
//
// N = cantidad de estudiantes simulados (default 2000).

const { RIASEC_BANK, BIG5_BANK, CAREERS, calcularMatch } = require("../scoring.cjs");

const N = parseInt(process.argv[2], 10) || 2000;

function respuestaAleatoria() {
  const resp = {};
  Object.values(RIASEC_BANK).forEach((items) => {
    items.forEach((item) => { resp[item.id] = 1 + Math.floor(Math.random() * 5); });
  });
  Object.values(BIG5_BANK).forEach((items) => {
    items.forEach((item) => { resp[item.id] = 1 + Math.floor(Math.random() * 5); });
  });
  return resp;
}

console.log(`Simulando ${N} estudiantes con respuestas al azar...\n`);

const conteo = {};
CAREERS.forEach((c) => { conteo[c.id] = 0; });

for (let i = 0; i < N; i++) {
  const resultado = calcularMatch(respuestaAleatoria());
  const ganador = resultado.ranking[0];
  conteo[ganador.id] += 1;
}

const filas = CAREERS.map((c) => ({
  nombre: c.nombre,
  conteo: conteo[c.id],
  pct: (conteo[c.id] / N) * 100,
})).sort((a, b) => b.pct - a.pct);

filas.forEach((f) => {
  console.log(`${f.pct.toFixed(1).padStart(5)}%  (${String(f.conteo).padStart(4)})  ${f.nombre}`);
});

const pcts = filas.map((f) => f.pct);
const min = Math.min(...pcts);
const max = Math.max(...pcts);
const esperadoUniforme = 100 / CAREERS.length;

console.log(`\nRango de frecuencia: ${min.toFixed(1)}% - ${max.toFixed(1)}%  (uniforme esperado: ${esperadoUniforme.toFixed(1)}%)`);

if (max > esperadoUniforme * 4) {
  console.log("ATENCION: al menos una carrera domina de forma desproporcionada (>4x lo esperado). Revisar calibracion.");
  process.exitCode = 1;
} else {
  console.log("Distribucion razonable — ninguna carrera domina de forma desproporcionada.");
}
