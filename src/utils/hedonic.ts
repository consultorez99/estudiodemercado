// Modelo hedónico lineal (OLS) para estimar precio de vivienda, adaptado al
// mercado mexicano. Metodología: Wan et al. (2025), Jha et al. (2025).
// Ver "Formula Prediccion corregida".
//
// Cambio clave vs. el paper: la ubicación se modela por COLONIA (categórica,
// one-hot), no por distancia al centro (que en México es bimodal y poco fiable).
// La distancia queda como variable secundaria OPCIONAL.
//
//   Precio = β0 + Σ(βi·xi numéricas) + γ(colonia) + [opcional] β·dist_centro

export const NUMERIC_FEATURES = ['area', 'edad', 'pisos', 'banos', 'lote', 'anio'] as const;
export type NumericFeature = (typeof NUMERIC_FEATURES)[number];

export interface NumericCoefficients {
  intercepto: number;
  area: number;
  edad: number;
  pisos: number;
  banos: number;
  lote: number;
  anio: number;
}

export interface Quality {
  r2: number;
  rmse: number;
  mnape: number;
  n_observaciones: number;
}

export interface HedonicModel {
  modelo: string;
  version: string;
  moneda: string;
  anio_base: number;
  usa_distancia: boolean;
  colonia_referencia: string;
  coeficientes_numericos: NumericCoefficients;
  ajuste_colonia: Record<string, number>;
  coeficiente_distancia_opcional: number | null;
  calidad: Quality;
  calibrado_en?: string;
  rangos?: Partial<Record<NumericFeature, { min: number; max: number }>>;
}

export interface PropertyFeatures {
  area: number;
  edad: number;
  pisos: number;
  banos: number;
  lote: number;
  anio: number;
  colonia: string;
  dist_centro?: number;
}

export interface TrainingRow extends PropertyFeatures {
  precio: number;
}

// --- Modelo demo del documento corregido (demo-2; datos sintéticos) ----------
export const DEMO_MODEL: HedonicModel = {
  modelo: 'hedonico_lineal_ols',
  version: 'demo-2',
  moneda: 'MXN',
  anio_base: 2019,
  usa_distancia: false,
  colonia_referencia: 'Pulgas Pandas',
  coeficientes_numericos: {
    intercepto: -88980.39,
    area: 9905.3,
    edad: -5734.0,
    pisos: 22742.92,
    banos: 38220.81,
    lote: 662.49,
    anio: 55072.76,
  },
  ajuste_colonia: {
    'Pulgas Pandas': 0,
    Centro: 116282,
    'Jardines de la Asuncion': 334991,
    'Las Americas': 424485,
    'Lomas del Campestre': 881103,
    'Bosques del Prado': 969113,
  },
  coeficiente_distancia_opcional: null,
  calidad: { r2: 0.984, rmse: 117354, mnape: 0.039, n_observaciones: 48 },
};

// --- Predicción -------------------------------------------------------------
// Devuelve { precio, coloniaCalibrada }: la zona desconocida usa el ajuste de
// referencia (0) y se marca como baja confianza.
export function predict(prop: PropertyFeatures, model: HedonicModel): { precio: number; coloniaCalibrada: boolean } {
  const c = model.coeficientes_numericos;
  let p = c.intercepto;
  for (const k of NUMERIC_FEATURES) p += c[k] * (prop[k] || 0);

  const coloniaCalibrada = Object.prototype.hasOwnProperty.call(model.ajuste_colonia, prop.colonia);
  p += coloniaCalibrada ? model.ajuste_colonia[prop.colonia] : 0;

  if (model.usa_distancia && model.coeficiente_distancia_opcional) {
    p += model.coeficiente_distancia_opcional * (prop.dist_centro || 0);
  }

  return { precio: Math.max(p, 0), coloniaCalibrada };
}

// Aporte de cada componente al precio (para desglose tipo waterfall).
export function contributions(prop: PropertyFeatures, model: HedonicModel): { key: string; value: number }[] {
  const c = model.coeficientes_numericos;
  const out = [
    { key: 'Base (intercepto)', value: c.intercepto },
    ...NUMERIC_FEATURES.map((k) => ({ key: k, value: c[k] * (prop[k] || 0) })),
    { key: `Zona: ${prop.colonia || '—'}`, value: model.ajuste_colonia[prop.colonia] ?? 0 },
  ];
  if (model.usa_distancia && model.coeficiente_distancia_opcional) {
    out.push({ key: 'Distancia centro', value: model.coeficiente_distancia_opcional * (prop.dist_centro || 0) });
  }
  return out;
}

// --- Álgebra lineal mínima (matrices densas pequeñas) -----------------------
function transpose(m: number[][]): number[][] {
  return m[0].map((_, j) => m.map((row) => row[j]));
}
function matMul(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  const k = b[0].length;
  const inner = b.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < k; j++) {
      let s = 0;
      for (let t = 0; t < inner; t++) s += a[i][t] * b[t][j];
      out[i][j] = s;
    }
  return out;
}
function invert(mat: number[][]): number[][] | null {
  const n = mat.length;
  const a = mat.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const pv = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}

