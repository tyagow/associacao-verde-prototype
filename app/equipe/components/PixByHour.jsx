"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import styles from "./PixByHour.module.css";

/**
 * Phase 3 — Aggregates confirmed Pix payments by hour today.
 * Source: dashboard.payments where status === "paid" or status === "reconciled"
 * (anything terminal). Bucket by paidAt -> hour (America/Sao_Paulo).
 */
export default function PixByHour({ payments = [] }) {
  const buckets = aggregateByHour(payments);
  const total = buckets.reduce((sum, b) => sum + b.value, 0);

  return (
    <section className={styles.txPixHour} aria-label="Pix confirmados por hora hoje">
      <header className={styles.txPixHourHead}>
        <h3 className={styles.txPixHourTitle}>Pix por hora · hoje</h3>
        <span className={styles.txPixHourTotal}>
          <strong>{total}</strong> confirmados
        </span>
      </header>
      <div className={styles.txPixHourBody}>
        {total === 0 ? (
          <p className={styles.txPixHourEmpty}>
            Nenhum Pix confirmado nas ultimas 24 horas. O grafico se preenche assim que webhooks
            forem recebidos.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buckets} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#ecf1ee" vertical={false} />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={{ stroke: "#e3ebe6" }}
                tick={{ fontSize: 11, fill: "#687970" }}
                tickFormatter={(h) => `${String(h).padStart(2, "0")}h`}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#687970" }}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: "#f1f6f3" }}
                contentStyle={{
                  background: "#fbfcfa",
                  border: "1px solid #e3ebe6",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#0d1f17",
                }}
                labelFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`}
                formatter={(value) => [value, "Pix"]}
              />
              <Bar dataKey="value" fill="#1d8c52" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function aggregateByHour(payments) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }));
  if (!Array.isArray(payments) || payments.length === 0) return buckets;
  const today = todayKeyInSP(new Date());
  for (const payment of payments) {
    if (payment.status !== "paid" && payment.status !== "reconciled") continue;
    const paidAt = payment.paidAt || payment.confirmedAt || payment.updatedAt;
    if (!paidAt) continue;
    const date = new Date(paidAt);
    if (Number.isNaN(date.getTime())) continue;
    if (todayKeyInSP(date) !== today) continue;
    const hour = hourInSP(date);
    if (hour >= 0 && hour < 24) buckets[hour].value += 1;
  }
  return buckets;
}

function todayKeyInSP(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hourInSP(date) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return Number.parseInt(formatted, 10);
}
