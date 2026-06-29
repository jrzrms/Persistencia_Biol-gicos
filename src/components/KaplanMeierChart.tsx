import React, { useState, useRef } from 'react';
import { KMCurve, Farmaco, Granularidad } from '../types';

interface KaplanMeierChartProps {
  curves: KMCurve[];
  granularidad: Granularidad;
  showCensoredTicks: boolean;
  showGridLines: boolean;
}

export const DRUG_COLORS: Record<Farmaco, string> = {
  Adalimumab: '#e11d48',    // Rose
  Infliximab: '#2563eb',    // Blue
  Etanercept: '#d97706',    // Amber
  Ustekinumab: '#059669',   // Emerald
  Vedolizumab: '#7c3aed',   // Violet
  Guselkumab: '#db2777',    // Pink
  Risankizumab: '#0891b2',   // Cyan
  Tildrakizumab: '#0d9488',  // Teal
  Secukinumab: '#4f46e5',   // Indigo
  Upadacitinib: '#ea580c',  // Orange
};

export const KaplanMeierChart: React.FC<KaplanMeierChartProps> = ({
  curves,
  granularidad,
  showCensoredTicks,
  showGridLines,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    time: number;
    data: {
      farmaco: Farmaco;
      survival: number;
      atRisk: number;
      events: number;
      censored: number;
    }[];
  } | null>(null);

  if (curves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6 text-center">
        <p className="text-slate-500 font-medium">Ningún fármaco seleccionado</p>
        <p className="text-slate-400 text-sm mt-1">Por favor, selecciona al menos un fármaco en el panel lateral para calcular su curva de persistencia.</p>
      </div>
    );
  }

  // Find maximum time across all curves to scale X-axis
  let maxTime = 12; // default minimum
  curves.forEach((c) => {
    if (c.points.length > 0) {
      const lastPoint = c.points[c.points.length - 1];
      if (lastPoint.time > maxTime) {
        maxTime = lastPoint.time;
      }
    }
  });

  // Round max time to a clean ceiling
  maxTime = Math.ceil(maxTime / 10) * 10;
  if (maxTime < 10) maxTime = 10;

  // SVG Dimension Constants
  const width = 800;
  const height = 400;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 20;
  const paddingBottom = 45;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Scaling helpers
  const getX = (t: number) => paddingLeft + (t / maxTime) * plotWidth;
  const getY = (s: number) => paddingTop + (1 - s) * plotHeight;

  // Time ticks (usually 5 to 6 ticks)
  const xTicks: number[] = [];
  const tickCount = 6;
  const step = maxTime / (tickCount - 1);
  for (let i = 0; i < tickCount; i++) {
    xTicks.push(Math.round(i * step * 10) / 10);
  }

  // Y ticks (every 10%)
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  // Mouse Move Handler for high-fidelity Tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouseX to plot time coordinate
    const relativeX = mouseX - (paddingLeft / width) * rect.width;
    const plotAreaWidth = (plotWidth / width) * rect.width;
    if (relativeX < 0 || relativeX > plotAreaWidth) {
      setTooltip(null);
      return;
    }

    const hoverTime = (relativeX / plotAreaWidth) * maxTime;

    // Gather survival data for each drug at this specific time
    const tooltipData: typeof tooltip extends null ? never : any[] = [];
    
    curves.forEach((curve) => {
      // Find the active point at this time
      // The patient survival at time T is the survival of the largest point <= T
      let activePoint = curve.points[0];
      for (const pt of curve.points) {
        if (pt.time <= hoverTime) {
          activePoint = pt;
        } else {
          break;
        }
      }

      if (activePoint) {
        tooltipData.push({
          farmaco: curve.farmaco,
          survival: activePoint.survival,
          atRisk: activePoint.atRisk,
          events: activePoint.events,
          censored: activePoint.censored,
        });
      }
    });

    setTooltip({
      x: e.clientX - containerRef.current.getBoundingClientRect().left,
      y: e.clientY - containerRef.current.getBoundingClientRect().top - 15,
      time: Math.round(hoverTime * 10) / 10,
      data: tooltipData,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div ref={containerRef} className="relative bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-slate-800 font-semibold text-lg flex items-center gap-2">
            Curva de Supervivencia de Kaplan-Meier
          </h3>
          <p className="text-slate-400 text-xs font-medium">
            Representación matemática en función escalonada. Los marcadores verticales indican pacientes censurados.
          </p>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {curves.map((curve) => (
            <div key={curve.farmaco} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: DRUG_COLORS[curve.farmaco] }}
              />
              <span className="text-xs font-semibold text-slate-700">{curve.farmaco}</span>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">
                n={curve.totalPatients}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="overflow-visible">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid lines & Axes Background */}
          {showGridLines &&
            yTicks.map((tick) => (
              <line
                key={`grid-y-${tick}`}
                x1={paddingLeft}
                y1={getY(tick)}
                x2={width - paddingRight}
                y2={getY(tick)}
                stroke="#f1f5f9"
                strokeWidth={1}
              />
            ))}

          {showGridLines &&
            xTicks.map((tick) => (
              <line
                key={`grid-x-${tick}`}
                x1={getX(tick)}
                y1={paddingTop}
                x2={getX(tick)}
                y2={height - paddingBottom}
                stroke="#f1f5f9"
                strokeWidth={1}
              />
            ))}

          {/* Axes lines */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />

          {/* Y-axis Ticks & Labels */}
          {yTicks.map((tick) => (
            <g key={`y-label-${tick}`} className="text-[11px] font-mono fill-slate-500">
              <line
                x1={paddingLeft - 5}
                y1={getY(tick)}
                x2={paddingLeft}
                y2={getY(tick)}
                stroke="#94a3b8"
                strokeWidth={1}
              />
              <text x={paddingLeft - 10} y={getY(tick) + 4} textAnchor="end">
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}

          {/* X-axis Ticks & Labels */}
          {xTicks.map((tick) => (
            <g key={`x-label-${tick}`} className="text-[11px] font-mono fill-slate-500">
              <line
                x1={getX(tick)}
                y1={height - paddingBottom}
                x2={getX(tick)}
                y2={height - paddingBottom + 5}
                stroke="#94a3b8"
                strokeWidth={1}
              />
              <text x={getX(tick)} y={height - paddingBottom + 18} textAnchor="middle">
                {tick}
              </text>
            </g>
          ))}

          {/* X-axis Label Title */}
          <text
            x={paddingLeft + plotWidth / 2}
            y={height - 10}
            textAnchor="middle"
            className="text-xs font-semibold fill-slate-600"
          >
            Tiempo en Tratamiento ({granularidad === 'Mensual' ? 'Meses' : granularidad === 'Trimestral' ? 'Trimestres' : 'Años'})
          </text>

          {/* Y-axis Label Title (Rotated) */}
          <text
            x={-height / 2 + paddingBottom / 2}
            y={15}
            textAnchor="middle"
            transform="rotate(-90)"
            className="text-xs font-semibold fill-slate-600"
          >
            Pacientes Persistentes (%)
          </text>

          {/* Draw curves */}
          {curves.map((curve) => {
            const color = DRUG_COLORS[curve.farmaco] || '#64748b';
            let pathD = '';
            
            // Build the STEP function path
            curve.points.forEach((pt, idx) => {
              const x = getX(pt.time);
              const y = getY(pt.survival);

              if (idx === 0) {
                pathD = `M ${x} ${y}`;
              } else {
                // To make a step curve, we transition:
                // horizontally to the new time at previous survival rate
                // then vertically down/up to the new survival rate
                const xPrev = getX(curve.points[idx - 1].time);
                const yPrev = getY(curve.points[idx - 1].survival);
                pathD += ` H ${x} V ${y}`;
              }
            });

            return (
              <g key={`curve-group-${curve.farmaco}`}>
                {/* Step Path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="miter"
                  className="transition-all duration-300"
                />

                {/* Censored Ticks */}
                {showCensoredTicks &&
                  curve.points.map((pt, idx) => {
                    // Only draw ticks for positive times that have censored patients
                    if (idx === 0 || pt.censored === 0) return null;
                    const x = getX(pt.time);
                    const y = getY(pt.survival);
                    return (
                      <line
                        key={`censored-tick-${curve.farmaco}-${idx}`}
                        x1={x}
                        y1={y - 4}
                        x2={x}
                        y2={y + 4}
                        stroke={color}
                        strokeWidth={1.5}
                      />
                    );
                  })}
              </g>
            );
          })}

          {/* Interactive vertical guideline on hover */}
          {tooltip && (
            <line
              x1={getX(tooltip.time)}
              y1={paddingTop}
              x2={getX(tooltip.time)}
              y2={height - paddingBottom}
              stroke="#64748b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          )}
        </svg>
      </div>

      {/* Dynamic Floating Tooltip */}
      {tooltip && (
        <div
          className="absolute z-30 bg-slate-900/95 backdrop-blur-sm border border-slate-800 text-white rounded-xl p-3 shadow-xl text-xs max-w-sm pointer-events-none transition-all duration-75"
          style={{
            left: `${tooltip.x + 15}px`,
            top: `${tooltip.y - 40}px`,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="font-semibold text-slate-200 border-b border-slate-800 pb-1.5 mb-2 flex justify-between items-center gap-4">
            <span>Intervalo temporal:</span>
            <span className="text-emerald-400 font-mono">
              {tooltip.time} {granularidad === 'Mensual' ? 'Mes' : granularidad === 'Trimestral' ? 'Trim.' : 'Años'}(s)
            </span>
          </div>
          <div className="space-y-1.5 min-w-[200px]">
            {tooltip.data.map((item) => (
              <div key={item.farmaco} className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: DRUG_COLORS[item.farmaco] }}
                  />
                  <span className="font-medium text-slate-300">{item.farmaco}</span>
                </div>
                <div className="text-right flex items-center gap-2 font-mono">
                  <span className="text-white font-semibold">
                    {Math.round(item.survival * 1000) / 10}%
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    (R:{item.atRisk})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Numbers at Risk (Tabla de Pacientes en Riesgo) */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <h4 className="text-slate-700 font-semibold text-xs uppercase tracking-wider mb-2">
          Pacientes en Riesgo (Numbers at Risk)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-500 border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-2 pr-4 font-semibold text-slate-600">Fármaco</th>
                {xTicks.map((tick) => (
                  <th key={`risk-th-${tick}`} className="py-2 px-3 font-mono text-center font-semibold text-slate-600">
                    T = {tick}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {curves.map((curve) => {
                const color = DRUG_COLORS[curve.farmaco] || '#64748b';
                return (
                  <tr key={`risk-row-${curve.farmaco}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-1.5 pr-4 font-semibold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      {curve.farmaco}
                    </td>
                    {xTicks.map((tick) => {
                      // Find the number at risk for this drug at time T
                      // It corresponds to the atRisk of the first point whose time is >= tick
                      // Or if the tick matches a point, we take its atRisk.
                      // Let's find the active point just before or at this tick
                      let atRiskVal = 0;
                      if (tick === 0) {
                        atRiskVal = curve.totalPatients;
                      } else {
                        // Find point that covers this tick
                        // We find the last point with time <= tick
                        let pt = curve.points[0];
                        for (const p of curve.points) {
                          if (p.time <= tick) {
                            pt = p;
                          } else {
                            break;
                          }
                        }
                        
                        // Remaining in risk at this interval is:
                        // pt.atRisk - pt.events - pt.censored (if tick is strictly greater than pt.time)
                        if (pt) {
                          if (pt.time === tick) {
                            atRiskVal = pt.atRisk;
                          } else {
                            atRiskVal = Math.max(0, pt.atRisk - pt.events - pt.censored);
                          }
                        }
                      }

                      return (
                        <td key={`risk-val-${curve.farmaco}-${tick}`} className="py-1.5 px-3 text-center font-mono text-slate-700">
                          {atRiskVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
