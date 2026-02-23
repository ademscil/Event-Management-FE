"use client";

/* eslint-disable @next/next/no-img-element */

import { fetchSurveyById, updateEventById } from "@/lib/surveys";
import type { SurveyQuestion } from "@/types/survey";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./survey-create.module.css";

type ElementType = "hero" | "text" | "choice" | "checkbox" | "dropdown" | "rating" | "likert" | "matrix" | "date" | "signature";

type FontPreset = "default" | "georgia" | "trebuchet" | "verdana" | "tahoma" | "courier";

interface BuilderElement {
  id: string;
  type: ElementType;
  title: string;
  subtitle: string;
  required: boolean;
  options: string[];
  coverUrl: string;
}

interface BuilderPage {
  id: number;
  title: string;
  elements: BuilderElement[];
}

interface DraftPayload {
  surveyTitle: string;
  surveyDesc: string;
  targetRespondents: string;
  targetScore: string;
  scheduleStart: string;
  scheduleEnd: string;
  pages: BuilderPage[];
  style: { logo: string; backgroundColor: string; backgroundImage: string; font: FontPreset };
}

const FONT_MAP: Record<FontPreset, string> = {
  default: "inherit",
  georgia: 'Georgia, "Times New Roman", serif',
  trebuchet: '"Trebuchet MS", "Lucida Sans Unicode", sans-serif',
  verdana: "Verdana, Geneva, sans-serif",
  tahoma: "Tahoma, Geneva, sans-serif",
  courier: '"Courier New", Courier, monospace',
};

const ELEMENTS: Array<{ type: ElementType; label: string; icon: string }> = [
  { type: "hero", label: "Hero Cover", icon: "\u25A8" },
  { type: "text", label: "Text Input", icon: "T" },
  { type: "choice", label: "Multiple Choice", icon: "\u25CF" },
  { type: "checkbox", label: "Checkboxes", icon: "\u2611" },
  { type: "dropdown", label: "Dropdown", icon: "\u25BE" },
  { type: "rating", label: "Rating", icon: "\u2605" },
  { type: "likert", label: "Likert Scale", icon: "\u2261" },
  { type: "matrix", label: "Matrix", icon: "\u229E" },
  { type: "date", label: "Date", icon: "\u25F7" },
  { type: "signature", label: "Signature", icon: "\u270E" },
];

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mapType(value: string): ElementType {
  if (value === "HeroCover") return "hero";
  if (value === "MultipleChoice") return "choice";
  if (value === "Checkbox") return "checkbox";
  if (value === "Dropdown") return "dropdown";
  if (value === "Rating") return "rating";
  if (value === "MatrixLikert") return "likert";
  if (value === "Date") return "date";
  if (value === "Signature") return "signature";
  return "text";
}

function parseOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (raw && typeof raw === "object") {
    const data = raw as { options?: unknown[] };
    if (Array.isArray(data.options)) return data.options.map((v) => String(v));
  }
  return ["Option 1"];
}

function toPages(questions?: SurveyQuestion[]): BuilderPage[] {
  if (!questions || questions.length === 0) return [];
  const map = new Map<number, BuilderElement[]>();
  questions.forEach((q, idx) => {
    const page = q.PageNumber || 1;
    if (!map.has(page)) map.set(page, []);
    map.get(page)?.push({
      id: q.QuestionId ? `q-${q.QuestionId}` : `q-${idx + 1}`,
      type: mapType(q.Type),
      title: q.PromptText || "",
      subtitle: q.Subtitle || "",
      required: Boolean(q.IsMandatory),
      options: parseOptions(q.Options),
      coverUrl: "",
    });
  });
  return Array.from(map.entries()).sort(([a],[b])=>a-b).map(([id,elements]) => ({ id, title: id===1?"Welcome":`Page ${id}`, elements }));
}

