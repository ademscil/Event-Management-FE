/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef } from "react";
import type { BusinessUnitOption, DepartmentOption, DivisionOption } from "@/lib/org-hierarchy";
import styles from "@/app/(admin)/admin/event-management/survey-create/survey-create.module.css";

type ElementType = "hero" | "text" | "choice" | "checkbox" | "dropdown" | "rating" | "likert" | "matrix" | "date" | "signature";
type DataSourceType = "manual" | "bu" | "division" | "department";

export interface PreviewElement {
  id: string;
  type: ElementType;
  title: string;
  subtitle: string;
  required: boolean;
  options: string[];
  coverUrl: string;
  dataSource?: DataSourceType;
}

function SignaturePad({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth || 640;
    const displayHeight = canvas.clientHeight || 180;
    canvas.width = Math.floor(displayWidth * ratio);
    canvas.height = Math.floor(displayHeight * ratio);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      };
      img.src = value;
    }
  }, [value]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onStart = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const p = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const onMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = getPoint(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const onEnd = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    onChange("");
  };

  return (
    <div className={styles.signatureWrap}>
      <canvas
        ref={canvasRef}
        className={styles.signatureCanvas}
        onPointerDown={onStart}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerLeave={onEnd}
      />
      <button type="button" className={styles.inlineButton} onClick={clear}>Clear Signature</button>
    </div>
  );
}

interface Props {
  element: PreviewElement;
  allElements: PreviewElement[];
  values: Record<string, unknown>;
  onSetValue: (id: string, value: unknown) => void;
  onSetValuesBulk: (values: Record<string, unknown>) => void;
  onToggleCheckbox: (id: string, option: string) => void;
  orgData: {
    businessUnits: BusinessUnitOption[];
    divisions: DivisionOption[];
    departments: DepartmentOption[];
  };
}

function inferProfileField(element: PreviewElement): "bu" | "division" | "department" | null {
  if (element.dataSource === "bu") return "bu";
  if (element.dataSource === "division") return "division";
  if (element.dataSource === "department") return "department";

  const title = (element.title || "").toLowerCase();
  if (title.includes("business unit") || title === "bu") return "bu";
  if (title.includes("divisi") || title.includes("division")) return "division";
  if (title.includes("department") || title.includes("departemen") || title.includes("dept")) return "department";
  return null;
}

