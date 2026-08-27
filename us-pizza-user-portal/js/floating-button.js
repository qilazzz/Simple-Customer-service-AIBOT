/**
 * Draggable floating support button — mirrors mobile FloatingSupportButton.
 */

const FAB_SIZE = 56;
const EDGE_MARGIN = 16;
const DRAG_THRESHOLD = 8;
const SNAP_MS = 280;

export function initFloatingSupportButton({ button, layer, onPress }) {
  if (!button || !layer) return;

  let posX = 0;
  let posY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let dragging = false;
  let moved = false;
  let bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function measureBounds() {
    const layerRect = layer.getBoundingClientRect();
    bounds.minX = EDGE_MARGIN;
    bounds.maxX = Math.max(EDGE_MARGIN, layerRect.width - FAB_SIZE - EDGE_MARGIN);
    bounds.minY = EDGE_MARGIN;
    bounds.maxY = Math.max(EDGE_MARGIN, layerRect.height - FAB_SIZE - EDGE_MARGIN);

    if (posX === 0 && posY === 0) {
      posX = bounds.maxX;
      posY = bounds.maxY;
    } else {
      posX = clamp(posX, bounds.minX, bounds.maxX);
      posY = clamp(posY, bounds.minY, bounds.maxY);
    }
    applyPosition(false);
  }

  function applyPosition(animate) {
    button.classList.toggle('is-snapping', animate);
    button.style.left = `${posX}px`;
    button.style.top = `${posY}px`;
    if (animate) {
      window.setTimeout(() => button.classList.remove('is-snapping'), SNAP_MS);
    }
  }

  function snapToEdge() {
    const centerX = posX + FAB_SIZE / 2;
    const midX = (bounds.minX + bounds.maxX + FAB_SIZE) / 2;
    posX = centerX < midX ? bounds.minX : bounds.maxX;
    applyPosition(true);
  }

  function onPointerDown(event) {
    dragging = true;
    moved = false;
    dragStartX = posX;
    dragStartY = posY;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    button.setPointerCapture(event.pointerId);
    button.classList.add('is-dragging');
  }

  function onPointerMove(event) {
    if (!dragging) return;
    const dx = event.clientX - pointerStartX;
    const dy = event.clientY - pointerStartY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      moved = true;
    }
    posX = clamp(dragStartX + dx, bounds.minX, bounds.maxX);
    posY = clamp(dragStartY + dy, bounds.minY, bounds.maxY);
    applyPosition(false);
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    button.releasePointerCapture(event.pointerId);
    button.classList.remove('is-dragging');
    snapToEdge();
    if (!moved) onPress?.();
  }

  button.addEventListener('pointerdown', onPointerDown);
  button.addEventListener('pointermove', onPointerMove);
  button.addEventListener('pointerup', onPointerUp);
  button.addEventListener('pointercancel', onPointerUp);

  window.addEventListener('resize', measureBounds);
  measureBounds();

  return { remeasure: measureBounds };
}
