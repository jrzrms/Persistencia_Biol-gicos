import React from 'react';
import { KMCurve, Granularidad } from '../types';
import { DRUG_COLORS } from './KaplanMeierChart';

interface SummaryTableProps {
  curves: KMCurve[];
  granularidad: Granularidad;
}

export const SummaryTable: React.FC<SummaryTableProps> = ({ curves, granularidad }) => {
  // Helper to find survival at a specific time
  const getSurvivalAt = (curve: KMCurve, targetTime: number): number => {
    let survival = 1.0;
    for (const pt of curve.points) {
      if (pt.time <= targetTime) {
        survival = pt.survival;
      } else {
        break;
      }
    }
    return survival;
  };

  // Set standard times for 1, 2, and 3-year survival benchmarks based on granularity
  let t1 = 12; // 12 months
  let t2 = 24; // 24 months
  let t3 = 36; // 36 months
  let t1Label = '1 Año (12 meses)';
  let t2Label = '2 Años (24 meses)';
  let t3Label = '3 Años (36 meses)';

  if (granularidad === 'Trimestral') {
    t1 = 4; // 4 quarters
    t2 = 8; // 8 quarters
    t3 = 12; // 12 quarters
    t1Label = '1 Año (4 trim.)';
    t2Label = '2 Años (8 trim.)';
    t3Label = '3 Años (12 trim.)';
  } else if (granularidad === 'Anual') {
    t1 = 1;
    t2 = 2;
    t3 = 3;
    t1Label = '1 Año';
    t2Label = '2 Años';
    t3Label = '3 Años';
  }

  const granWord = granularidad === 'Mensual' ? 'meses' : granularidad === 'Trimestral' ? 'trimestres' : 'años';

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
      <h3 className="text-slate-800 font-semibold text-lg mb-1">Tabla Resumen de Persistencia</h3>
      <p className="text-slate-400 text-xs font-medium mb-4">
        Estadísticas principales extraídas del análisis actuarial de Kaplan-Meier.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
              <th className="py-3 px-4 rounded-l-lg">Fármaco</th>
              <th className="py-3 px-3 text-center">N Total</th>
              <th className="py-3 px-3 text-center">Interrupciones (E)</th>
              <th className="py-3 px-3 text-center">Censurados (C)</th>
              <th className="py-3 px-3 text-center">Mediana Persistencia</th>
              <th className="py-3 px-3 text-center text-emerald-700 bg-emerald-50/50">{t1Label}</th>
              <th className="py-3 px-3 text-center text-indigo-700 bg-indigo-50/50">{t2Label}</th>
              <th className="py-3 px-3 text-center text-purple-700 bg-purple-50/50 rounded-r-lg">{t3Label}</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-100">
            {curves.map((curve) => {
              const color = DRUG_COLORS[curve.farmaco] || '#64748b';
              const eventPct = ((curve.eventsCount / curve.totalPatients) * 100).toFixed(1);
              const censoredPct = ((curve.censoredCount / curve.totalPatients) * 100).toFixed(1);
              
              const s1 = getSurvivalAt(curve, t1);
              const s2 = getSurvivalAt(curve, t2);
              const s3 = getSurvivalAt(curve, t3);

              return (
                <tr key={curve.farmaco} className="hover:bg-slate-50/60 transition-colors">
                  {/* Farmaco Name & Color Indicator */}
                  <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {curve.farmaco}
                  </td>

                  {/* N Total */}
                  <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                    {curve.totalPatients}
                  </td>

                  {/* Interrupciones */}
                  <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                    <span>{curve.eventsCount}</span>
                    <span className="text-[10px] text-rose-500 font-semibold bg-rose-50 px-1 py-0.5 rounded ml-1.5">
                      {eventPct}%
                    </span>
                  </td>

                  {/* Censurados */}
                  <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                    <span>{curve.censoredCount}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1 py-0.5 rounded ml-1.5">
                      {censoredPct}%
                    </span>
                  </td>

                  {/* Median Persistence */}
                  <td className="py-3.5 px-3 text-center font-semibold text-slate-800 font-mono">
                    {curve.medianSurvival !== null ? (
                      <span className="text-slate-800">
                        {curve.medianSurvival} <span className="text-[10px] font-normal text-slate-500">{granWord}</span>
                      </span>
                    ) : (
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-semibold">
                        No alcanzada
                      </span>
                    )}
                  </td>

                  {/* Survival at 1 Year */}
                  <td className="py-3.5 px-3 text-center font-bold text-emerald-600 font-mono bg-emerald-50/10">
                    {(s1 * 100).toFixed(1)}%
                  </td>

                  {/* Survival at 2 Years */}
                  <td className="py-3.5 px-3 text-center font-bold text-indigo-600 font-mono bg-indigo-50/10">
                    {(s2 * 100).toFixed(1)}%
                  </td>

                  {/* Survival at 3 Years */}
                  <td className="py-3.5 px-3 text-center font-bold text-purple-600 font-mono bg-purple-50/10">
                    {(s3 * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
