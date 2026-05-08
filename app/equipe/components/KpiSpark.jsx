"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import styles from "./KpiSpark.module.css";

/**
 * Phase 3 — KPI card with sparkline. Used by /equipe to show:
 * Pix pendentes, Separação, Bloqueios, Faturado semana.
 */
export default function KpiSpark({
  label,
  value,
  unit = "",
  tone = "",
  data = [],
  help = "",
  formatValue = (n) => n,
}) {
  const stroke = toneColor(tone, "stroke");
  const fill = toneColor(tone, "fill");

  return (
    <article className={styles.txKpi}>
      <div className={styles.txKpiHead}>
        <span className={styles.txKpiLabel}>{label}</span>
        {tone ? <span className={`${styles.txKpiTone} ${tone}`}>{toneDot(tone)}</span> : null}
      </div>
      <div>
        <span className={styles.txKpiValue}>{formatValue(value)}</span>
        {unit ? <span className={styles.txKpiUnit}>{unit}</span> : null}
      </div>
      <div className={styles.txKpiChart} aria-hidden>
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={fill} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={fill} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={stroke}
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>
      {help ? <span className={styles.txKpiHelp}>{help}</span> : null}
    </article>
  );
}

function toneColor(tone, kind) {
  const palette = {
    warn: { stroke: "#d6a91a", fill: "#d6a91a" },
    danger: { stroke: "#b03a2e", fill: "#b03a2e" },
    good: { stroke: "#1d8c52", fill: "#1d8c52" },
  };
  const entry = palette[tone] || { stroke: "#687970", fill: "#687970" };
  return entry[kind];
}

function toneDot(tone) {
  return (
    {
      warn: "atenção",
      danger: "ação imediata",
      good: "estável",
    }[tone] || ""
  );
}
