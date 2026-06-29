import React from 'react';
import { KMCurve, Patologia, Paciente, Granularidad } from '../types';
import { BookOpen, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';

interface ClinicalInsightsProps {
  curves: KMCurve[];
  patologia: Patologia;
  filteredPatients: Paciente[];
  granularidad: Granularidad;
}

export const ClinicalInsights: React.FC<ClinicalInsightsProps> = ({
  curves,
  patologia,
  filteredPatients,
  granularidad,
}) => {
  if (curves.length === 0) return null;

  const granWord = granularidad === 'Mensual' ? 'meses' : granularidad === 'Trimestral' ? 'trimestres' : 'años';

  // 1. Find the drug with the best 2-year persistence (24 months, 8 quarters, or 2 years)
  let t2 = 24;
  if (granularidad === 'Trimestral') t2 = 8;
  if (granularidad === 'Anual') t2 = 2;

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

  let bestDrug: string = '';
  let bestSurvivalRate = -1;

  curves.forEach((c) => {
    const s2 = getSurvivalAt(c, t2);
    if (s2 > bestSurvivalRate) {
      bestSurvivalRate = s2;
      bestDrug = c.farmaco;
    }
  });

  const bestSurvivalPct = (bestSurvivalRate * 100).toFixed(1);

  // 2. Compute naive vs non-naive median survival of the CURRENT pathology in the total dataset
  const naivePatients = filteredPatients.filter((p) => p.perfil_paciente === 'Naive');
  const nonNaivePatients = filteredPatients.filter((p) => p.perfil_paciente === 'No Naive');

  const getAdherenceRate = (cohort: Paciente[]) => {
    if (cohort.length === 0) return 0;
    const active = cohort.filter((p) => p.evento_interrupcion === 0).length;
    return (active / cohort.length) * 100;
  };

  const getAvgDuration = (cohort: Paciente[]) => {
    if (cohort.length === 0) return 0;
    const sum = cohort.reduce((acc, p) => acc + p.duracion_dias, 0);
    return Math.round(sum / cohort.length);
  };

  const naiveAdherence = getAdherenceRate(naivePatients);
  const nonNaiveAdherence = getAdherenceRate(nonNaivePatients);

  const naiveAvgDays = getAvgDuration(naivePatients);
  const nonNaiveAvgDays = getAvgDuration(nonNaivePatients);

  // Specific clinical guidelines background based on pathology
  const getPathologyContext = () => {
    switch (patologia) {
      case 'Artritis Reumatoide':
        return 'En Artritis Reumatoide, la persistencia terapéutica se asocia estrechamente con la eficacia de control del DAS28 y la tolerabilidad. Fármacos orales modernos como Upadacitinib (JAKi) muestran una persistencia muy competitiva frente a los anti-TNF clásicos (Adalimumab, Infliximab), impulsada en parte por la conveniencia de la vía oral y la menor inmunogenicidad comparada.';
      case 'Psoriasis':
        return 'En Psoriasis, los inhibidores modernos de la IL-23 (Risankizumab, Guselkumab) y de la IL-17 (Secukinumab) demuestran tasas de supervivencia del tratamiento excepcionales, con medianas frecuentemente no alcanzadas a los 3 años. Esto se correlaciona con su alta tasa de respuesta PASI90/PASI100 sostenida y sus perfiles de seguridad favorables con bajo riesgo de discontinuación por eventos adversos.';
      case 'Colitis Ulcerosa':
        return 'En Colitis Ulcerosa, la persistencia es un indicador indirecto clave de cicatrización mucosa estable. Terapias selectivas de integrinas como Vedolizumab demuestran tasas de retención muy elevadas debido a su perfil de seguridad intestinal altamente selectivo y menor tasa de infecciones sistémicas graves comparado con agentes anti-TNF sistémicos.';
      case 'Enfermedad de Crohn':
        return 'En Enfermedad de Crohn, los anticuerpos monoclonales dirigidos contra la IL-12/23 (Ustekinumab) y el receptor de integrinas (Vedolizumab) muestran perfiles de persistencia superiores a largo plazo debido a su baja tasa de inmunogenicidad y pérdida secundaria de respuesta, un desafío persistente con terapias anti-TNF clásicas como Infliximab.';
      default:
        return '';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Dynamic Insights Card */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
        <h4 className="text-slate-800 font-bold text-base flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          Hallazgos Analíticos Dinámicos
        </h4>

        <div className="space-y-4">
          {/* Finding 1: Best Drug */}
          {bestDrug && (
            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                Líder en Adherencia
              </span>
              <p className="text-sm text-slate-700 mt-2">
                A los 2 años de seguimiento, <strong className="text-slate-900 font-semibold">{bestDrug}</strong> presenta la tasa de persistencia más alta en esta cohorte con un <strong className="text-emerald-600 text-base font-bold font-mono">{bestSurvivalPct}%</strong> de pacientes activos en tratamiento.
              </p>
            </div>
          )}

          {/* Finding 2: Naive vs Pre-treated */}
          {naivePatients.length > 0 && nonNaivePatients.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                Efecto de la Línea de Tratamiento
              </span>
              <p className="text-sm text-slate-700 mt-2">
                La cohorte de pacientes <strong className="text-indigo-900">Naive</strong> (sin biológicos previos) presenta una media de duración clínica de{' '}
                <strong className="text-indigo-900 font-mono">
                  {Math.round(naiveAvgDays / (granularidad === 'Mensual' ? 30.4 : granularidad === 'Trimestral' ? 91.2 : 365) * 10) / 10}
                </strong>{' '}
                {granWord} en comparación con los{' '}
                <strong className="text-indigo-900 font-mono">
                  {Math.round(nonNaiveAvgDays / (granularidad === 'Mensual' ? 30.4 : granularidad === 'Trimestral' ? 91.2 : 365) * 10) / 10}
                </strong>{' '}
                {granWord} de la cohorte <strong className="text-indigo-900">No Naive</strong>.
              </p>
              <p className="text-xs text-slate-400 mt-2.5 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Esto representa una retención clínica superior del{' '}
                <strong className="text-indigo-600">
                  {Math.abs(naiveAdherence - nonNaiveAdherence).toFixed(1)}%
                </strong>{' '}
                en la línea inicial.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Reference Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h4 className="text-slate-800 font-bold text-base flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Contexto Clínico Farmacológico
          </h4>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
            Patología seleccionada: {patologia}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed text-justify">
            {getPathologyContext()}
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2.5">
          <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg p-2 text-white shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Nota de Farmacovigilancia y Gestión</p>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
              La persistencia es la variable sustituta más sólida de coste-efectividad e impacto presupuestario real en la dispensación farmacéutica ambulatoria.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
