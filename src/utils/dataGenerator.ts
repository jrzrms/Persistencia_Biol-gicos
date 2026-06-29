import { Paciente, Patologia, Farmaco } from '../types';

// Approved drugs per pathology in real clinical guidelines
export const PATHOLOGY_DRUGS: Record<Patologia, Farmaco[]> = {
  'Artritis Reumatoide': [
    'Adalimumab',
    'Infliximab',
    'Etanercept',
    'Upadacitinib',
    'Secukinumab',
  ],
  Psoriasis: [
    'Adalimumab',
    'Etanercept',
    'Ustekinumab',
    'Guselkumab',
    'Risankizumab',
    'Tildrakizumab',
    'Secukinumab',
  ],
  'Colitis Ulcerosa': [
    'Infliximab',
    'Adalimumab',
    'Vedolizumab',
    'Upadacitinib',
    'Ustekinumab',
  ],
  'Enfermedad de Crohn': [
    'Infliximab',
    'Adalimumab',
    'Ustekinumab',
    'Vedolizumab',
    'Upadacitinib',
    'Risankizumab',
  ],
};

// All available biologics
export const ALL_FARMACOS: Farmaco[] = [
  'Adalimumab',
  'Infliximab',
  'Etanercept',
  'Ustekinumab',
  'Vedolizumab',
  'Guselkumab',
  'Risankizumab',
  'Tildrakizumab',
  'Secukinumab',
  'Upadacitinib',
];

// Clinical persistence profiles (approximate median survival in days under standard conditions)
// Higher values mean the drug has a lower hazard rate (better persistence).
const DRUG_MEDIAN_DAYS: Record<Farmaco, number> = {
  Risankizumab: 1600,
  Guselkumab: 1500,
  Vedolizumab: 1350,
  Ustekinumab: 1300,
  Tildrakizumab: 1200,
  Secukinumab: 1100,
  Upadacitinib: 1050,
  Adalimumab: 900,
  Infliximab: 800,
  Etanercept: 700,
};

// Seedable pseudo-random number generator to ensure consistent data across sessions while maintaining dynamic range
function createRandom(seedStr: string) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function generateSyntheticData(count = 5000): Paciente[] {
  const random = createRandom("dashboard-persistencia-biologicos-seed-v1");
  const pacientes: Paciente[] = [];
  
  const patologias: Patologia[] = [
    'Artritis Reumatoide',
    'Psoriasis',
    'Colitis Ulcerosa',
    'Enfermedad de Crohn',
  ];

  // Study cut-off date (current local time is late June 2026)
  const STUDY_END_DATE = new Date('2026-06-29');

  for (let i = 1; i <= count; i++) {
    const paciente_id = `PAC-${String(i).padStart(5, '0')}`;
    
    // 1. Select Pathology (weighted slightly towards RA and Psoriasis)
    const patRand = random();
    let patologia: Patologia;
    if (patRand < 0.35) patologia = 'Artritis Reumatoide';
    else if (patRand < 0.65) patologia = 'Psoriasis';
    else if (patRand < 0.82) patologia = 'Colitis Ulcerosa';
    else patologia = 'Enfermedad de Crohn';

    // 2. Select Farmaco approved for this pathology
    const allowedDrugs = PATHOLOGY_DRUGS[patologia];
    const farmaco = allowedDrugs[Math.floor(random() * allowedDrugs.length)];

    // 3. Select Start Date (fecha_inicio) between 2019-01-01 and 2024-12-31
    const startYear = 2019 + Math.floor(random() * 6); // 2019 to 2024
    const startMonth = 1 + Math.floor(random() * 12);
    const startDay = 1 + Math.floor(random() * 28);
    const fechaInicioStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const fechaInicio = new Date(fechaInicioStr);

    // 4. Determine Patient Profile (Naive vs. No Naive)
    // Naive are first-time biologic users. Let's make it 60% Naive.
    const perfil_paciente = random() < 0.60 ? 'Naive' : 'No Naive';

    // 5. Simulate Survival Duration (duracion_dias) using an Exponential distribution simulation
    // S(t) = exp(-λ * t) => t = -ln(U) / λ where U is Uniform(0,1)
    // Median t_med = ln(2) / λ => λ = ln(2) / t_med
    const medianDays = DRUG_MEDIAN_DAYS[farmaco];
    
    // Adjust hazard rate (λ) based on clinical factors:
    // Naive patients have better persistence (hazard ratio 0.70 => longer survival)
    // Non-Naive have worse persistence (hazard ratio 1.30 => shorter survival)
    const hazardRatio = perfil_paciente === 'Naive' ? 0.75 : 1.30;
    const adjustedMedian = medianDays / hazardRatio;
    const lambda = Math.log(2) / adjustedMedian;
    
    // Simulate raw event time
    const u = Math.max(0.0001, random()); // Prevent ln(0)
    const rawDurationDays = Math.round(-Math.log(u) / lambda);

    // 6. Calculate Maximum Possible Follow-up Days (from fecha_inicio to STUDY_END_DATE)
    const maxFollowUpDays = Math.floor(
      (STUDY_END_DATE.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 7. Apply Right-Censoring
    // If the simulated discontinuation time is longer than the follow-up,
    // the patient is censored at the end of the follow-up.
    let duracion_dias = rawDurationDays;
    let evento_interrupcion = 1; // Default to interrupted/discontinued

    if (rawDurationDays >= maxFollowUpDays) {
      duracion_dias = maxFollowUpDays;
      evento_interrupcion = 0; // Censored! (Patient is still on treatment at study end)
    }

    // Add a minimum duration of 15 days to represent early follow-up
    if (duracion_dias < 15) {
      duracion_dias = 15;
    }

    pacientes.push({
      paciente_id,
      patologia,
      farmaco,
      fecha_inicio: fechaInicioStr,
      duracion_dias,
      evento_interrupcion,
      perfil_paciente,
    });
  }

  return pacientes;
}
