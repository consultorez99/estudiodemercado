// Motor de pro-forma de proyecto inmobiliario: convierte los supuestos del
// simulador en un flujo de caja mensual y deriva TIR, equity pico, meses de
// venta y el "cheque máximo por terreno" DESCONTADO a la tasa objetivo
// (a diferencia del residual ingenuo, este sí castiga el valor del dinero
// en el tiempo y los costos blandos/comercialización/contingencia).

export interface ProformaInputs {
  units: number;
  areaPerUnit: number; // m² vendibles por unidad
  pricePerUnit: number; // precio de venta por unidad (MXN)
  constructionCostPerSqm: number; // costo directo de obra $/m²
  softCostPct: number; // indirectos como % del costo directo
  contingencyPct: number; // contingencia como % del costo directo
  marketingPct: number; // comercialización como % del GDV
  constructionMonths: number; // duración de obra
  salesStartMonth: number; // mes en que arrancan las ventas (0 = preventa desde inicio)
  absorptionPerMonth: number; // unidades vendidas por mes
  annualDiscountRate: number; // TIR objetivo / tasa de descuento (decimal, p. ej. 0.18)
  landCost?: number; // costo de terreno; si se da, calcula la TIR del proyecto
}

export interface MonthlyFlow {
  month: number;
  outflow: number;
  inflow: number;
  net: number;
  cumulative: number;
}

export interface ProformaResult {
  gdv: number;
  directConstruction: number;
  softCosts: number;
  contingency: number;
  marketing: number;
  totalCost: number; // todos los costos excepto terreno
  monthsToSellOut: number;
  horizonMonths: number;
  maxLandAtTargetIRR: number; // VPN de los flujos operativos a la tasa objetivo
  peakEquity: number; // máximo capital expuesto (flujo acumulado más negativo)
  monthlyFlows: MonthlyFlow[];
  projectIRR: number | null; // anualizada, si se proporcionó landCost
  profit: number;
  marginOnGdv: number;
}

// Curva S de obra: pesos tipo campana (mayor gasto a la mitad), normalizados a 1.
function sCurveWeights(months: number): number[] {
  if (months <= 0) return [];
  if (months === 1) return [1];
  const raw: number[] = [];
  for (let i = 0; i < months; i++) {
    const x = (i + 0.5) / months; // centro de cada mes en [0,1]
    raw.push(x * (1 - x)); // beta(2,2) ∝ x(1-x): arranca lento, pico al centro, baja
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

// Valor presente neto de una serie de flujos mensuales a una tasa ANUAL.
export function npv(monthlyFlows: number[], annualRate: number): number {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  return monthlyFlows.reduce((acc, f, t) => acc + f / Math.pow(1 + r, t), 0);
}

// TIR anualizada por bisección. Devuelve null si no hay cambio de signo.
export function irr(monthlyFlows: number[]): number | null {
  const f = (rMonthly: number) =>
    monthlyFlows.reduce((acc, flow, t) => acc + flow / Math.pow(1 + rMonthly, t), 0);

  let lo = -0.9999;
  let hi = 10; // 1000% mensual como techo
  const fLo = f(lo);
  const fHi = f(hi);
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return null;

  let mid = 0;
  for (let i = 0; i < 200; i++) {
    mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < 1e-6) break;
    if (fLo * fMid < 0) hi = mid;
    else lo = mid;
  }
  return Math.pow(1 + mid, 12) - 1; // anualizar
}

export function computeProforma(inp: ProformaInputs): ProformaResult {
  const units = Math.max(0, inp.units);
  const gdv = inp.pricePerUnit * units;
  const directConstruction = inp.constructionCostPerSqm * inp.areaPerUnit * units;
  const softCosts = directConstruction * (inp.softCostPct / 100);
  const contingency = directConstruction * (inp.contingencyPct / 100);
  const marketing = gdv * (inp.marketingPct / 100);
  const totalCost = directConstruction + softCosts + contingency + marketing;

  const absorption = Math.max(0.0001, inp.absorptionPerMonth);
  const monthsToSellOut = Math.max(1, Math.ceil(units / absorption));
  const horizonMonths = Math.max(
    inp.constructionMonths,
    inp.salesStartMonth + monthsToSellOut,
  );

  // Reparte obra (directo + indirecto + contingencia) sobre la curva S.
  const buildBudget = directConstruction + softCosts + contingency;
  const weights = sCurveWeights(Math.max(1, inp.constructionMonths));

  // Construye flujos mensuales operativos (sin terreno).
  const flows: MonthlyFlow[] = [];
  let remainingUnits = units;
  let cumulative = 0;
  for (let m = 0; m <= horizonMonths; m++) {
    let outflow = 0;
    let inflow = 0;

    // Egreso de obra según curva S durante los meses de construcción.
    if (m < inp.constructionMonths) outflow += buildBudget * (weights[m] ?? 0);

    // Ventas: a partir del mes de inicio, a la velocidad de absorción.
    if (m >= inp.salesStartMonth && remainingUnits > 0) {
      const sold = Math.min(absorption, remainingUnits);
      remainingUnits -= sold;
      const revenue = sold * inp.pricePerUnit;
      inflow += revenue;
      // La comercialización se gasta proporcional a las ventas del mes.
      outflow += revenue * (inp.marketingPct / 100);
    }

    const net = inflow - outflow;
    cumulative += net;
    flows.push({ month: m, outflow, inflow, net, cumulative });
  }

  // Cheque máximo por terreno = VPN de los flujos operativos a la tasa objetivo.
  const operatingMonthly = flows.map((f) => f.net);
  const maxLandAtTargetIRR = npv(operatingMonthly, inp.annualDiscountRate);

  // Equity pico: el acumulado más negativo (incluyendo terreno en t0 si se dio).
  const land = inp.landCost ?? maxLandAtTargetIRR;
  let running = -land;
  let peak = running;
  for (const f of flows) {
    running += f.net;
    if (running < peak) peak = running;
  }
  const peakEquity = -Math.min(0, peak);

  // TIR del proyecto si se conoce el costo del terreno.
  let projectIRR: number | null = null;
  if (inp.landCost != null) {
    const full = operatingMonthly.slice();
    full[0] = (full[0] ?? 0) - inp.landCost; // terreno como egreso en t0
    projectIRR = irr(full);
  }

  const profit = gdv - totalCost - land;
  const marginOnGdv = gdv > 0 ? profit / gdv : 0;

  return {
    gdv,
    directConstruction,
    softCosts,
    contingency,
    marketing,
    totalCost,
    monthsToSellOut,
    horizonMonths,
    maxLandAtTargetIRR,
    peakEquity,
    monthlyFlows: flows,
    projectIRR,
    profit,
    marginOnGdv,
  };
}
