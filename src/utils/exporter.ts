import { Paciente, KMCurve } from '../types';

/**
 * Encodes string array into a standard Excel-compatible CSV string (with UTF-8 BOM)
 */
function downloadCSV(csvContent: string, fileName: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports the filtered patient cohort as a CSV file
 */
export function exportCohortToCSV(pacientes: Paciente[], patologiaName: string) {
  const headers = [
    'ID Paciente',
    'Patología',
    'Fármaco',
    'Fecha de Inicio',
    'Perfil Paciente',
    'Duración (Días)',
    'Evento Interrupción (1=Abandonó, 0=Censurado)',
  ];

  const rows = pacientes.map((p) => [
    p.paciente_id,
    p.patologia,
    p.farmaco,
    p.fecha_inicio,
    p.perfil_paciente,
    p.duracion_dias,
    p.evento_interrupcion,
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map((r) => r.map((val) => `"${val}"`).join(';')),
  ].join('\n');

  const cleanName = patologiaName.toLowerCase().replace(/\s+/g, '_');
  downloadCSV(csvContent, `cohorte_pacientes_${cleanName}_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Exports the calculated Kaplan-Meier curves as coordinates
 */
export function exportCurvesToCSV(curves: KMCurve[], patologiaName: string) {
  const headers = [
    'Fármaco',
    'Tiempo de Evaluación',
    'Supervivencia Acumulada (%)',
    'Pacientes en Riesgo',
    'Eventos en Intervalo',
    'Censurados en Intervalo',
  ];

  const rows: any[] = [];
  curves.forEach((c) => {
    c.points.forEach((pt) => {
      rows.push([
        c.farmaco,
        pt.time,
        (pt.survival * 100).toFixed(2),
        pt.atRisk,
        pt.events,
        pt.censored,
      ]);
    });
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map((r) => r.map((val) => `"${val}"`).join(';')),
  ].join('\n');

  const cleanName = patologiaName.toLowerCase().replace(/\s+/g, '_');
  downloadCSV(csvContent, `curvas_kaplan_meier_${cleanName}_${new Date().toISOString().split('T')[0]}.csv`);
}
