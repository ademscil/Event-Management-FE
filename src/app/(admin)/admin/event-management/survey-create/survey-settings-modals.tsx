"use client";

import { useEffect, useMemo, useState } from "react";
import type { FontPreset } from "./builder-definitions";
import { detectScheduleInputMode, parseScheduleInputDate, type ScheduleInputMode } from "./builder-utils";
import styles from "./survey-create.module.css";

interface SurveySettingsModalsProps {
  bgColor: string;
  buttonStyle: "rounded" | "pill" | "square";
  font: FontPreset;
  heroSubtitle: string;
  heroTitle: string;
  multiPage: boolean;
  onFile: (file: File | undefined, setter: (value: string) => void) => void;
  primaryColor: string;
  scheduleEnd: string;
  scheduleStart: string;
  secondaryColor: string;
  setBgColor: (value: string) => void;
  setBgImage: (value: string) => void;
  setButtonStyle: (value: "rounded" | "pill" | "square") => void;
  setFont: (value: FontPreset) => void;
  setHeroSubtitle: (value: string) => void;
  setHeroTitle: (value: string) => void;
  setLogo: (value: string) => void;
  setMultiPage: (value: boolean) => void;
  setPrimaryColor: (value: string) => void;
  setScheduleEnd: (value: string) => void;
  setScheduleStart: (value: string) => void;
  setSecondaryColor: (value: string) => void;
  setShowPageNumbers: (value: boolean) => void;
  setShowProgressBar: (value: boolean) => void;
  setShowSchedule: (value: boolean) => void;
  setShowStyle: (value: boolean) => void;
  showPageNumbers: boolean;
  showProgressBar: boolean;
  showSchedule: boolean;
  showStyle: boolean;
}

type ScheduleBoundary = "start" | "end";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateForInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function extractDateValue(value: string, boundary: ScheduleBoundary): string {
  if (!value) return "";
  if (!value.includes("T")) return value;
  const parsed = parseScheduleInputDate(value, boundary);
  return parsed ? formatDateForInput(parsed) : value.slice(0, 10);
}

