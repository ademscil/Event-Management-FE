"use client";

import type { BuilderTemplate, ElementType } from "./builder-definitions";
import styles from "./survey-create.module.css";

interface SurveyTemplatePickerProps {
  elementIconMap: Record<ElementType, string>;
  filteredTemplates: BuilderTemplate[];
  getTemplatePreviewStyle: (template: BuilderTemplate) => React.CSSProperties;
  onApplySelectedTemplate: () => void;
  onClose: () => void;
  onConfirmReplace: () => void;
  onSelectTemplate: (templateId: string) => void;
  selectedTemplate: BuilderTemplate | null;
  selectedTemplateId: string;
  setShowTemplateConfirm: (value: boolean) => void;
  setTemplateCategory: (value: "all" | BuilderTemplate["category"]) => void;
  setTemplateSearch: (value: string) => void;
  showTemplateConfirm: boolean;
  templateCategory: "all" | BuilderTemplate["category"];
  templateSearch: string;
}

const TEMPLATE_CATEGORIES: Array<{ id: "all" | BuilderTemplate["category"]; label: string }> = [
  { id: "all", label: "All" },
  { id: "feedback", label: "Feedback" },
  { id: "employee", label: "Employee" },
  { id: "service", label: "Service" },
  { id: "compliance", label: "Compliance" },
  { id: "event", label: "Event" },
];

export default function SurveyTemplatePicker({
  elementIconMap,
  filteredTemplates,
  getTemplatePreviewStyle,
  onApplySelectedTemplate,
  onClose,
  onConfirmReplace,
  onSelectTemplate,
  selectedTemplate,
  selectedTemplateId,
  setShowTemplateConfirm,
  setTemplateCategory,
  setTemplateSearch,
  showTemplateConfirm,
  templateCategory,
  templateSearch,
}: SurveyTemplatePickerProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.templateModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>Choose Template</h2>
          <button className={styles.inlineButton} type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.templateToolbar}>
            <input
              className={styles.templateSearch}
              placeholder="Search templates"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
            />
            <div className={styles.templateCategories}>
              {TEMPLATE_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`${styles.templateChip} ${templateCategory === category.id ? styles.templateChipActive : ""}`}
                  onClick={() => setTemplateCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.templateGrid}>
            {filteredTemplates.length === 0 ? (
              <div className={styles.templateEmpty}>No template matched your search/filter.</div>
            ) : (
              filteredTemplates.map((template) => {
                const elementCount = template.pages.reduce((sum, page) => sum + page.elements.length, 0);
                const templateElementTypes = Array.from(
                  new Set(template.pages.flatMap((page) => page.elements.map((element) => element.type))),
                ).slice(0, 5);

                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`${styles.templateCard} ${selectedTemplateId === template.id ? styles.templateCardActive : ""}`}
                    onClick={() => onSelectTemplate(template.id)}
                  >
                    <div className={styles.templateThumb} style={getTemplatePreviewStyle(template)}>
                      <div className={styles.templateThumbHeader}>
                        <span className={styles.templateThumbBadge}>{template.category}</span>
                      </div>
                      <div className={styles.templateThumbOverlay}>
                        <div className={styles.templateThumbTitleLine}>
                          {template.name.toLowerCase()}
                        </div>
                        <div className={styles.templateThumbSubLine}>
                          {template.description.slice(0, 44)}
                        </div>
                      </div>
                      <div className={styles.templateThumbBars}>
                        {template.pages.map((page, index) => {
                          const type = templateElementTypes[index % Math.max(templateElementTypes.length, 1)];
                          const icon = type ? elementIconMap[type] : "•";
                          return (
                            <span
                              key={`${template.id}-bar-${index + 1}`}
                              className={styles.templateThumbBar}
                              style={{ width: `${Math.max(28, Math.min(100, page.elements.length * 16))}%` }}
                            >
                              <span className={styles.templateThumbBarIcon}>{icon}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className={styles.templateName}>{template.name}</div>
                    <div className={styles.templateDesc}>{template.description}</div>
                    <div className={styles.templateMeta}>
                      <span>{template.pages.length} pages</span>
                      <span>{elementCount} elements</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className={styles.templateActions}>
            <button type="button" className={styles.sideAction} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={styles.sideActionPrimary} disabled={!selectedTemplate} onClick={onApplySelectedTemplate}>
              Apply Template
            </button>
          </div>

          {showTemplateConfirm && selectedTemplate ? (
            <div className={styles.templateConfirmBox}>
              <div className={styles.templateConfirmTitle}>Replace current builder content?</div>
              <div className={styles.templateConfirmText}>
                Current pages and elements akan diganti dengan template <strong>{selectedTemplate.name}</strong>.
                Gunakan Save Draft setelah apply agar tersimpan ke server.
              </div>
              <div className={styles.templateConfirmActions}>
                <button type="button" className={styles.sideAction} onClick={() => setShowTemplateConfirm(false)}>
                  Back
                </button>
                <button type="button" className={styles.sideActionPrimary} onClick={onConfirmReplace}>
                  Yes, Replace
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
