import type { MouseEvent } from "react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
};

function buildPageItems(currentPage: number, totalPages: number): Array<number | "dots"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "dots"> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) items.push("dots");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push("dots");

  items.push(totalPages);
  return items;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalItems <= itemsPerPage) return null;

  const from = (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);
  const items = buildPageItems(currentPage, totalPages);

  const handleClick = (event: MouseEvent<HTMLButtonElement>, page: number) => {
    event.preventDefault();
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  };

  return (
    <div className={className}>
      <div>
        Menampilkan {from}-{to} dari {totalItems} data
      </div>
      <div>
        <button
          type="button"
          onClick={(event) => handleClick(event, currentPage - 1)}
          disabled={currentPage === 1}
        >
          Prev
        </button>
        {items.map((item, index) =>
          item === "dots" ? (
            <span key={`dots-${index}`}>...</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={(event) => handleClick(event, item)}
              aria-current={item === currentPage ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          onClick={(event) => handleClick(event, currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
