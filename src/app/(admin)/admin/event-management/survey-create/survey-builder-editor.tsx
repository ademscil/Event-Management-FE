"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { DragEvent } from "react";
import styles from "./survey-create.module.css";
import { FONT_MAP, ELEMENTS, sanitizeSurveyDescription, type BuilderElement, type BuilderPage, type DataSourceType, type ElementType, type FontPreset } from "./builder-definitions";

interface SurveyBuilderEditorProps {
  addElement: (pageId: number, type: ElementType) => void;
  addElementToLastPage: (type: ElementType) => void;
  addPage: () => void;
  applyMasterDataSource: (source: DataSourceType, element: BuilderElement) => BuilderElement;
  bgColor: string;
  bgImage: string;
  brandStyleSummary: string;
  buttonStyle: "rounded" | "pill" | "square";
  dragOverPageId: number | null;
  draggingPageId: number | null;
  font: FontPreset;
  hasMappedSelectorInPage: (elements: BuilderElement[]) => boolean;
  heroSubtitle: string;
  heroTitle: string;
  loadingSave: boolean;
  loadingPublish: boolean;
  logo: string;
  moveElementWithinPage: (pageId: number, elementIndex: number, direction: "up" | "down") => void;
  onFile: (file: File | undefined, setter: (value: string) => void) => void;
  onPageDragEnd: () => void;
  onPageDragOver: (pageId: number) => (event: DragEvent) => void;
  onPageDragStart: (pageId: number) => (event: DragEvent) => void;
  onPageDrop: (pageId: number) => (event: DragEvent) => void;
  openPreview: () => void;
  openSchedule: () => void;
  openStyle: () => void;
  openTemplatePicker: () => void;
  pages: BuilderPage[];
  primaryColor: string;
  publish: () => Promise<void>;
  removePage: (pageId: number) => void;
  saveDraft: () => Promise<void>;
  scheduleSummary: string;
  secondaryColor: string;
  setPages: React.Dispatch<React.SetStateAction<BuilderPage[]>>;
  setPreviewValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  setSurveyDesc: (value: string) => void;
  setSurveyTitle: (value: string) => void;
  setTargetRespondents: (value: string) => void;
  setTargetScore: (value: string) => void;
  shouldShowVisibilityControl: (elements: BuilderElement[], elementIndex: number) => boolean;
  surveyDesc: string;
  surveyTitle: string;
  targetRespondents: string;
  targetScore: string;
}

