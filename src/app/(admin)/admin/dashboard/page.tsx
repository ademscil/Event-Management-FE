"use client";

import { getCurrentUser } from "@/lib/auth";
import { formatEventPeriod, resolveEventStatus } from "@/lib/event-status";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import type { SurveyOverviewItem } from "@/types/survey";
import { useEffect, useMemo, useState } from "react";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import styles from "../page-mockup.module.css";

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return String(value);
}

function matchesDateRange(survey: SurveyOverviewItem, start: string, end: string): boolean {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const surveyStart = new Date(survey.StartDate);
  const surveyEnd = new Date(survey.EndDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return true;
  return surveyStart >= startDate && surveyEnd <= endDate;
}

export default function DashboardPage() {
  const [surveys, setSurveys] = useState<SurveyOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentRole] = useState<UserRole | null>(() => getCurrentUser()?.role ?? null);

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);

      try {
        const result = await fetchSurveyOverview();
        if (!active) return;

        if (!result.success) {
          setError(result.message || "Gagal memuat data survey");
          setSurveys([]);
          return;
        }

        setError("");
        setSurveys(result.surveys.filter((survey) => resolveEventStatus(survey) !== "Draft"));
      } catch {
        if (!active) return;
        setError("Terjadi kesalahan saat memuat data survey");
        setSurveys([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredSurveys = useMemo(() => {
    const normalizedKeyword = appliedKeyword.trim().toLowerCase();

    return surveys.filter((survey) => {
      const effectiveStatus = resolveEventStatus(survey);

      if (!matchesDateRange(survey, periodStart, periodEnd)) return false;

      if (statusFilter !== "all" && effectiveStatus.toLowerCase() !== statusFilter) return false;

      if (!normalizedKeyword) return true;

      if (appliedSearchBy === "event") {
        return survey.Title.toLowerCase().includes(normalizedKeyword);
      }

      return survey.Title.toLowerCase().includes(normalizedKeyword);
    });
  }, [surveys, periodStart, periodEnd, statusFilter, appliedKeyword, appliedSearchBy]);

  const lastUpdatedText = useMemo(() => {
    if (filteredSurveys.length === 0) return "Last updated: -";
    const latest = filteredSurveys.reduce((prev, current) => {
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
  }, [filteredSurveys]);

  const showReportAction = currentRole === "AdminEvent";

  const onApplySearch = () => {
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
        </div>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Filter</h2>
        <div className={styles.filterToolbar}>
          <div className={`${styles.filterGroup} ${styles.filterGroupSm}`}>
            <label className={styles.filterLabel} htmlFor="dashPeriodStart">Periode Mulai</label>
            <input id="dashPeriodStart" name="dashPeriodStart" className={styles.filterControl} type="date" aria-label="Tanggal mulai periode" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className={`${styles.filterGroup} ${styles.filterGroupSm}`}>
            <label className={styles.filterLabel} htmlFor="dashPeriodEnd">Periode Akhir</label>
            <input id="dashPeriodEnd" name="dashPeriodEnd" className={styles.filterControl} type="date" aria-label="Tanggal akhir periode" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className={`${styles.filterGroup} ${styles.filterGroupMd}`}>
            <label id="dash-status-label" className={styles.filterLabel} htmlFor="dash-status-dropdown">Status</label>
            <Dropdown id="dash-status-dropdown" className={styles.filterControl} fullWidth options={[{ value: "all", label: "Semua Status" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" }]} value={statusFilter} onChange={setStatusFilter} aria-labelledby="dash-status-label" />
          </div>
          <SearchBar options={[{ value: "all", label: "Search By" }, { value: "event", label: "Event" }]} selectedValue={searchBy} keyword={keyword} onSelectedValueChange={setSearchBy} onKeywordChange={setKeyword} onButtonClick={onApplySearch} placeholder="Cari event..." />
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
                  <th scope="col">Event</th>
                  <th scope="col">Periode</th>
                  <th scope="col">Status</th>
                  <th scope="col">Responden</th>
                  <th scope="col">Target Responden</th>
                  <th scope="col">Score</th>
                  <th scope="col">Target Score</th>
                  {showReportAction ? <th scope="col">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredSurveys.length === 0 ? (
                  <tr>
                    <td colSpan={showReportAction ? 8 : 7}>Tidak ada data survey</td>
                  </tr>
                ) : (
                  filteredSurveys.map((survey) => {
                    const effectiveStatus = resolveEventStatus(survey);

                    return (
                      <tr key={survey.SurveyId}>
                        <td>{survey.Title}</td>
                        <td>{formatEventPeriod(survey.StartDate, survey.EndDate)}</td>
                        <td>
                          <span
                            className={`${styles.badge} ${
                              effectiveStatus === "Active" ? styles.badgeActive : styles.badgeClosed
                            }`}
                          >
                            {effectiveStatus}
                          </span>
                        </td>
                        <td>{formatNumber(survey.RespondentCount)}</td>
                        <td>{formatNumber(survey.TargetRespondents)}</td>
                        <td>{formatScore(survey.CurrentScore)}</td>
                        <td>{formatScore(survey.TargetScore)}</td>
                        {showReportAction ? (
                          <td>
                            <a className={`${styles.btn} ${styles.btnSecondary}`} href={`/admin/report?surveyId=${survey.SurveyId}`}>View Report</a>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}

