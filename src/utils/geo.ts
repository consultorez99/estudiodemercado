// Centroides aproximados de colonias de Aguascalientes Norte.
// No son coordenadas catastrales; bastan para separar zonas en el mapa de calor.
// Las claves más específicas van primero porque el match usa `includes`.
const baseCoords: Array<[string, [number, number]]> = [
  ['arroyo del molino norte', [21.945, -102.305]],
  ['arroyo el molino', [21.933, -102.301]],
  ['misión del campanario', [21.928, -102.312]],
  ['campanario', [21.928, -102.312]],
  ['bosques del prado norte', [21.912, -102.305]],
  ['bosques del prado sur', [21.905, -102.305]],
  ['los bosques', [21.908, -102.300]],
  ['los calicantos', [21.952, -102.315]],
  ['valle del campestre', [21.918, -102.298]],
  ['villas del campestre', [21.914, -102.296]],
  ['campestre', [21.916, -102.302]],
  ['terzetto', [21.930, -102.320]],
  ['san josé del arenal', [21.900, -102.330]],
  ['valle de santa teresa', [21.960, -102.300]],
  ['pozo bravo norte', [21.895, -102.320]],
  ['trojes del sol', [21.955, -102.280]],
  ['trojes de alonso', [21.965, -102.290]],
  ['trojes de oriente', [21.950, -102.270]],
  ['trojes de kristal', [21.958, -102.285]],
  ['trojes', [21.955, -102.282]],
  ['pocitos', [21.918, -102.315]],
  ['villas de san nicolás', [21.940, -102.295]],
  ['silos', [21.890, -102.300]],
  ['fátima', [21.905, -102.290]],
  ['san telmo', [21.928, -102.296]],
];

const DEFAULT_COORDS: [number, number] = [21.920, -102.305];

// Jitter determinista derivado de un seed (p. ej. el id de la propiedad)
// para que cada marcador tenga una posición estable y distinta entre renders.
const seededJitter = (seed: number): number => {
  const x = Math.sin(seed * 99991) * 10000;
  return ((x - Math.floor(x)) - 0.5) * 0.008;
};

export const getCoordinates = (location: string, seed = 0): [number, number] => {
  const loc = (location || '').toLowerCase();
  let coords: [number, number] = DEFAULT_COORDS;
  for (const [key, value] of baseCoords) {
    if (loc.includes(key)) {
      coords = value;
      break;
    }
  }
  return [coords[0] + seededJitter(seed), coords[1] + seededJitter(seed + 1)];
};