export default function SurveyPreviewElement({ element, allElements, values, onSetValue, onSetValuesBulk, onToggleCheckbox, orgData }: Props) {
  const buElement = useMemo(() => allElements.find((item) => inferProfileField(item) === "bu"), [allElements]);
  const divisionElement = useMemo(() => allElements.find((item) => inferProfileField(item) === "division"), [allElements]);
  const departmentElement = useMemo(() => allElements.find((item) => inferProfileField(item) === "department"), [allElements]);

  const selectedBusinessUnit = buElement ? String(values[buElement.id] || "") : "";
  const selectedDivision = divisionElement ? String(values[divisionElement.id] || "") : "";
  const isCorporateHo = selectedBusinessUnit.trim().toLowerCase() === "corporate ho";

  const optionSet = useMemo(() => {
    if (element.type !== "dropdown") return element.options;

    const field = inferProfileField(element);
    if (field === "bu") {
      return element.dataSource === "bu"
        ? orgData.businessUnits.map((item) => item.Name)
        : element.options;
    }

    if (field === "division") {
      if (!selectedBusinessUnit) {
        return element.dataSource === "division"
          ? orgData.divisions.map((item) => item.Name)
          : element.options;
      }

      if (!isCorporateHo) {
        return [selectedBusinessUnit];
      }

      const bu = orgData.businessUnits.find((item) => item.Name.toLowerCase() === selectedBusinessUnit.toLowerCase());
      if (!bu) return element.options;

      return orgData.divisions
        .filter((item) => item.BusinessUnitId === bu.BusinessUnitId)
        .map((item) => item.Name);
    }

    if (field === "department") {
      if (!selectedBusinessUnit) {
        return element.dataSource === "department"
          ? orgData.departments.map((item) => item.Name)
          : element.options;
      }

      if (!isCorporateHo) {
        return [selectedBusinessUnit];
      }

      const bu = orgData.businessUnits.find((item) => item.Name.toLowerCase() === selectedBusinessUnit.toLowerCase());
      if (!bu) return element.options;

      const buDivisionIds = orgData.divisions
        .filter((item) => item.BusinessUnitId === bu.BusinessUnitId)
        .map((item) => item.DivisionId);

      let departmentPool = orgData.departments.filter((item) => buDivisionIds.includes(item.DivisionId));

      if (selectedDivision) {
        const selectedDivisionRow = orgData.divisions.find((item) => item.Name.toLowerCase() === selectedDivision.toLowerCase());
        if (selectedDivisionRow) {
          departmentPool = departmentPool.filter((item) => item.DivisionId === selectedDivisionRow.DivisionId);
        }
      }

      return departmentPool.map((item) => item.Name);
    }

    return element.options;
  }, [
    element,
    isCorporateHo,
    orgData.businessUnits,
    orgData.departments,
    orgData.divisions,
    selectedBusinessUnit,
    selectedDivision,
  ]);

  if (element.type === "hero") {
    return (
      <div className={styles.previewHero}>
        {element.coverUrl ? <img src={element.coverUrl} alt="hero" className={styles.previewHeroImage} /> : <div className={styles.previewHeroPlaceholder}>Hero image</div>}
        <div className={styles.previewHeroTitle}>{element.title || "Hero title"}</div>
        {element.subtitle ? <div className={styles.previewHeroSubtitle}>{element.subtitle}</div> : null}
      </div>
    );
  }

  if (element.type === "text") {
    return <input className={styles.previewInput} placeholder={element.title || "Text input"} value={String(values[element.id] || "")} onChange={(e) => onSetValue(element.id, e.target.value)} />;
  }

  if (element.type === "choice") {
    return (
      <div className={styles.previewOptions}>
        {element.options.map((option) => (
          <label key={`${element.id}-${option}`} className={styles.previewOptionItem}>
            <input type="radio" name={element.id} checked={values[element.id] === option} onChange={() => onSetValue(element.id, option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (element.type === "checkbox") {
    const selected = Array.isArray(values[element.id]) ? (values[element.id] as string[]) : [];
    return (
      <div className={styles.previewOptions}>
        {element.options.map((option) => (
          <label key={`${element.id}-${option}`} className={styles.previewOptionItem}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggleCheckbox(element.id, option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (element.type === "dropdown") {
    return (
      <select
        className={styles.previewSelect}
        value={String(values[element.id] || "")}
        onChange={(e) => {
          const value = e.target.value;
          onSetValue(element.id, value);

          const field = inferProfileField(element);
          if (field === "bu" && divisionElement && departmentElement) {
            if (!value) {
              onSetValuesBulk({
                [divisionElement.id]: "",
                [departmentElement.id]: "",
              });
              return;
            }

            if (value.trim().toLowerCase() !== "corporate ho") {
              onSetValuesBulk({
                [divisionElement.id]: value,
                [departmentElement.id]: value,
              });
            } else {
              onSetValuesBulk({
                [divisionElement.id]: "",
                [departmentElement.id]: "",
              });
            }
          }
        }}
      >
        <option value="">-- Select --</option>
        {optionSet.map((option) => <option key={`${element.id}-${option}`} value={option}>{option}</option>)}
      </select>
    );
  }

  if (element.type === "date") {
    return <input className={styles.previewInput} type="date" value={String(values[element.id] || "")} onChange={(e) => onSetValue(element.id, e.target.value)} />;
  }

  if (element.type === "rating") {
    const max = Math.min(10, Math.max(3, Number(element.options?.[0] || 5)));
    const current = Number(values[element.id] || 0);
    return (
      <div className={styles.previewRatingRow}>
        {Array.from({ length: max }, (_, idx) => idx + 1).map((n) => (
          <button key={`${element.id}-${n}`} type="button" className={`${styles.previewRateButton} ${current === n ? styles.previewRateButtonActive : ""}`} onClick={() => onSetValue(element.id, n)}>{n}</button>
        ))}
      </div>
    );
  }

  if (element.type === "likert") {
    const cols = ["1", "2", "3", "4", "5"];
    return (
      <div className={styles.previewMatrixWrap}>
        <table className={styles.previewMatrixTable}>
          <thead><tr><th>Statement</th>{cols.map((c) => <th key={`${element.id}-c-${c}`}>{c}</th>)}</tr></thead>
          <tbody>
            {element.options.map((row, rowIdx) => (
              <tr key={`${element.id}-r-${rowIdx}`}>
                <td>{row}</td>
                {cols.map((col) => {
                  const key = `${element.id}-${rowIdx}`;
                  return <td key={`${element.id}-${rowIdx}-${col}`}><input type="radio" name={key} checked={values[key] === col} onChange={() => onSetValue(key, col)} /></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (element.type === "matrix") {
    const cols = element.options.length > 0 ? element.options : ["Column 1", "Column 2"];
    const rows = ["Row 1", "Row 2", "Row 3"];
    return (
      <div className={styles.previewMatrixWrap}>
        <table className={styles.previewMatrixTable}>
          <thead><tr><th>Item</th>{cols.map((col, idx) => <th key={`${element.id}-m-c-${idx}`}>{col}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={`${element.id}-m-r-${rowIdx}`}>
                <td>{row}</td>
                {cols.map((_, colIdx) => {
                  const key = `${element.id}-m-${rowIdx}`;
                  const value = String(colIdx);
                  return <td key={`${element.id}-${rowIdx}-${colIdx}`}><input type="radio" name={key} checked={values[key] === value} onChange={() => onSetValue(key, value)} /></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (element.type === "signature") {
    return <SignaturePad value={typeof values[element.id] === "string" ? (values[element.id] as string) : ""} onChange={(value) => onSetValue(element.id, value)} />;
  }

  return null;
}