// --- Métricas ---------------------------------------------------------------
function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function metricsOn(rows: TrainingRow[], model: HedonicModel): Quality {
  if (!rows.length) return { r2: 0, rmse: 0, mnape: 0, n_observaciones: 0 };
  const real = rows.map((r) => r.precio);
  const est = rows.map((r) => predict(r, model).precio);
  const mean = real.reduce((a, b) => a + b, 0) / real.length;
  let ssRes = 0;
  let ssTot = 0;
  const apes: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    ssRes += (real[i] - est[i]) ** 2;
    ssTot += (real[i] - mean) ** 2;
    if (real[i] !== 0) apes.push(Math.abs(real[i] - est[i]) / Math.abs(real[i]));
  }
  return {
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 0,
    rmse: Math.sqrt(ssRes / rows.length),
    mnape: median(apes),
    n_observaciones: rows.length,
  };
}

function seededShuffle<T>(arr: T[], seed = 12345): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Calibración: OLS con one-hot de colonia --------------------------------
export function calibrate(
  data: TrainingRow[],
  opts: { anioBase?: number; testFraction?: number; usaDistancia?: boolean } = {},
): HedonicModel | { error: string } {
  const clean = data.filter((r) => Number.isFinite(r.precio) && r.precio > 0 && (r.colonia ?? '').toString().trim());
  const usaDistancia = opts.usaDistancia ?? false;

  // Catálogo de colonias ordenado por frecuencia; la más frecuente es referencia.
  const freq = new Map<string, number>();
  clean.forEach((r) => freq.set(r.colonia, (freq.get(r.colonia) ?? 0) + 1));
  const colonias = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  if (colonias.length === 0) return { error: 'No hay columna de colonia con datos.' };
  const reference = colonias[0];
  const dummyColonias = colonias.slice(1); // one-hot omitiendo la referencia

  const nCols = 1 + NUMERIC_FEATURES.length + (usaDistancia ? 1 : 0) + dummyColonias.length;
  if (clean.length < nCols + 2) {
    return { error: `Se necesitan al menos ${nCols + 2} transacciones para ${colonias.length} colonias; hay ${clean.length}. Agrupa colonias o aporta más datos.` };
  }

  const shuffled = seededShuffle(clean);
  const nTest = Math.max(1, Math.floor(shuffled.length * (opts.testFraction ?? 0.2)));
  const test = shuffled.slice(0, nTest);
  const train = shuffled.slice(nTest);

  const buildRow = (r: TrainingRow) => [
    1,
    ...NUMERIC_FEATURES.map((f) => r[f] || 0),
    ...(usaDistancia ? [r.dist_centro || 0] : []),
    ...dummyColonias.map((col) => (r.colonia === col ? 1 : 0)),
  ];

  const X = train.map(buildRow);
  const y = train.map((r) => [r.precio]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  for (let i = 1; i < XtX.length; i++) XtX[i][i] += 1e-6; // ridge mínimo (estabilidad)
  const inv = invert(XtX);
  if (!inv) return { error: 'Matriz singular (colonias colineales o sin variación). Agrupa zonas o aporta más datos.' };
  const beta = matMul(matMul(inv, Xt), y).map((row) => row[0]);

  let idx = 0;
  const coeficientes_numericos: NumericCoefficients = {
    intercepto: beta[idx++],
    area: beta[idx++],
    edad: beta[idx++],
    pisos: beta[idx++],
    banos: beta[idx++],
    lote: beta[idx++],
    anio: beta[idx++],
  };
  const coeficiente_distancia_opcional = usaDistancia ? beta[idx++] : null;
  const ajuste_colonia: Record<string, number> = { [reference]: 0 };
  dummyColonias.forEach((col, i) => (ajuste_colonia[col] = beta[idx + i]));

  const rangos = {} as Record<NumericFeature, { min: number; max: number }>;
  for (const f of NUMERIC_FEATURES) {
    const vals = clean.map((r) => r[f] || 0);
    rangos[f] = { min: Math.min(...vals), max: Math.max(...vals) };
  }

  const model: HedonicModel = {
    modelo: 'hedonico_lineal_ols',
    version: `cal-${new Date().toISOString().slice(0, 10)}`,
    moneda: 'MXN',
    anio_base: opts.anioBase ?? new Date().getFullYear(),
    usa_distancia: usaDistancia,
    colonia_referencia: reference,
    coeficientes_numericos,
    ajuste_colonia,
    coeficiente_distancia_opcional,
    calidad: { r2: 0, rmse: 0, mnape: 0, n_observaciones: 0 },
    calibrado_en: new Date().toISOString(),
    rangos,
  };
  model.calidad = metricsOn(test, model);
  return model;
}
