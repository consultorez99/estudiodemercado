// Tabla colonia → código postal (Aguascalientes Norte).
//
// CÓMO LLENARLA: pon el CP de 5 dígitos entre comillas al lado de cada colonia.
// Lo que dejes como '' (vacío) no asigna CP (queda en blanco, nunca inventa).
// El match es por inclusión de subcadena sobre la ubicación del anuncio
// (p. ej. "Pocitos, Aguascalientes"), así que las claves MÁS ESPECÍFICAS van
// primero (p. ej. "valle del campestre" antes que "campestre").
//
// Puedes agregar nuevas filas conforme aparezcan colonias en tus capturas.
export const CP_BY_COLONIA: Array<[string, string]> = [
  ['arroyo del molino norte', ''],
  ['arroyo el molino', ''],
  ['misión del campanario', ''],
  ['campanario', ''],
  ['bosques del prado norte', ''],
  ['bosques del prado sur', ''],
  ['los bosques', ''],
  ['los calicantos', ''],
  ['valle del campestre', ''],
  ['villas del campestre', ''],
  ['campestre', ''],
  ['terzetto', ''],
  ['san josé del arenal', ''],
  ['valle de santa teresa', ''],
  ['pozo bravo norte', ''],
  ['trojes del sol', ''],
  ['trojes de alonso', ''],
  ['trojes de oriente', ''],
  ['trojes de kristal', ''],
  ['trojes', ''],
  ['pocitos', ''],
  ['villas de san nicolás', ''],
  ['silos', ''],
  ['fátima', ''],
];

// Returns the CP for a listing location, or null if the colonia isn't mapped
// (or its CP is left blank).
export function lookupCp(location: string): string | null {
  const loc = (location || '').toLowerCase();
  for (const [key, cp] of CP_BY_COLONIA) {
    if (cp && loc.includes(key)) return cp;
  }
  return null;
}