function extractTimeValue(value: string, boundary: ScheduleBoundary): string {
  const parsed = parseScheduleInputDate(value, boundary);
  if (!parsed) {
    return boundary === "start" ? "09:00" : "17:00";
  }
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function composeScheduleValue(
  mode: ScheduleInputMode,
  dateValue: string,
  timeValue: string,
): string {
  if (!dateValue) return "";
  if (mode === "date") return dateValue;
  return `${dateValue}T${timeValue}`;
}

function TimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [selectedHourText = "09", selectedMinuteText = "00"] = value.split(":");
  const selectedHour = Number.parseInt(selectedHourText, 10) || 0;
  const selectedMinute = Number.parseInt(selectedMinuteText, 10) || 0;
  const hourNumbers = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minuteNumbers = useMemo(() => [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], []);

  const updateHour = (nextHour: number) => {
    onChange(`${pad(nextHour)}:${pad(selectedMinute)}`);
  };

  const updateMinute = (nextMinute: number) => {
    onChange(`${pad(selectedHour)}:${pad(nextMinute)}`);
  };

  return (
    <div className={styles.scheduleTimeCard}>
      <div className={styles.scheduleTimeHeader}>
        <div>
          <div className={styles.scheduleTimeTitle}>{label}</div>
          <div className={styles.scheduleTimeHint}>WIB / GMT+7</div>
        </div>
        <div className={styles.scheduleTimeReadout}>{`${pad(selectedHour)}:${pad(selectedMinute)}`}</div>
      </div>

      <div className={styles.scheduleTimeInputs}>
        <label className={styles.scheduleSelectLabel}>
          Hour
          <select
            className={styles.scheduleTimeSelect}
            value={pad(selectedHour)}
            onChange={(event) => updateHour(Number.parseInt(event.target.value, 10))}
          >
            {hourNumbers.map((hour) => (
              <option key={`hour-${hour}`} value={pad(hour)}>
                {pad(hour)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.scheduleSelectLabel}>
          Minute
          <select
            className={styles.scheduleTimeSelect}
            value={pad(selectedMinute)}
            onChange={(event) => updateMinute(Number.parseInt(event.target.value, 10))}
          >
            {minuteNumbers.map((minute) => (
              <option key={`minute-${minute}`} value={pad(minute)}>
                {pad(minute)}
              </option>
            ))}
          </select>
        </label>
      </div>

    </div>
  );
}

export default function SurveySettingsModals({
  bgColor,
  buttonStyle,
  font,
  heroSubtitle,
  heroTitle,
  multiPage,
  onFile,
  primaryColor,
  scheduleEnd,
  scheduleStart,
  secondaryColor,
  setBgColor,
  setBgImage,
  setButtonStyle,
  setFont,
  setHeroSubtitle,
  setHeroTitle,
  setLogo,
  setMultiPage,
  setPrimaryColor,
  setScheduleEnd,
  setScheduleStart,
  setSecondaryColor,
  setShowPageNumbers,
  setShowProgressBar,
  setShowSchedule,
  setShowStyle,
  showPageNumbers,
  showProgressBar,
  showSchedule,
  showStyle,
}: SurveySettingsModalsProps) {
  const [scheduleMode, setScheduleMode] = useState<ScheduleInputMode>(
    detectScheduleInputMode(scheduleStart, scheduleEnd),
  );

  useEffect(() => {
    setScheduleMode(detectScheduleInputMode(scheduleStart, scheduleEnd));
  }, [scheduleEnd, scheduleStart]);

  const todayText = useMemo(() => formatDateForInput(new Date()), []);

  const handleModeChange = (nextMode: ScheduleInputMode) => {
    if (nextMode === scheduleMode) return;

    const startDate = extractDateValue(scheduleStart, "start") || todayText;
    const endDate = extractDateValue(scheduleEnd, "end") || startDate;
    const startTime = extractTimeValue(scheduleStart, "start");
    const endTime = extractTimeValue(scheduleEnd, "end");

    setScheduleMode(nextMode);
    setScheduleStart(composeScheduleValue(nextMode, startDate, startTime));
    setScheduleEnd(composeScheduleValue(nextMode, endDate, endTime));
  };

  const handleDateChange = (boundary: ScheduleBoundary, nextDate: string) => {
    const currentValue = boundary === "start" ? scheduleStart : scheduleEnd;
    const nextTime = extractTimeValue(currentValue, boundary);
    const nextValue = composeScheduleValue(scheduleMode, nextDate, nextTime);
    if (boundary === "start") {
      setScheduleStart(nextValue);
      return;
    }
    setScheduleEnd(nextValue);
  };

  const handleTimeChange = (boundary: ScheduleBoundary, nextTime: string) => {
    const currentValue = boundary === "start" ? scheduleStart : scheduleEnd;
    const nextDate = extractDateValue(currentValue, boundary) || todayText;
    const nextValue = composeScheduleValue("datetime", nextDate, nextTime);
    if (boundary === "start") {
      setScheduleStart(nextValue);
      return;
    }
    setScheduleEnd(nextValue);
  };

  return (
    <>
      {showSchedule ? (
        <div className={styles.overlay} onClick={() => setShowSchedule(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Schedule Settings</h2>
              <button className={styles.modalClose} type="button" onClick={() => setShowSchedule(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.scheduleModeBar}>
                <button
                  className={scheduleMode === "date" ? styles.scheduleModeChipActive : styles.scheduleModeChip}
                  type="button"
                  onClick={() => handleModeChange("date")}
                >
                  Date Only
                </button>
                <button
                  className={scheduleMode === "datetime" ? styles.scheduleModeChipActive : styles.scheduleModeChip}
                  type="button"
                  onClick={() => handleModeChange("datetime")}
                >
                  Date + Time
                </button>
                <span className={styles.scheduleTimezone}>WIB / GMT+7</span>
              </div>

              <div className={styles.scheduleGrid}>
                <div className={styles.scheduleCard}>
                  <label>
                    Start Date
                    <input
                      type="date"
                      value={extractDateValue(scheduleStart, "start")}
                      onChange={(e) => handleDateChange("start", e.target.value)}
                    />
                  </label>
                  {scheduleMode === "datetime" ? (
                    <TimePicker
                      label="Start Time"
                      value={extractTimeValue(scheduleStart, "start")}
                      onChange={(value) => handleTimeChange("start", value)}
                    />
                  ) : (
                    <div className={styles.scheduleNote}>Tanpa jam: mulai dihitung pukul 00:00 WIB.</div>
                  )}
                </div>

                <div className={styles.scheduleCard}>
                  <label>
                    End Date
                    <input
                      type="date"
                      value={extractDateValue(scheduleEnd, "end")}
                      onChange={(e) => handleDateChange("end", e.target.value)}
                    />
                  </label>
                  {scheduleMode === "datetime" ? (
                    <TimePicker
                      label="End Time"
                      value={extractTimeValue(scheduleEnd, "end")}
                      onChange={(value) => handleTimeChange("end", value)}
                    />
                  ) : (
                    <div className={styles.scheduleNote}>Tanpa jam: berakhir pukul 23:59 WIB.</div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnSecondary} type="button" onClick={() => setShowSchedule(false)}>
                Cancel
              </button>
              <button className={styles.modalBtnPrimary} type="button" onClick={() => setShowSchedule(false)}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStyle ? (
        <div className={styles.overlay} onClick={() => setShowStyle(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Style Settings</h2>
              <button className={styles.modalClose} type="button" onClick={() => setShowStyle(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <label>
                Hero Title
                <input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Survey hero title" />
              </label>
              <label>
                Hero Subtitle
                <input value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} placeholder="Survey hero subtitle" />
              </label>
              <label>
                Your Logo
                <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0], setLogo)} />
              </label>
              <label>
                Background Color
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </label>
              <label>
                Background Image
                <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0], setBgImage)} />
              </label>
              <label>
                Primary Color
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </label>
              <label>
                Secondary Color
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
              </label>
              <label>
                Font
                <select value={font} onChange={(e) => setFont(e.target.value as FontPreset)}>
                  <option value="default">Default</option>
                  <option value="georgia">Georgia</option>
                  <option value="trebuchet">Trebuchet MS</option>
                  <option value="verdana">Verdana</option>
                  <option value="tahoma">Tahoma</option>
                  <option value="courier">Courier New</option>
                </select>
              </label>
              <label>
                Button Style
                <select value={buttonStyle} onChange={(e) => setButtonStyle(e.target.value as "rounded" | "pill" | "square")}>
                  <option value="rounded">Rounded</option>
                  <option value="pill">Pill</option>
                  <option value="square">Square</option>
                </select>
              </label>
              <label>
                Show Progress Bar
                <select value={showProgressBar ? "yes" : "no"} onChange={(e) => setShowProgressBar(e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label>
                Show Page Numbers
                <select value={showPageNumbers ? "yes" : "no"} onChange={(e) => setShowPageNumbers(e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label>
                Multi Page
                <select value={multiPage ? "yes" : "no"} onChange={(e) => setMultiPage(e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnSecondary} type="button" onClick={() => setShowStyle(false)}>
                Cancel
              </button>
              <button className={styles.modalBtnPrimary} type="button" onClick={() => setShowStyle(false)}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
