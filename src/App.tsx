import { useState, useMemo, useEffect } from 'react';
import {
  Patologia,
  Farmaco,
  Poblacion,
  Granularidad,
  Paciente,
  KMCurve,
} from './types';
import {
  generateSyntheticData,
  PATHOLOGY_DRUGS,
  ALL_FARMACOS,
} from './utils/dataGenerator';
import { calculateKaplanMeier } from './utils/kaplanMeier';
import { KaplanMeierChart } from './components/KaplanMeierChart';
import { SummaryTable } from './components/SummaryTable';
import { ClinicalInsights } from './components/ClinicalInsights';
import { exportCohortToCSV, exportCurvesToCSV } from './utils/exporter';
import {
  Activity,
  Calendar,
  Users,
  TrendingUp,
  SlidersHorizontal,
  Download,
  Printer,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Filter,
  Clock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Database,
  BarChart4,
} from 'lucide-react';

export default function App() {
  // 1. Generate full synthetic dataset (5000 patients) once and memoize it
  const fullDataset = useMemo(() => generateSyntheticData(5000), []);

  // 2. State variables for filters
  const [selectedPatologia, setSelectedPatologia] = useState<Patologia>('Artritis Reumatoide');
  const [selectedFarmacos, setSelectedFarmacos] = useState<Farmaco[]>([]);
  const [fechaInicioMin, setFechaInicioMin] = useState<string>('2019-01-01');
  const [fechaInicioMax, setFechaInicioMax] = useState<string>('2024-12-31');
  const [selectedPoblacion, setSelectedPoblacion] = useState<Poblacion>('Todos');
  const [selectedGranularidad, setSelectedGranularidad] = useState<Granularidad>('Mensual');

  // Interactive controls for chart rendering
  const [showCensoredTicks, setShowCensoredTicks] = useState<boolean>(true);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'grafico' | 'datos'>('grafico');

  // Search & Pagination state for raw data explorer
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 12;

  // Whenever patologia changes, automatically select all approved drugs for that patologia
  useEffect(() => {
    setSelectedFarmacos(PATHOLOGY_DRUGS[selectedPatologia]);
    setCurrentPage(1); // Reset page on filter change
  }, [selectedPatologia]);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [fechaInicioMin, fechaInicioMax, selectedPoblacion, selectedGranularidad, searchQuery]);

  // 3. Dynamically filter patient cohort based on selected parameters
  const filteredPatients = useMemo(() => {
    return fullDataset.filter((p) => {
      // Filter Pathology
      if (p.patologia !== selectedPatologia) return false;

      // Filter Selected Drugs
      if (!selectedFarmacos.includes(p.farmaco)) return false;

      // Filter Date Range
      if (p.fecha_inicio < fechaInicioMin || p.fecha_inicio > fechaInicioMax) return false;

      // Filter Population Profile (Naive vs No Naive)
      if (selectedPoblacion === 'Solo Naive' && p.perfil_paciente !== 'Naive') return false;
      if (selectedPoblacion === 'Solo No Naive' && p.perfil_paciente !== 'No Naive') return false;

      return true;
    });
  }, [fullDataset, selectedPatologia, selectedFarmacos, fechaInicioMin, fechaInicioMax, selectedPoblacion]);

  // 4. Calculate Kaplan-Meier curves for the filtered cohort
  const kmCurves = useMemo(() => {
    return calculateKaplanMeier(filteredPatients, selectedGranularidad);
  }, [filteredPatients, selectedGranularidad]);

  // 5. Statistics for KPI metric cards
  const kpis = useMemo(() => {
    const total = filteredPatients.length;
    if (total === 0) {
      return {
        totalPatients: 0,
        interruptionRate: '0.0%',
        censoredRate: '0.0%',
        bestDrug: 'N/A',
      };
    }

    const interruptions = filteredPatients.filter((p) => p.evento_interrupcion === 1).length;
    const censored = total - interruptions;

    // Find drug with longest median survival
    let bestDrug = 'No definido';
    let maxMedian = -1;
    let anyUnreached = false;

    kmCurves.forEach((c) => {
      if (c.medianSurvival === null) {
        anyUnreached = true;
        bestDrug = `${c.farmaco} (No alcanzado)`;
      } else if (!anyUnreached && c.medianSurvival > maxMedian) {
        maxMedian = c.medianSurvival;
        bestDrug = c.farmaco;
      }
    });

    return {
      totalPatients: total,
      interruptionRate: `${((interruptions / total) * 100).toFixed(1)}%`,
      censoredRate: `${((censored / total) * 100).toFixed(1)}%`,
      bestDrug,
    };
  }, [filteredPatients, kmCurves]);

  // Toggle selected biologic drug in the multi-select filter
  const handleToggleDrug = (drug: Farmaco) => {
    if (selectedFarmacos.includes(drug)) {
      setSelectedFarmacos(selectedFarmacos.filter((d) => d !== drug));
    } else {
      setSelectedFarmacos([...selectedFarmacos, drug]);
    }
  };

  const handleSelectAllDrugs = () => {
    setSelectedFarmacos(PATHOLOGY_DRUGS[selectedPatologia]);
  };

  const handleDeselectAllDrugs = () => {
    setSelectedFarmacos([]);
  };

  // Filter and Paginate the raw patients list for the 'Datos' tab
  const paginatedPatients = useMemo(() => {
    const sorted = [...filteredPatients].sort((a, b) => b.duracion_dias - a.duracion_dias);
    
    const searched = sorted.filter((p) => {
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase();
      return (
        p.paciente_id.toLowerCase().includes(term) ||
        p.farmaco.toLowerCase().includes(term) ||
        p.perfil_paciente.toLowerCase().includes(term) ||
        p.fecha_inicio.includes(term)
      );
    });

    const startIndex = (currentPage - 1) * itemsPerPage;
    return {
      items: searched.slice(startIndex, startIndex + itemsPerPage),
      total: searched.length,
    };
  }, [filteredPatients, searchQuery, currentPage]);

  const totalPages = Math.ceil(paginatedPatients.total / itemsPerPage);

  // Trigger browser print to export a beautifully styled clinical report as PDF
  const handleExportPDF = () => {
    window.print();
  };

  // Regeneration of synthetic data to mock database refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefreshData = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Header Banner */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-6 py-4 shadow-sm/50 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-xl p-2.5 text-white shadow-md shadow-emerald-500/10">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-800 font-display">
                  Dashboard Persistencia Biológicos Ambulatoria
                </h1>
                <span className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-100">
                  v2.1
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Herramienta bioestadística y clínica de Farmacia Hospitalaria · Análisis Kaplan-Meier
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefreshData}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100/80 rounded-xl transition text-sm font-medium border border-slate-200"
              title="Refrescar base de datos sintética"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Sincronizando...' : 'Refrescar Datos'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-700 shadow-sm transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Print-Only Header: renders beautifully inside saved PDFs */}
      <div className="hidden print:block p-8 border-b border-slate-300">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">
              Informe Técnico de Persistencia de Tratamientos Biológicos
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Servicio de Farmacia Hospitalaria y Gestión Farmacéutica Ambulatoria
            </p>
            <div className="mt-4 space-y-1 text-xs text-slate-600 font-mono">
              <p>• Patología Analizada: {selectedPatologia}</p>
              <p>• Subpoblación: {selectedPoblacion === 'Todos' ? 'Cohorte Completa (Naive & Pre-tratados)' : selectedPoblacion}</p>
              <p>• Rango de Inicio de Tratamiento: {fechaInicioMin} a {fechaInicioMax}</p>
              <p>• Granularidad del Gráfico: {selectedGranularidad}</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <p>Fecha de emisión: {new Date().toLocaleDateString('es-ES')}</p>
            <p>ID Consulta: SF-KM-{selectedPatologia.substring(0, 3).toUpperCase()}-2026</p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex-1 w-full flex flex-col gap-6">
        {/* KPI metrics row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
          {/* Card 1: Patients (N) */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Cohorte Analizada (N)
              </p>
              <h3 className="text-2xl font-bold text-slate-800 font-mono mt-1">
                {kpis.totalPatients}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                Pacientes seleccionados
              </p>
            </div>
            <div className="bg-teal-50 rounded-xl p-3 text-teal-600 print:hidden">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Discontinuations */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Tasa de Interrupción (E)
              </p>
              <h3 className="text-2xl font-bold text-rose-600 font-mono mt-1">
                {kpis.interruptionRate}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                Abandono terapéutico
              </p>
            </div>
            <div className="bg-rose-50 rounded-xl p-3 text-rose-500 print:hidden">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Censored */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Tasa de Retención (Activos)
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 font-mono mt-1">
                {kpis.censoredRate}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                Continúan activos en tratamiento
              </p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-emerald-500 print:hidden">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Longest survival */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Líder de Persistencia
              </p>
              <h3 className="text-base font-bold text-indigo-900 mt-1 leading-tight truncate max-w-[180px]" title={kpis.bestDrug}>
                {kpis.bestDrug}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                Mayor mediana de tiempo
              </p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3 text-indigo-500 print:hidden">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Content grid Layout (Filters on left, Analysis on right) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* LEFT COLUMN: FILTERS (Hidden on print) */}
          <aside className="lg:col-span-1 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-6 no-print">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <SlidersHorizontal className="w-5 h-5 text-slate-500" />
              <h2 className="text-slate-800 font-bold text-sm uppercase tracking-wider">
                Filtros Clínicos
              </h2>
            </div>

            {/* Selector 1: Pathology */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                1. Patología Clinica
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {(['Artritis Reumatoide', 'Psoriasis', 'Colitis Ulcerosa', 'Enfermedad de Crohn'] as Patologia[]).map(
                  (pat) => (
                    <button
                      key={pat}
                      onClick={() => setSelectedPatologia(pat)}
                      className={`text-left text-xs font-semibold px-3 py-2.5 rounded-xl border transition-all ${
                        selectedPatologia === pat
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100/60'
                      }`}
                    >
                      {pat}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Selector 2: Biologics (Multi-select) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  2. Fármacos Biológicos
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAllDrugs}
                    className="text-[10px] text-indigo-600 hover:underline font-bold"
                  >
                    Todos
                  </button>
                  <span className="text-[10px] text-slate-300">|</span>
                  <button
                    onClick={handleDeselectAllDrugs}
                    className="text-[10px] text-rose-500 hover:underline font-bold"
                  >
                    Ninguno
                  </button>
                </div>
              </div>

              {/* Show only approved drugs for the selected pathology to make it clinical */}
              <div className="max-h-[190px] overflow-y-auto border border-slate-100 rounded-xl p-2.5 bg-slate-50/50 space-y-1.5">
                {PATHOLOGY_DRUGS[selectedPatologia].map((drug) => {
                  const isChecked = selectedFarmacos.includes(drug);
                  return (
                    <button
                      key={drug}
                      onClick={() => handleToggleDrug(drug)}
                      className={`w-full flex items-center justify-between text-left text-xs p-2 rounded-lg border transition ${
                        isChecked
                          ? 'bg-white border-indigo-200 text-slate-800 font-semibold shadow-sm'
                          : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100/50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-3 h-3 rounded-full border border-slate-200 transition ${
                            isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white'
                          }`}
                        />
                        {drug}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
                *Filtrado dinámicamente según indicaciones autorizadas para {selectedPatologia}.
              </p>
            </div>

            {/* Selector 3: Date Range */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                3. Inicio del Análisis (Rango)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">Desde</span>
                  <input
                    type="date"
                    min="2019-01-01"
                    max="2024-12-31"
                    value={fechaInicioMin}
                    onChange={(e) => setFechaInicioMin(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-700 focus:outline-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">Hasta</span>
                  <input
                    type="date"
                    min="2019-01-01"
                    max="2024-12-31"
                    value={fechaInicioMax}
                    onChange={(e) => setFechaInicioMax(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-700 focus:outline-indigo-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Selector 4: Population Radio buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                4. Población de Análisis
              </label>
              <div className="space-y-1.5">
                {(['Todos', 'Solo Naive', 'Solo No Naive'] as Poblacion[]).map((pop) => (
                  <button
                    key={pop}
                    onClick={() => setSelectedPoblacion(pop)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition ${
                      selectedPoblacion === pop
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold shadow-sm'
                        : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{pop}</span>
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                      {pop === 'Todos' && 'Ambas líneas terapéuticas'}
                      {pop === 'Solo Naive' && 'Pacientes sin tratamiento biológico previo'}
                      {pop === 'Solo No Naive' && 'Pacientes previamente tratados (segunda línea +)'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selector 5: Granularidad Temporal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                5. Granularidad Eje X
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
                {(['Mensual', 'Trimestral', 'Anual'] as Granularidad[]).map((gran) => (
                  <button
                    key={gran}
                    onClick={() => setSelectedGranularidad(gran)}
                    className={`text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                      selectedGranularidad === gran
                        ? 'bg-white text-indigo-900 shadow-sm'
                        : 'bg-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {gran}
                  </button>
                ))}
              </div>
            </div>

            {/* Exporter triggers */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Descarga de Datos
              </p>
              
              <button
                disabled={filteredPatients.length === 0}
                onClick={() => exportCohortToCSV(filteredPatients, selectedPatologia)}
                className="w-full flex items-center justify-between text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 active:scale-95 disabled:opacity-50 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Cohorte Pacientes</span>
                </span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                disabled={kmCurves.length === 0}
                onClick={() => exportCurvesToCSV(kmCurves, selectedPatologia)}
                className="w-full flex items-center justify-between text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 active:scale-95 disabled:opacity-50 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <BarChart4 className="w-4 h-4 text-indigo-600" />
                  <span>Coordenadas Kaplan-Meier</span>
                </span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </aside>

          {/* RIGHT COLUMN: ANALYTICAL STAGE */}
          <section className="lg:col-span-3 print:col-span-4 space-y-6">
            
            {/* Tab selection & Chart configuration panel (Hidden on print) */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
              <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/60 max-w-fit">
                <button
                  onClick={() => setActiveTab('grafico')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'grafico'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'bg-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>Curvas de Persistencia</span>
                </button>
                <button
                  onClick={() => setActiveTab('datos')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'datos'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'bg-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span>Base de Datos ({filteredPatients.length})</span>
                </button>
              </div>

              {/* Chart Visual Options (Only meaningful for 'grafico' tab) */}
              {activeTab === 'grafico' && (
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCensoredTicks}
                      onChange={(e) => setShowCensoredTicks(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Ver Marcas de Censura</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGridLines}
                      onChange={(e) => setShowGridLines(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Mostrar Rejilla</span>
                  </label>
                </div>
              )}
            </div>

            {/* RENDERING DYNAMIC VIEW */}
            {selectedFarmacos.length === 0 ? (
              /* GRACEFUL ERROR HANDLING: No drugs selected */
              <div className="bg-white border border-rose-100 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-6 h-6" />
                </div>
                <h3 className="text-slate-800 font-bold text-lg mb-2">
                  Ningún Fármaco Seleccionado para la Comparación
                </h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-5 leading-relaxed">
                  Para poder estimar la función de supervivencia de Kaplan-Meier, debes seleccionar al menos un biologic o molécula dirigida en el panel lateral.
                </p>
                <button
                  onClick={handleSelectAllDrugs}
                  className="bg-slate-900 text-white font-semibold text-xs px-4 py-2 rounded-xl hover:bg-slate-800 transition active:scale-95"
                >
                  Seleccionar Todos los Autorizados
                </button>
              </div>
            ) : filteredPatients.length === 0 ? (
              /* EMPTY STATE: Filter combination has 0 results */
              <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-6 h-6" />
                </div>
                <h3 className="text-slate-800 font-bold text-lg mb-2">
                  Ningún Paciente Cumple los Criterios de Filtro
                </h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-4 leading-relaxed">
                  Prueba ampliando el rango de fecha de inicio o cambiando la cohorte demográfica de pacientes en el panel lateral.
                </p>
              </div>
            ) : activeTab === 'grafico' ? (
              /* ACTIVE TAB 1: PLOTS, SUMMARY TABLE & CLINICAL INSIGHTS */
              <div className="space-y-6 print-full-width">
                {/* 1. Kaplan-Meier Chart Plot (renders step function + numbers at risk) */}
                <div className="print-full-width">
                  <KaplanMeierChart
                    curves={kmCurves}
                    granularidad={selectedGranularidad}
                    showCensoredTicks={showCensoredTicks}
                    showGridLines={showGridLines}
                  />
                </div>

                {/* 2. Actuarial Table Summary */}
                <div className="print-full-width print-page-break">
                  <SummaryTable curves={kmCurves} granularidad={selectedGranularidad} />
                </div>

                {/* 3. Clinical insights */}
                <div className="print-full-width no-print">
                  <ClinicalInsights
                    curves={kmCurves}
                    patologia={selectedPatologia}
                    filteredPatients={filteredPatients}
                    granularidad={selectedGranularidad}
                  />
                </div>
              </div>
            ) : (
              /* ACTIVE TAB 2: DETAILED PATIENTS DATABASE EXPLORER (Hidden on print) */
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm no-print space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h3 className="text-slate-800 font-bold text-base">Registros de Pacientes</h3>
                    <p className="text-slate-400 text-xs font-semibold">
                      Base de datos filtrada (Mostrando {paginatedPatients.total} de {filteredPatients.length} pacientes)
                    </p>
                  </div>

                  {/* Search Input */}
                  <div className="relative max-w-xs w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por ID, fármaco, perfil..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Patient Grid Table */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">ID Paciente</th>
                        <th className="py-3 px-3">Fármaco</th>
                        <th className="py-3 px-3">Perfil Clínico</th>
                        <th className="py-3 px-3">Fecha de Inicio</th>
                        <th className="py-3 px-3 text-right">Duración (Días)</th>
                        <th className="py-3 px-4 text-center">Estado del Tratamiento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {paginatedPatients.items.map((p) => (
                        <tr key={p.paciente_id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-4 font-bold font-mono text-slate-800">{p.paciente_id}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900">{p.farmaco}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.perfil_paciente === 'Naive'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              {p.perfil_paciente}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{p.fecha_inicio}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{p.duracion_dias}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                p.evento_interrupcion === 1
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}
                            >
                              {p.evento_interrupcion === 1 ? 'Interrumpido' : 'Activo (Censurado)'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <p className="text-[11px] text-slate-400 font-semibold">
                      Página <span className="text-slate-700 font-bold">{currentPage}</span> de{' '}
                      <span className="text-slate-700 font-bold">{totalPages}</span>
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer (Hidden on print) */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-400 font-semibold no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>
            © 2026 Dashboard de Persistencia de Tratamientos Biológicos. Todos los derechos reservados.
          </p>
          <p className="text-[11px] text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 font-mono">
            Uso Clínico e Investigador Autorizado · Servicio de Farmacia Hospitalaria
          </p>
        </div>
      </footer>
    </div>
  );
}