function newElement(type: ElementType, id: number): BuilderElement {
  return { id: `new-${id}`, type, title: type === "hero" ? "Hero title" : "Question", subtitle: "", required: false, options: ["Option 1"], coverUrl: "" };
}

function getCorpTemplatePages(): BuilderPage[] {
  return [
    {
      id: 1,
      title: "Welcome",
      elements: [
        {
          id: "tpl-hero-1",
          type: "hero",
          title: "Corporate IT & BPM Survey 2026",
          subtitle: "",
          required: false,
          options: [],
          coverUrl: "",
        },
      ],
    },
    {
      id: 2,
      title: "Profil Responden",
      elements: [
        {
          id: "tpl-dropdown-1",
          type: "dropdown",
          title: "Business Unit",
          subtitle: "",
          required: true,
          options: ["Corporate", "Main Dealer", "Logistics"],
          coverUrl: "",
        },
      ],
    },
  ];
}

export default function SurveyCreatePage() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId") || "";
  const draftKey = useMemo(() => `survey_draft_${surveyId}`, [surveyId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyDesc, setSurveyDesc] = useState("");
  const [targetRespondents, setTargetRespondents] = useState("");
  const [targetScore, setTargetScore] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");

  const [pages, setPages] = useState<BuilderPage[]>([]);
  const [pageCounter, setPageCounter] = useState(0);
  const [elementCounter, setElementCounter] = useState(0);

  const [logo, setLogo] = useState("");
  const [bgColor, setBgColor] = useState("#f5f5f5");
  const [bgImage, setBgImage] = useState("");
  const [font, setFont] = useState<FontPreset>("default");

  const [showSchedule, setShowSchedule] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!surveyId) {
        setError("surveyId tidak valid");
        setLoading(false);
        return;
      }

      const result = await fetchSurveyById(surveyId);
      setLoading(false);
      if (!result.success || !result.survey) {
        setError(result.message || "Gagal memuat survey");
        return;
      }

      const detail = result.survey;
      setSurveyTitle(detail.Title || "");
      setSurveyDesc(detail.Description || "");
      setTargetRespondents(detail.TargetRespondents != null ? String(detail.TargetRespondents) : "");
      setTargetScore(detail.TargetScore != null ? String(detail.TargetScore) : "");
      setScheduleStart(toDateInput(detail.StartDate));
      setScheduleEnd(toDateInput(detail.EndDate));
      setBgColor(detail.configuration?.BackgroundColor || "#f5f5f5");

      const local = localStorage.getItem(draftKey);
      if (local) {
        try {
          const draft = JSON.parse(local) as DraftPayload;
          setSurveyTitle(draft.surveyTitle || detail.Title || "");
          setSurveyDesc(draft.surveyDesc || detail.Description || "");
          setTargetRespondents(draft.targetRespondents || "");
          setTargetScore(draft.targetScore || "");
          setScheduleStart(draft.scheduleStart || toDateInput(detail.StartDate));
          setScheduleEnd(draft.scheduleEnd || toDateInput(detail.EndDate));
          setPages(Array.isArray(draft.pages) ? draft.pages : []);
          setLogo(draft.style?.logo || "");
          setBgColor(draft.style?.backgroundColor || "#f5f5f5");
          setBgImage(draft.style?.backgroundImage || "");
          setFont(draft.style?.font || "default");
          return;
        } catch {
          // ignore
        }
      }

      const fromDb = toPages(detail.questions);
      if (
        fromDb.length === 0 &&
        (detail.Title || "").toLowerCase().includes("corp it") &&
        (detail.Title || "").toLowerCase().includes("bpm")
      ) {
        const templatePages = getCorpTemplatePages();
        setPages(templatePages);
        setPageCounter(templatePages.length);
        setElementCounter(2);
        return;
      }

      setPages(fromDb);
      setPageCounter(fromDb.length ? Math.max(...fromDb.map((p) => p.id)) : 0);
    };

    void run();
  }, [draftKey, surveyId]);

  const scheduleSummary = useMemo(() => {
    if (!scheduleStart || !scheduleEnd) return "Period not set";
    return `Period: ${scheduleStart} - ${scheduleEnd}`;
  }, [scheduleEnd, scheduleStart]);

  const styleSummary = useMemo(() => `Logo: ${logo ? "On" : "Off"} | Background: ${bgColor} | Font: ${font === "default" ? "Default" : font}`, [bgColor, font, logo]);

  const addPage = () => {
    const next = pageCounter + 1;
    setPageCounter(next);
    setPages((prev) => [...prev, { id: next, title: next === 1 ? "Welcome" : `Page ${next}`, elements: [] }]);
  };

  const addElement = (pageId: number, type: ElementType) => {
    const next = elementCounter + 1;
    setElementCounter(next);
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, elements: [...p.elements, newElement(type, next)] } : p)));
  };

  const saveDraft = async () => {
    const payload: DraftPayload = {
      surveyTitle,
      surveyDesc,
      targetRespondents,
      targetScore,
      scheduleStart,
      scheduleEnd,
      pages,
      style: { logo, backgroundColor: bgColor, backgroundImage: bgImage, font },
    };

    localStorage.setItem(draftKey, JSON.stringify(payload));

    setSaving(true);
    const update = await updateEventById(surveyId, {
      title: surveyTitle || "Untitled Survey",
      description: surveyDesc,
      startDate: new Date(scheduleStart || new Date().toISOString()).toISOString(),
      endDate: new Date(scheduleEnd || new Date().toISOString()).toISOString(),
      status: "Draft",
      targetRespondents: targetRespondents ? Number(targetRespondents) : null,
      targetScore: targetScore ? Number(targetScore) : null,
    });
    setSaving(false);

    if (!update.success) {
      setError(update.message || "Draft lokal tersimpan, sinkron server gagal");
      return;
    }

    setMessage("Draft tersimpan");
  };

  const publish = async () => {
    if (pages.length === 0) {
      setError("Minimal ada 1 page sebelum publish");
      return;
    }

    setPublishing(true);
    const update = await updateEventById(surveyId, {
      title: surveyTitle || "Untitled Survey",
      description: surveyDesc,
      startDate: new Date(scheduleStart || new Date().toISOString()).toISOString(),
      endDate: new Date(scheduleEnd || new Date().toISOString()).toISOString(),
      status: "In Design",
      targetRespondents: targetRespondents ? Number(targetRespondents) : null,
      targetScore: targetScore ? Number(targetScore) : null,
    });
    setPublishing(false);

    if (!update.success) {
      setError(update.message || "Gagal publish");
      return;
    }

    setMessage("Survey dipublish menjadi In Design");
  };

  const onFile = (file: File | undefined, setter: (value: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  if (loading) return <section className={styles.loading}>Memuat survey builder...</section>;

  return (
    <section className={styles.wrapper}>
      {error ? <div className={styles.alertError}>{error}</div> : null}
      {message ? <div className={styles.alertSuccess}>{message}</div> : null}

      <div className={styles.builder}>
        <aside className={styles.builderSidebar}>
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarTitle}>Add Elements</div>
            {ELEMENTS.map((item) => (
              <button
                key={item.type}
                className={styles.typeBtn}
                onClick={() => {
                  if (pages.length === 0) addPage();
                  const pageId = pages.length ? pages[pages.length - 1].id : pageCounter + 1;
                  addElement(pageId, item.type);
                }}
                type="button"
              >
                <span className={styles.typeIcon}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarTitle}>Templates</div>
            <button className={styles.sideAction} type="button" onClick={() => setMessage("Load Template: WIP")}>Load Template</button>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarTitle}>Actions</div>
            <Link className={styles.sideAction} href="/admin/event-management">Back to Event Management</Link>
            <button className={styles.sideAction} type="button" onClick={() => setShowPreview(true)}>Preview</button>
            <button className={styles.sideAction} type="button" onClick={() => void saveDraft()} disabled={saving}>{saving ? "Saving..." : "Save Draft"}</button>
            <button className={styles.sideActionPrimary} type="button" onClick={() => void publish()} disabled={publishing}>{publishing ? "Publishing..." : "Publish"}</button>
          </div>
        </aside>

        <main className={styles.builderMain} style={{ backgroundColor: bgColor, backgroundImage: bgImage ? `url(${bgImage})` : "none", fontFamily: FONT_MAP[font] }}>
          <div className={styles.canvas}>
            <div className={styles.topbar}>
              <div className={styles.topLeft}><div className={styles.topTitle}>Survey Builder</div><div className={styles.topSub}>{scheduleSummary}</div></div>
              <div className={styles.topCenter}>
                <div className={styles.targetCard}>
                  <div className={styles.targetTitle}>Target Survey</div>
                  <div className={styles.targetGrid}>
                    <label>Target Responden<input type="number" placeholder="Contoh: 100" value={targetRespondents} onChange={(e)=>setTargetRespondents(e.target.value)} /></label>
                    <label>Target Score (1-10)<input type="number" min={1} max={10} step="0.1" placeholder="Contoh: 8.5" value={targetScore} onChange={(e)=>setTargetScore(e.target.value)} /></label>
                  </div>
                </div>
              </div>
              <div className={styles.topActions}>
                <button className={styles.inlineButton} type="button" onClick={() => setShowSchedule(true)}>Settings</button>
                <button className={styles.inlineButton} type="button" onClick={() => setShowStyle(true)}>Style</button>
              </div>
            </div>

            <div className={styles.brandPreview}>
              <div className={styles.brandLogo}>{logo ? <img src={logo} alt="Logo" /> : <span>Your Logo</span>}</div>
              <div><div className={styles.brandLabel}>Style Preview</div><div className={styles.brandText}>{styleSummary}</div></div>
            </div>

            <div className={styles.surveyCard}>
              <input className={styles.surveyTitle} placeholder="Survey Title" value={surveyTitle} onChange={(e)=>setSurveyTitle(e.target.value)} />
              <input className={styles.surveyDesc} placeholder="Survey description" value={surveyDesc} onChange={(e)=>setSurveyDesc(e.target.value)} />
            </div>

            <div className={styles.pagesWrap}>
              {pages.length === 0 ? <div className={styles.emptyPage}>No pages yet. Use Add Page to get started.</div> : null}

              {pages.map((page) => (
                <article key={page.id} className={styles.pageCard}>
                  <div className={styles.pageHeader}>
                    <div className={styles.pageTitleWrap}><span className={styles.drag}>?</span><input value={page.title} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,title:e.target.value}:p))} className={styles.pageTitleInput} /></div>
                    <button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.filter((p)=>p.id!==page.id))}>Delete Page</button>
                  </div>

                  {page.elements.map((el) => (
                    <div key={el.id} className={styles.elementCard}>
                      <div className={styles.elementType}>{el.type}</div>
                      <input className={styles.questionInput} value={el.title} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,title:e.target.value}:item)}:p))} placeholder="Question" />
                      <input className={styles.questionSub} value={el.subtitle} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,subtitle:e.target.value}:item)}:p))} placeholder="Subtitle (optional)" />

                      {el.type === "hero" ? (
                        <label className={styles.coverUpload}>
                          {el.coverUrl ? <img src={el.coverUrl} alt="cover" className={styles.coverImg} /> : "Click to upload cover image"}
                          <input type="file" accept="image/*" onChange={(ev)=>onFile(ev.target.files?.[0], (value)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,coverUrl:value}:item)}:p)))} />
                        </label>
                      ) : null}

                      {(["choice","checkbox","dropdown"] as ElementType[]).includes(el.type) ? (
                        <div className={styles.optionList}>
                          {el.options.map((opt, idx) => (
                            <div key={`${el.id}-${idx}`} className={styles.optionRow}><input value={opt} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.map((ov,oi)=>oi===idx?e.target.value:ov)}:item)}:p))} /><button type="button" className={styles.optionDelete} onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.length>1?item.options.filter((_,oi)=>oi!==idx):item.options}:item)}:p))}>×</button></div>
                          ))}
                          <button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:[...item.options,`Option ${item.options.length+1}`]}:item)}:p))}>+ Add option</button>
                        </div>
                      ) : null}

                      <div className={styles.elementActions}><label><input type="checkbox" checked={el.required} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,required:e.target.checked}:item)}:p))} /> Required</label><button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.filter((item)=>item.id!==el.id)}:p))}>Delete</button></div>
                    </div>
                  ))}

                  <div className={styles.addElement}><select defaultValue="" onChange={(e)=>{const value=e.target.value as ElementType; if(!value)return; addElement(page.id,value); e.target.value="";}}><option value="">+ Add Element</option>{ELEMENTS.map((item)=><option key={`${page.id}-${item.type}`} value={item.type}>{item.label}</option>)}</select></div>
                </article>
              ))}

              <button className={styles.addPage} type="button" onClick={addPage}>+ Add Page</button>
            </div>
          </div>
        </main>
      </div>

      {showSchedule ? <div className={styles.overlay} onClick={()=>setShowSchedule(false)}><div className={styles.modal} onClick={(e)=>e.stopPropagation()}><div className={styles.modalHead}><h2>Schedule Settings</h2><button className={styles.inlineButton} type="button" onClick={()=>setShowSchedule(false)}>Close</button></div><div className={styles.modalBody}><label>Start Date<input type="date" value={scheduleStart} onChange={(e)=>setScheduleStart(e.target.value)} /></label><label>End Date<input type="date" value={scheduleEnd} onChange={(e)=>setScheduleEnd(e.target.value)} /></label></div></div></div> : null}

      {showStyle ? <div className={styles.overlay} onClick={()=>setShowStyle(false)}><div className={styles.modal} onClick={(e)=>e.stopPropagation()}><div className={styles.modalHead}><h2>Style Settings</h2><button className={styles.inlineButton} type="button" onClick={()=>setShowStyle(false)}>Close</button></div><div className={styles.modalBody}><label>Your Logo<input type="file" accept="image/*" onChange={(e)=>onFile(e.target.files?.[0],setLogo)} /></label><label>Background Color<input type="color" value={bgColor} onChange={(e)=>setBgColor(e.target.value)} /></label><label>Background Image<input type="file" accept="image/*" onChange={(e)=>onFile(e.target.files?.[0],setBgImage)} /></label><label>Font<select value={font} onChange={(e)=>setFont(e.target.value as FontPreset)}><option value="default">Default</option><option value="georgia">Georgia</option><option value="trebuchet">Trebuchet MS</option><option value="verdana">Verdana</option><option value="tahoma">Tahoma</option><option value="courier">Courier New</option></select></label></div></div></div> : null}

      {showPreview ? <div className={styles.overlay} onClick={()=>setShowPreview(false)}><div className={styles.preview} onClick={(e)=>e.stopPropagation()}><div className={styles.modalHead}><h2>Survey Preview</h2><button className={styles.inlineButton} type="button" onClick={()=>setShowPreview(false)}>Back to Builder</button></div><div className={styles.previewBody}><h3>{surveyTitle || "Survey Title"}</h3><p>{surveyDesc || "Survey description"}</p>{pages.map((p)=><div key={`pv-${p.id}`} className={styles.previewPage}><h4>{p.title}</h4>{p.elements.map((el)=><div key={`pve-${el.id}`} className={styles.previewQuestion}><div>{el.title || "Question"}{el.required ? " *" : ""}</div>{el.subtitle ? <small>{el.subtitle}</small> : null}</div>)}</div>)}</div></div></div> : null}
    </section>
  );
}






