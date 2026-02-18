"use client";

import { fetchSurveyOverview } from "@/lib/surveys";
import type { SurveyOverviewItem } from "@/types/survey";
import { useEffect, useMemo, useState } from "react";
import styles from "../page-mockup.module.css";

function formatPeriod(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const format = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${format.format(start)} - ${format.format(end)}`;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return String(value);
}

export default function DashboardPage() {
  const [surveys, setSurveys] = useState<SurveyOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const result = await fetchSurveyOverview();
      setLoading(false);
      if (!result.success) {
        setError(result.message || "Gagal memuat data survey");
        setSurveys([]);
        return;
      }
      setError("");
      setSurveys(result.surveys.filter((survey) => survey.Status !== "Draft"));
    })();
  }, []);

  const lastUpdatedText = useMemo(() => {
    if (surveys.length === 0) return "Last updated: -";
    const latest = surveys.reduce((prev, current) => {
      const prevDate = new Date(prev.UpdatedAt || prev.CreatedAt || 0).getTime();
      const currentDate = new Date(current.UpdatedAt || current.CreatedAt || 0).getTime();
      return currentDate > prevDate ? current : prev;
    });
    const latestDate = new Date(latest.UpdatedAt || latest.CreatedAt || "1970-01-01T00:00:00.000Z");
    return `Last updated: ${new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(latestDate)}`;
  }, [surveys]);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
        </div>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Filter</h2>
        <div className={styles.periodRow}>
          <div className={styles.periodLabel}>PERIODE</div>
          <div className={styles.periodColon}>:</div>
          <input
            id="periodStart"
            className={`${styles.input} ${styles.periodInput}`}
            type="date"
            defaultValue="2026-01-01"
          />
          <input
            className={`${styles.input} ${styles.periodInput}`}
            type="date"
            defaultValue="2026-12-31"
          />
        </div>
        <div className={styles.periodRow}>
          <div className={styles.periodLabel}>STATUS</div>
          <div className={styles.periodColon}>:</div>
          <select id="status" className={`${styles.select} ${styles.statusControl}`} defaultValue="all">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className={styles.searchRow}>
          <select className={styles.searchSelect} defaultValue="all">
            <option value="all">Search By</option>
            <option value="event">Event</option>
          </select>
          <input className={`${styles.input} ${styles.searchInput}`} placeholder="search here ..." />
          <button className={styles.searchButton} type="button">
            Search
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Event Overview</h2>
          <span className={styles.meta}>{lastUpdatedText}</span>
        </div>
        {error ? <div className={styles.meta}>{error}</div> : null}
        {loading ? <div className={styles.meta}>Memuat data event...</div> : null}
        {!loading && !error ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Periode</th>
                  <th>Status</th>
                  <th>Responden</th>
                  <th>Target Responden</th>
                  <th>Score</th>
                  <th>Target Score</th>
                </tr>
              </thead>
              <tbody>
                {surveys.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Tidak ada data survey</td>
                  </tr>
                ) : (
                  surveys.map((survey) => (
                    <tr key={survey.SurveyId}>
                      <td>{survey.Title}</td>
                      <td>{formatPeriod(survey.StartDate, survey.EndDate)}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            survey.Status === "Active" ? styles.badgeActive : styles.badgeClosed
                          }`}
                        >
                          {survey.Status}
                        </span>
                      </td>
                      <td>{formatNumber(survey.RespondentCount)}</td>
                      <td>{formatNumber(survey.TargetRespondents)}</td>
                      <td>{formatScore(survey.CurrentScore)}</td>
                      <td>{formatScore(survey.TargetScore)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
