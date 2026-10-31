export function getPaginationWindow(currentPage, totalPages, siblingCount = 1) {
  if (totalPages < 1) return [];

  const current = Math.min(totalPages, Math.max(1, currentPage));
  const siblings = Math.max(0, siblingCount);
  const maxNumbers = siblings * 2 + 3;

  if (totalPages <= maxNumbers + 2) {
    return Array.from({ length: totalPages }, (_, index) => ({ type: "page", page: index + 1 }));
  }

  const left = Math.max(1, current - siblings);
  const right = Math.min(totalPages, current + siblings);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [
      ...Array.from({ length: maxNumbers }, (_, index) => ({ type: "page", page: index + 1 })),
      { type: "ellipsis", key: "right" },
      { type: "page", page: totalPages },
    ];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const start = totalPages - maxNumbers + 1;
    return [
      { type: "page", page: 1 },
      { type: "ellipsis", key: "left" },
      ...Array.from({ length: maxNumbers }, (_, index) => ({ type: "page", page: start + index })),
    ];
  }

  if (showLeftEllipsis && showRightEllipsis) {
    return [
      { type: "page", page: 1 },
      { type: "ellipsis", key: "left" },
      ...Array.from({ length: siblings * 2 + 1 }, (_, index) => ({ type: "page", page: current - siblings + index })),
      { type: "ellipsis", key: "right" },
      { type: "page", page: totalPages },
    ];
  }

  return Array.from({ length: totalPages }, (_, index) => ({ type: "page", page: index + 1 }));
}