export default function SurveyBuilderEditor({
  addElement,
  addElementToLastPage,
  addPage,
  applyMasterDataSource,
  bgColor,
  bgImage,
  brandStyleSummary,
  dragOverPageId,
  draggingPageId,
  font,
  hasMappedSelectorInPage,
  heroSubtitle,
  heroTitle,
  loadingPublish,
  loadingSave,
  logo,
  moveElementWithinPage,
  onFile,
  onPageDragEnd,
  onPageDragOver,
  onPageDragStart,
  onPageDrop,
  openPreview,
  openSchedule,
  openStyle,
  openTemplatePicker,
  pages,
  publish,
  removePage,
  saveDraft,
  scheduleSummary,
  setPages,
  setPreviewValues,
  setSurveyDesc,
  setSurveyTitle,
  setTargetRespondents,
  setTargetScore,
  shouldShowVisibilityControl,
  surveyDesc,
  surveyTitle,
  targetRespondents,
  targetScore,
}: SurveyBuilderEditorProps) {
  return (
    <div className={styles.builder}>
      <aside className={styles.builderSidebar}>
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarTitle}>Add Elements</div>
          {ELEMENTS.map((item) => (
            <button
              key={item.type}
              className={styles.typeBtn}
              onClick={() => addElementToLastPage(item.type)}
              type="button"
            >
              <span className={styles.typeIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sidebarTitle}>Templates</div>
          <button className={styles.sideAction} type="button" onClick={openTemplatePicker}>Load Template</button>
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sidebarTitle}>Actions</div>
          <Link className={styles.sideAction} href="/admin/event-management">Back to Event Management</Link>
          <button className={styles.sideAction} type="button" onClick={openPreview}>Preview</button>
          <button className={styles.sideAction} type="button" onClick={() => void saveDraft()} disabled={loadingSave}>{loadingSave ? "Saving..." : "Save Draft"}</button>
          <button className={styles.sideActionPrimary} type="button" onClick={() => void publish()} disabled={loadingPublish}>{loadingPublish ? "Publishing..." : "Publish"}</button>
        </div>
      </aside>

      <main className={styles.builderMain} style={{ backgroundColor: bgColor, backgroundImage: bgImage ? `url(${bgImage})` : "none", fontFamily: FONT_MAP[font] }}>
        <div className={styles.canvas}>
          <div className={styles.topbar}>
            <div className={styles.topLeft}>
              <div className={styles.topTitle}>Survey Builder</div>
              <div className={styles.topSub}>{scheduleSummary}</div>
            </div>
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
              <button className={styles.inlineButton} type="button" onClick={openSchedule}>Settings</button>
              <button className={styles.inlineButton} type="button" onClick={openStyle}>Style</button>
            </div>
          </div>

          <div className={styles.pagesWrap}>
            {pages.length === 0 ? <div className={styles.emptyPage}>No pages yet. Use Add Page to get started.</div> : null}

            {pages.map((page) => {
              // Cek apakah page ini hanya berisi HeroCover
              const isHeroCoverOnlyPage = page.elements.length > 0 && page.elements.every((el) => el.type === "hero");

              return (
              <article key={page.id} className={[styles.pageCard, draggingPageId === page.id ? styles.pageCardDragging : "", dragOverPageId === page.id && draggingPageId !== page.id ? styles.pageCardDragOver : ""].join(" ")} onDragOver={onPageDragOver(page.id)} onDrop={onPageDrop(page.id)}>
                <div className={styles.pageHeader}>
                  <div className={styles.pageTitleWrap}>
                    <span className={styles.drag} draggable onDragStart={onPageDragStart(page.id)} onDragEnd={onPageDragEnd} aria-label="Drag page">{"\u2630"}</span>
                    <input
                      value={page.title}
                      onChange={(e) => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, title: e.target.value } : p))}
                      className={styles.pageTitleInput}
                      placeholder=""
                    />
                  </div>
                  <button className={styles.inlineButton} type="button" onClick={() => removePage(page.id)}>Delete Page</button>
                </div>

                {page.elements.map((el, elIndex) => (
                  <div key={`${el.id}-${elIndex}`} className={styles.elementCard}>
                    <div className={styles.elementType}>{el.type}</div>
                    <input className={styles.questionInput} value={el.title} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,title:e.target.value}:item)}:p))} placeholder="Question" />
                    <input className={styles.questionSub} value={el.subtitle} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,subtitle:e.target.value}:item)}:p))} placeholder="Subtitle (optional)" />

                    {el.type === "text" ? <div className={styles.builderFieldPreview}><input className={styles.builderFieldInput} type="text" disabled placeholder={el.title || "Text input"} /></div> : null}
                    {el.type === "date" ? <div className={styles.builderFieldPreview}><input className={styles.builderFieldInput} type="date" disabled /></div> : null}
                    {el.type === "signature" ? <div className={styles.builderFieldPreview}><div className={styles.builderSignatureBox}>Klik tombol di bawah untuk menandatangani</div><button type="button" className={styles.inlineButton} disabled>Tanda Tangan</button></div> : null}

                    {el.type === "hero" ? (
                      <label className={styles.coverUpload}>
                        {el.coverUrl ? <img src={el.coverUrl} alt="cover" className={styles.coverImg} /> : "Click to upload cover image"}
                        <input type="file" accept="image/*" onChange={(ev)=>onFile(ev.target.files?.[0], (value)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,coverUrl:value}:item)}:p)))} />
                      </label>
                    ) : null}

                    {(["choice","checkbox","dropdown"] as ElementType[]).includes(el.type) ? (
                      <div className={styles.optionList}>
                        <div className={styles.dataSourcePanel}>
                          <label className={styles.dataSourceLabel}>Data Source:</label>
                          <select
                            className={styles.dataSourceSelect}
                            value={el.dataSource || "manual"}
                            onChange={(e) => {
                              const selected = e.target.value as DataSourceType;
                              setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, elements: p.elements.map((item) => item.id === el.id ? applyMasterDataSource(selected, item) : item) } : p));
                            }}
                          >
                            <option value="manual">Manual Input</option>
                            <option value="bu">Master: Business Unit</option>
                            <option value="division">Master: Division</option>
                            <option value="department">Master: Department</option>
                            <option value="function">Master: Function</option>
                            <option value="app_department">Mapped: Applications by Department</option>
                            <option value="app_function">Mapped: Applications by Function</option>
                          </select>
                          {el.dataSource && el.dataSource !== "manual" ? <span className={styles.dataSourceBadge}>Using master data</span> : null}
                        </div>

                        {el.options.map((opt, idx) => (
                          <div key={`${el.id}-${idx}`} className={styles.optionRow}>
                            <input value={opt} disabled={el.dataSource !== "manual"} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.map((ov,oi)=>oi===idx?e.target.value:ov)}:item)}:p))} />
                            <button type="button" className={styles.optionDelete} disabled={el.dataSource !== "manual"} onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.length>1?item.options.filter((_,oi)=>oi!==idx):item.options}:item)}:p))}>{"\u00D7"}</button>
                          </div>
                        ))}

                        {el.dataSource === "manual" ? <button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:[...item.options,`Option ${item.options.length+1}`]}:item)}:p))}>+ Add option</button> : null}
                        {el.dataSource === "app_department" ? <div className={styles.mappingHint}>Options akan diisi otomatis dari mapping aplikasi berdasarkan Department yang dipilih di preview.</div> : null}
                        {el.dataSource === "app_function" ? <div className={styles.mappingHint}>Options akan diisi otomatis dari mapping aplikasi berdasarkan Function yang dipilih di preview.</div> : null}

                        {(el.type === "choice" || el.type === "checkbox") ? (
                          <div className={styles.settingPanel}>
                            <div className={styles.settingRow}>
                              <label className={styles.settingLabel}>Layout</label>
                              <select className={styles.settingSelect} value={el.optionLayout || "vertical"} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,optionLayout:e.target.value as "vertical" | "horizontal"}:item)}:p))}>
                                <option value="vertical">Vertical</option>
                                <option value="horizontal">Horizontal</option>
                              </select>
                            </div>
                            {el.type === "choice" ? (
                              <div className={styles.settingRow}>
                                <span className={styles.settingLabel}>Selection</span>
                                <label className={styles.settingCheckLabel}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(el.allowMultipleAnswers)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,allowMultipleAnswers:checked}:item)}:p));
                                      if (!checked) {
                                        setPreviewValues((prev) => {
                                          const current = prev[el.id];
                                          if (!Array.isArray(current)) return prev;
                                          return { ...prev, [el.id]: current[0] || "" };
                                        });
                                      }
                                    }}
                                  />
                                  Allow multiple answers
                                </label>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {shouldShowVisibilityControl(page.elements, elIndex) && hasMappedSelectorInPage(page.elements) ? (
                      <div className={styles.settingPanel}>
                        <div className={styles.settingRow}>
                          <label className={styles.settingLabel}>Visibility</label>
                          <select className={styles.settingSelect} value={el.displayCondition || "always"} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,displayCondition:e.target.value as "always" | "after_mapped_selection"}:item)}:p))}>
                            <option value="always">Always show</option>
                            <option value="after_mapped_selection">Show after mapped app selected</option>
                          </select>
                        </div>
                      </div>
                    ) : null}

                    {el.type === "rating" ? (
                      <div className={styles.optionList}>
                        <div className={styles.optionRow}>
                          <label style={{ fontSize: "12px", color: "#374151", minWidth: "120px" }}>Rating Scale</label>
                          <input type="number" min={3} max={10} value={el.options[0] || "10"} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:[e.target.value || "10"]}:item)}:p))} />
                        </div>
                      </div>
                    ) : null}

                    {(["likert", "matrix"] as ElementType[]).includes(el.type) ? (
                      <div className={styles.optionList}>
                        {el.type === "likert" ? (
                          <>
                            <div className={styles.optionRow}>
                              <label style={{ fontSize: "12px", color: "#374151", minWidth: "120px" }}>Rating Scale</label>
                              <input
                                type="number" min={1} max={10}
                                value={el.ratingScale ?? 10}
                                onChange={(e) => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, elements: p.elements.map((item) => item.id === el.id ? { ...item, ratingScale: Math.min(10, Math.max(1, Number(e.target.value || 10))) } : item) } : p))}
                              />
                            </div>
                            <div className={styles.optionRow}>
                              <label style={{ fontSize: "12px", color: "#374151", minWidth: "120px" }}>
                                Komentar per Statement
                              </label>
                              <label className={styles.settingCheckLabel} style={{ minHeight: "auto" }}>
                                <input
                                  type="checkbox"
                                  checked={el.likertEnableComment !== false}
                                  onChange={(e) => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, elements: p.elements.map((item) => item.id === el.id ? { ...item, likertEnableComment: e.target.checked } : item) } : p))}
                                />
                                Tampilkan textbox komentar di bawah setiap statement
                              </label>
                            </div>
                            {el.likertEnableComment !== false ? (
                              <div className={styles.optionRow}>
                                <label style={{ fontSize: "12px", color: "#374151", minWidth: "120px" }}>
                                  Komentar Wajib jika Nilai &lt;
                                </label>
                                <input
                                  type="number" min={1} max={10}
                                  value={el.likertCommentThreshold ?? 7}
                                  onChange={(e) => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, elements: p.elements.map((item) => item.id === el.id ? { ...item, likertCommentThreshold: Math.min(10, Math.max(1, Number(e.target.value || 7))) } : item) } : p))}
                                />
                                <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: 4 }}>
                                  (1–10, default 7)
                                </span>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {el.options.map((opt, idx) => (
                          <div key={`${el.id}-${idx}`} className={styles.optionRow}>
                            <input value={opt} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.map((ov,oi)=>oi===idx?e.target.value:ov)}:item)}:p))} />
                            <button type="button" className={styles.optionDelete} onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.length>1?item.options.filter((_,oi)=>oi!==idx):item.options}:item)}:p))}>{"\u00D7"}</button>
                          </div>
                        ))}
                        <button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:[...item.options,el.type==="likert"?`Statement ${item.options.length+1}`:`Column ${item.options.length+1}`]}:item)}:p))}>+ Add {el.type === "likert" ? "statement" : "column"}</button>
                      </div>
                    ) : null}

                    {el.type === "text" ? (
                      <div className={styles.settingPanel}>
                        {(() => {
                          const ratingCandidates = page.elements.filter((item, idx) => idx < elIndex && (item.type === "rating" || item.type === "likert"));
                          const hasCandidates = ratingCandidates.length > 0;
                          const thresholdValue = Math.min(10, Math.max(1, Math.round(Number(el.conditionalRequiredThreshold || 7))));
                          const enabled = Boolean(el.conditionalRequiredSourceId);
                          const selectedSourceId = hasCandidates
                            ? (el.conditionalRequiredSourceId && ratingCandidates.some((item) => item.id === el.conditionalRequiredSourceId)
                              ? el.conditionalRequiredSourceId
                              : ratingCandidates[ratingCandidates.length - 1].id)
                            : "";

                          return (
                            <>
                              <div className={styles.settingRow}>
                                <label className={styles.settingLabel}>Comment Rule</label>
                                <label className={styles.settingCheckLabel}>
                                  <input type="checkbox" disabled={!hasCandidates} checked={enabled} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,conditionalRequiredSourceId:e.target.checked ? (selectedSourceId || undefined) : undefined,conditionalRequiredThreshold:e.target.checked ? thresholdValue : undefined}:item)}:p))} />
                                  <span>Wajib isi jika score di bawah threshold</span>
                                </label>
                              </div>
                              {!hasCandidates ? <div className={styles.settingHint}>Tambahkan elemen rating/likert di atas komentar ini agar rule bisa diaktifkan.</div> : null}
                              {enabled && hasCandidates ? (
                                <>
                                  <div className={styles.settingRow}>
                                    <label className={styles.settingLabel}>Score Source</label>
                                    <select className={styles.settingSelect} value={el.conditionalRequiredSourceId || selectedSourceId} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,conditionalRequiredSourceId:e.target.value || undefined}:item)}:p))}>
                                      {ratingCandidates.map((item, idx) => (
                                        <option key={`${el.id}-rating-source-${item.id}`} value={item.id}>
                                          {item.title || `${item.type === "likert" ? "Likert" : "Rating"} ${idx + 1}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className={styles.settingRow}>
                                    <label className={styles.settingLabel}>Threshold</label>
                                    <input className={styles.settingSelect} type="number" min={1} max={10} value={thresholdValue} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,conditionalRequiredThreshold:Math.min(10, Math.max(1, Number(e.target.value || 7)))}:item)}:p))} />
                                  </div>
                                </>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    ) : null}

                    <div className={styles.elementActions}>
                      <label><input type="checkbox" checked={el.required} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,required:e.target.checked}:item)}:p))} />{" "}Required</label>
                      <div className={styles.elementReorder}>
                        <button type="button" className={styles.inlineButton} disabled={elIndex === 0} onClick={() => moveElementWithinPage(page.id, elIndex, "up")}>Move Up</button>
                        <button type="button" className={styles.inlineButton} disabled={elIndex === page.elements.length - 1} onClick={() => moveElementWithinPage(page.id, elIndex, "down")}>Move Down</button>
                      </div>
                      <button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.filter((item)=>item.id!==el.id)}:p))}>Delete</button>
                    </div>
                  </div>
                ))}

                <div className={styles.addElement}><select defaultValue="" onChange={(e)=>{const value=e.target.value as ElementType; if(!value)return; addElement(page.id,value); e.target.value="";}}><option value="">+ Add Element</option>{ELEMENTS.map((item)=><option key={`${page.id}-${item.type}`} value={item.type}>{item.label}</option>)}</select></div>
              </article>
            )})}

            <button className={styles.addPage} type="button" onClick={addPage}>+ Add Page</button>
          </div>
        </div>
      </main>
    </div>
  );
}
