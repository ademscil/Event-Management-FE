"use client";

import { useEffect, useRef, useState } from "react";

type DropdownOption = {
  label: string;
  value: string;
};

type DropdownProps = {
  className?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function Dropdown({
  className = "",
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Select...",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = selectedOption?.label || placeholder;

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

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span>{displayText}</span>
        <span style={{ fontSize: "10px", marginLeft: "8px" }}>{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1000,
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            marginTop: "4px",
            maxHeight: "240px",
            overflowY: "auto",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => handleSelect(option.value)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                background: value === option.value ? "#f3f4f6" : "#ffffff",
                color: "#111827",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: value === option.value ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.background = "#f9fafb";
                }
              }}
              onMouseLeave={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.background = "#ffffff";
                }
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
