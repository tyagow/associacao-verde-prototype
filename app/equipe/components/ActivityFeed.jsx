"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ActivityFeed.module.css";
import { ACTION_COPY } from "./auditCopy.js";
import { pluralize } from "./pluralize.js";

const POLL_INTERVAL_MS = 5000;
const MAX_EVENTS = 40;

export default function ActivityFeed({ initialEvents = [] }) {
  const [events, setEvents] = useState(() => initialEvents.slice(0, MAX_EVENTS));
  const [status, setStatus] = useState("ao vivo");
  const sinceRef = useRef(initialEvents[0]?.at || null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function poll() {
      try {
        const url = new URL("/api/team/activity", window.location.origin);
        if (sinceRef.current) url.searchParams.set("since", sinceRef.current);
        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setStatus(`erro ${response.status}`);
          return;
        }
        const payload = await response.json();
        if (cancelled) return;
        if (payload.events?.length) {
          setEvents((current) => {
            const merged = [...payload.events.slice().reverse(), ...current];
            return dedupe(merged).slice(0, MAX_EVENTS);
          });
          sinceRef.current = payload.events[0].at;
        } else if (payload.now && !sinceRef.current) {
          sinceRef.current = payload.now;
        }
        setStatus("ao vivo");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }

    function tick() {
      if (typeof document === "undefined" || !document.hidden) {
        poll();
      }
    }

    tick();
    timer = setInterval(tick, POLL_INTERVAL_MS);

    function onVisibility() {
      if (!document.hidden) tick();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <aside className={styles.panel} aria-label="Atividade recente">
      <header className={styles.head}>
        <h3 className={styles.title}>Atividade recente</h3>
        <span className={styles.meta}>
          {status === "ao vivo"
            ? `ao vivo · ${pluralize(events.length, "evento", "eventos")}`
            : status}
        </span>
      </header>
      {events.length === 0 ? (
        <p className={styles.empty}>Sem eventos relevantes na janela atual.</p>
      ) : (
        <ul className={styles.feed}>
          {events.map((event) => {
            const meta = ACTION_COPY[event.action] || { label: event.action, tone: "" };
            return (
              <li key={event.id}>
                <time dateTime={event.at}>{formatTime(event.at)}</time>
                <div>
                  <span className={styles.what}>
                    {meta.label}
                    {describeRef(event) ? (
                      <>
                        {" · "}
                        <span className={styles.mono}>{describeRef(event)}</span>
                      </>
                    ) : null}
                  </span>
                  <span className={styles.who}>por {event.actor || "sistema"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const event of list) {
    if (!event?.id || seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
  }
  return out;
}

function describeRef(event) {
  const d = event.details || {};
  if (typeof d === "string") return d;
  if (d.orderId) return d.orderId;
  if (d.paymentId) return d.paymentId;
  if (d.memberCode) return d.memberCode;
  if (d.patientId) return d.patientId;
  if (d.batchId) return d.batchId;
  return "";
}

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
