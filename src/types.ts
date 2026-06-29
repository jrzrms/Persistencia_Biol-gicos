export type Patologia =
  | 'Artritis Reumatoide'
  | 'Psoriasis'
  | 'Colitis Ulcerosa'
  | 'Enfermedad de Crohn';

export type Farmaco =
  | 'Adalimumab'
  | 'Infliximab'
  | 'Etanercept'
  | 'Ustekinumab'
  | 'Vedolizumab'
  | 'Guselkumab'
  | 'Risankizumab'
  | 'Tildrakizumab'
  | 'Secukinumab'
  | 'Upadacitinib';

export interface Paciente {
  paciente_id: string;
  patologia: Patologia;
  farmaco: Farmaco;
  fecha_inicio: string; // YYYY-MM-DD
  duracion_dias: number;
  evento_interrupcion: number; // 1 = abandonó, 0 = censurado/sigue activo
  perfil_paciente: 'Naive' | 'No Naive';
}

export type Granularidad = 'Mensual' | 'Trimestral' | 'Anual';

export type Poblacion = 'Todos' | 'Solo Naive' | 'Solo No Naive';

export interface Filtros {
  patologia: Patologia;
  farmacos: Farmaco[];
  fechaInicioMin: string;
  fechaInicioMax: string;
  poblacion: Poblacion;
  granularidad: Granularidad;
}

export interface KMPoint {
  time: number;       // En la unidad seleccionada (meses, trimestres, años)
  survival: number;   // Entre 0 y 1 (multiplicado por 100 para el porcentaje)
  atRisk: number;     // Pacientes en riesgo al inicio del intervalo
  events: number;     // Eventos de interrupción en el intervalo
  censored: number;   // Eventos de censura en el intervalo
}

export interface KMCurve {
  farmaco: Farmaco;
  points: KMPoint[];
  totalPatients: number;
  eventsCount: number;
  censoredCount: number;
  medianSurvival: number | null; // Median duration of persistence
}
