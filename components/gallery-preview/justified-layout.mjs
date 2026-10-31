/**
 * Partition items into justified rows using their source image aspect ratios.
 * Missing dimensions use a landscape-leaning estimate to reduce initial shift.
 */
export function buildJustifiedRows(items, containerWidth, targetHeight, gap = 8) {
  if (!items.length || containerWidth <= 0) return [];

  const width = Math.max(1, containerWidth);
  const minimumRowHeight = Math.min(180, targetHeight * 0.72);
  const rows = [];
  let cursor = 0;

  while (cursor < items.length) {
    const rowItems = [];
    let ratioTotal = 0;

    while (cursor < items.length && rowItems.length < 4) {
      const item = items[cursor];
      const image = item.images?.[0];
      const sourceWidth = Number(image?.width ?? 0);
      const sourceHeight = Number(image?.height ?? 0);
      const ratio = sourceWidth > 0 && sourceHeight > 0
        ? Math.min(2.2, Math.max(0.65, sourceWidth / sourceHeight))
        : 1.25;
      rowItems.push({ item, ratio });
      ratioTotal += ratio;
      cursor += 1;

      const candidateHeight = (width - gap * (rowItems.length - 1)) / ratioTotal;
      if (candidateHeight <= targetHeight) {
        if (candidateHeight < minimumRowHeight && rowItems.length > 1) {
          rowItems.pop();
          ratioTotal -= ratio;
          cursor -= 1;
        }
        break;
      }
      if (cursor === items.length) break;
    }

    const isFinalRow = cursor === items.length;
    const availableWidth = Math.max(1, width - gap * (rowItems.length - 1));
    const naturalHeight = availableWidth / ratioTotal;
    const rowHeight = rowItems.length === 1
      ? Math.min(targetHeight, Math.max(minimumRowHeight, naturalHeight))
      : isFinalRow
        ? Math.min(targetHeight, naturalHeight)
        : naturalHeight;
    rows.push({
      height: rowHeight,
      items: rowItems.map(({ item, ratio }) => ({
        item,
        width: rowItems.length === 1
          ? Math.min(availableWidth, ratio * rowHeight)
          : ratio * rowHeight,
      })),
    });
  }

  return rows;
}
