/**
 * Floating support chat widget — drop into any web app:
 *
 * <script src="https://your-api.com/sdk/customer-support-client.js"></script>
 * <script src="https://your-api.com/sdk/embed-widget.js"></script>
 * <script>
 *   UsPizzaSupportWidget.init({ baseUrl: 'https://your-api.com' });
 * </script>
 */
(function initEmbedWidget(global) {
  const FAB_SIZE = 58;
  const EDGE_MARGIN = 16;
  const DRAG_THRESHOLD = 8;
  const SNAP_MS = 280;

  const STYLES = `
    .upsupport-fab {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 99999;
      width: ${FAB_SIZE}px;
      height: ${FAB_SIZE}px;
      border-radius: 50%;
      border: 2px solid #fff;
      background: #fff;
      padding: 0;
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      box-shadow: 0 8px 24px rgba(200,16,46,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      will-change: left, top;
    }
    .upsupport-fab.is-dragging {
      cursor: grabbing;
      transition: none;
    }
    .upsupport-fab.is-snapping {
      transition: left ${SNAP_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .upsupport-fab-icon {
      width: 100%; height: 100%; object-fit: cover; display: block;
      pointer-events: none;
    }
    .upsupport-panel {
      position: fixed; bottom: 96px; right: 24px; z-index: 99999;
      width: min(380px, calc(100vw - 32px));
      height: min(560px, calc(100dvh - 120px));
      border: none; border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.18);
      display: none;
    }
    .upsupport-panel.open { display: block; }
    @media (max-width: 640px) {
      .upsupport-panel.open {
        inset: 0;
        bottom: 0;
        right: 0;
        width: 100%;
        height: 100dvh;
        max-height: 100dvh;
        border-radius: 0;
      }
      .upsupport-fab.open {
        opacity: 0;
        pointer-events: none;
      }
    }
  `;

  function injectStyles() {
    if (document.getElementById('upsupport-styles')) return;
    const style = document.createElement('style');
    style.id = 'upsupport-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function bindIframeResize(iframe) {
    global.addEventListener('message', (event) => {
      if (event.data?.type !== 'upsupport-viewport') return;
      if (!iframe.classList.contains('open')) return;

      const height = Number(event.data.height);
      if (!height || global.innerWidth > 640) return;

      iframe.style.height = `${height}px`;
      iframe.style.maxHeight = `${height}px`;
      iframe.style.bottom = '0';
    });
  }

  function isMobileView() {
    return global.matchMedia('(max-width: 640px)').matches || global.innerWidth <= 640;
  }

  function readSafeAreaInset(side) {
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    if (side === 'bottom') {
      probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
    } else {
      probe.style.paddingTop = 'env(safe-area-inset-top)';
    }
    document.body.appendChild(probe);
    const style = global.getComputedStyle(probe);
    const value =
      side === 'bottom'
        ? parseFloat(style.paddingBottom || '0') || 0
        : parseFloat(style.paddingTop || '0') || 0;
    probe.remove();
    return value;
  }

  function measureTopInset(options = {}) {
    if (typeof options.topInset === 'number') return options.topInset;

    if (options.measureHeader !== false) {
      const header =
        document.querySelector('.app-header') ||
        document.querySelector('[data-support-top-boundary]');
      if (header) {
        const rect = header.getBoundingClientRect();
        return Math.max(EDGE_MARGIN, rect.bottom + 8);
      }
    }

    return EDGE_MARGIN + readSafeAreaInset('top');
  }

  function measureBottomInset(options = {}) {
    if (typeof options.bottomInset === 'number') return options.bottomInset;

    const footer =
      document.querySelector('.app-bottom-nav') ||
      document.querySelector('[data-support-bottom-boundary]');
    if (footer) {
      const rect = footer.getBoundingClientRect();
      const clearance = global.innerHeight - rect.top + 8;
      return Math.max(EDGE_MARGIN, clearance);
    }

    return EDGE_MARGIN + readSafeAreaInset('bottom');
  }

  function attachDraggableFab(fab, options = {}) {
    const edgeMargin = options.edgeMargin ?? EDGE_MARGIN;
    let x = 0;
    let y = 0;
    let dragging = false;
    let didDrag = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let startFabX = 0;
    let startFabY = 0;

    function getBounds() {
      const vw = global.innerWidth;
      const vh = global.innerHeight;
      const topInset = measureTopInset(options);
      const bottomInset = measureBottomInset(options);

      return {
        minX: edgeMargin,
        maxX: Math.max(edgeMargin, vw - FAB_SIZE - edgeMargin),
        minY: topInset,
        maxY: Math.max(topInset, vh - FAB_SIZE - bottomInset),
      };
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function applyPosition(enableSnapTransition = false) {
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
      fab.style.top = `${y}px`;
      fab.style.left = `${x}px`;

      if (enableSnapTransition) {
        fab.classList.add('is-snapping');
      } else if (!dragging) {
        fab.classList.remove('is-snapping');
      }
    }

    function snapToNearestEdge(animate = true) {
      const bounds = getBounds();
      const centerX = x + FAB_SIZE / 2;
      const midX = global.innerWidth / 2;
      x = centerX < midX ? bounds.minX : bounds.maxX;
      y = clamp(y, bounds.minY, bounds.maxY);
      applyPosition(animate);
    }

    function initPosition(preferLeft = false) {
      const bounds = getBounds();
      x = preferLeft ? bounds.minX : bounds.maxX;
      y = bounds.maxY;
      applyPosition(false);
    }

    function onPointerDown(event) {
      if (fab.classList.contains('open')) return;

      dragging = true;
      didDrag = false;
      fab.classList.add('is-dragging');
      fab.classList.remove('is-snapping');
      fab.setPointerCapture(event.pointerId);

      startPointerX = event.clientX;
      startPointerY = event.clientY;
      startFabX = x;
      startFabY = y;
    }

    function onPointerMove(event) {
      if (!dragging) return;

      const dx = event.clientX - startPointerX;
      const dy = event.clientY - startPointerY;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        didDrag = true;
      }

      const bounds = getBounds();
      x = clamp(startFabX + dx, bounds.minX, bounds.maxX);
      y = clamp(startFabY + dy, bounds.minY, bounds.maxY);
      applyPosition(false);
    }

    function onPointerUp(event) {
      if (!dragging) return;

      dragging = false;
      fab.classList.remove('is-dragging');

      if (fab.hasPointerCapture(event.pointerId)) {
        fab.releasePointerCapture(event.pointerId);
      }

      if (didDrag) {
        snapToNearestEdge(true);
        fab.addEventListener(
          'transitionend',
          () => fab.classList.remove('is-snapping'),
          { once: true },
        );
      }
    }

    fab.addEventListener('pointerdown', onPointerDown);
    fab.addEventListener('pointermove', onPointerMove);
    fab.addEventListener('pointerup', onPointerUp);
    fab.addEventListener('pointercancel', onPointerUp);

    global.addEventListener('resize', () => {
      snapToNearestEdge(false);
    });

    fab.didDrag = () => didDrag;
    fab.resetDragFlag = () => {
      didDrag = false;
    };

    initPosition(options.position === 'bottom-left');
    return { snapToNearestEdge, getBounds };
  }

  const UsPizzaSupportWidget = {
    init({ baseUrl = '', position = 'bottom-right', topInset, bottomInset, measureHeader = true } = {}) {
      injectStyles();

      const normalizedBase = baseUrl.replace(/\/$/, '');

      const fab = document.createElement('button');
      fab.className = 'upsupport-fab';
      fab.setAttribute('aria-label', 'Customer support');
      fab.type = 'button';

      const icon = document.createElement('img');
      icon.className = 'upsupport-fab-icon';
      icon.src = `${normalizedBase}/assets/images/customer-service-icon.png`;
      icon.alt = '';
      icon.draggable = false;
      fab.appendChild(icon);

      const iframe = document.createElement('iframe');
      iframe.className = 'upsupport-panel';
      iframe.title = 'US Pizza Support';
      iframe.src = `${normalizedBase}/embed.html`;
      iframe.allow = 'camera *; microphone *';

      bindIframeResize(iframe);

      attachDraggableFab(fab, {
        position,
        topInset,
        bottomInset,
        measureHeader,
      });

      fab.addEventListener('click', (event) => {
        if (fab.didDrag?.()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          fab.resetDragFlag?.();
          return;
        }

        if (isMobileView()) {
          global.location.href = `${normalizedBase}/embed.html`;
          return;
        }

        const isOpen = iframe.classList.toggle('open');
        fab.classList.toggle('open', isOpen);
      });

      document.body.appendChild(fab);
      document.body.appendChild(iframe);

      return { fab, iframe };
    },
  };

  global.UsPizzaSupportWidget = UsPizzaSupportWidget;
})(typeof window !== 'undefined' ? window : global);
