"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type SearchOption = {
  label: string;
  value: string;
};

type SearchBarProps = {
  rowClassName: string;
  selectClassName: string;
  inputClassName: string;
  buttonClassName: string;
  options: SearchOption[];
  selectedValue: string;
  keyword: string;
  onSelectedValueChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  placeholder?: string;
  buttonLabel?: string;
  buttonType?: "button" | "submit";
  onButtonClick?: () => void;
  trailingContent?: ReactNode;
};

export function SearchBar({
  rowClassName,
  selectClassName,
  inputClassName,
  buttonClassName,
  options,
  selectedValue,
  keyword,
  onSelectedValueChange,
  onKeywordChange,
  placeholder = "search here ...",
  buttonLabel = "Search",
  buttonType = "button",
  onButtonClick,
  trailingContent,
}: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === selectedValue) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (value: string) => {
    onSelectedValueChange(value);
    setIsOpen(false);
  };

  return (
    <div className={rowClassName}>
      <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          className={selectClassName}
          onClick={() => setIsOpen(!isOpen)}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          {selectedOption.label}
          <span style={{ marginLeft: "6px", fontSize: "10px" }}>{isOpen ? "▲" : "▼"}</span>
        </button>
        {isOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 1000,
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              marginTop: "4px",
              minWidth: "100%",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  border: 0,
                  background: selectedValue === option.value ? "#f3f4f6" : "#ffffff",
                  color: "#111827",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: selectedValue === option.value ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (selectedValue !== option.value) {
                    e.currentTarget.style.background = "#f9fafb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedValue !== option.value) {
                    e.currentTarget.style.background = "#ffffff";
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        className={inputClassName}
        type="search"
        placeholder={placeholder}
        value={keyword}
        onChange={(event) => onKeywordChange(event.target.value)}
      />
      <button className={buttonClassName} type={buttonType} onClick={onButtonClick}>
        {buttonLabel}
      </button>
      {trailingContent}
    </div>
  );
}
