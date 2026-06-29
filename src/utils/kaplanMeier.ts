import { Paciente, KMPoint, KMCurve, Farmaco, Granularidad } from '../types';

/**
 * Calculates the Kaplan-Meier survival curves for each selected drug
 */
export function calculateKaplanMeier(
  pacientes: Paciente[],
  granularidad: Granularidad
): KMCurve[] {
  // Group patients by selected drug
  const patientsByDrug: Record<Farmaco, Paciente[]> = {} as Record<Farmaco, Paciente[]>;

  pacientes.forEach((p) => {
    if (!patientsByDrug[p.farmaco]) {
      patientsByDrug[p.farmaco] = [];
    }
    patientsByDrug[p.farmaco].push(p);
  });

  const curves: KMCurve[] = [];

  // Temporal scaling factor:
  // Month: 30 days, Quarter: 90 days, Year: 365 days
  let divisor = 30;
  if (granularidad === 'Trimestral') divisor = 90;
  if (granularidad === 'Anual') divisor = 365;

  Object.entries(patientsByDrug).forEach(([drugStr, drugPatients]) => {
    const farmaco = drugStr as Farmaco;
    const totalPatients = drugPatients.length;

    if (totalPatients === 0) return;

    // Granularize duration and map events
    const processedPatients = drugPatients.map((p) => {
      // Round to 1 decimal place to group close event times and create clean steps
      const rawTime = p.duracion_dias / divisor;
      const binnedTime = Math.round(rawTime * 10) / 10;
      return {
        time: binnedTime,
        event: p.evento_interrupcion,
      };
    });

    // Count overall events/censored for the summary
    const eventsCount = drugPatients.filter((p) => p.evento_interrupcion === 1).length;
    const censoredCount = drugPatients.filter((p) => p.evento_interrupcion === 0).length;

    // Sort unique times
    const uniqueTimes = Array.from(new Set(processedPatients.map((p) => p.time))).sort(
      (a, b) => a - b
    );

    const points: KMPoint[] = [];

    // Add initial point at t=0, Survival = 100%
    points.push({
      time: 0,
      survival: 1.0,
      atRisk: totalPatients,
      events: 0,
      censored: 0,
    });

    let currentSurvival = 1.0;
    let remainingAtRisk = totalPatients;

    // Group patient events by time
    const timeGroups: Record<number, { events: number; censored: number }> = {};
    processedPatients.forEach((p) => {
      if (!timeGroups[p.time]) {
        timeGroups[p.time] = { events: 0, censored: 0 };
      }
      if (p.event === 1) {
        timeGroups[p.time].events += 1;
      } else {
        timeGroups[p.time].censored += 1;
      }
    });

    for (const t of uniqueTimes) {
      if (t <= 0) continue; // Skip non-positive times

      const { events, censored } = timeGroups[t];
      const atRisk = remainingAtRisk;

      if (atRisk <= 0) break;

      // Kaplan-Meier formula step: S(t) = S(t-1) * (1 - d_i / n_i)
      const hazard = events / atRisk;
      currentSurvival = currentSurvival * (1 - hazard);

      points.push({
        time: t,
        survival: Math.max(0, currentSurvival),
        atRisk,
        events,
        censored,
      });

      // Update remaining patients for next intervals
      remainingAtRisk -= events + censored;
    }

    // Find Median Survival: first time where survival drops below 0.50
    let medianSurvival: number | null = null;
    
    // We can interpolate or find the exact point
    for (let i = 0; i < points.length; i++) {
      if (points[i].survival <= 0.5) {
        // Linear interpolation for a smoother median estimation
        const pPrev = points[i - 1];
        const pCurr = points[i];
        if (pPrev && pPrev.survival > 0.5 && pCurr.survival !== pPrev.survival) {
          const ratio = (pPrev.survival - 0.5) / (pPrev.survival - pCurr.survival);
          medianSurvival = pPrev.time + ratio * (pCurr.time - pPrev.time);
        } else {
          medianSurvival = pCurr.time;
        }
        break;
      }
    }

    curves.push({
      farmaco,
      points,
      totalPatients,
      eventsCount,
      censoredCount,
      medianSurvival: medianSurvival !== null ? Math.round(medianSurvival * 10) / 10 : null,
    });
  });

  return curves;
}
