import type { ReactNode } from "react";

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
  return (
    <div className={rowClassName}>
      <select
        className={selectClassName}
        value={selectedValue}
        onChange={(event) => onSelectedValueChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
