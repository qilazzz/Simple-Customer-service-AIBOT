/**
 * Aggressive mobile keyboard layout fix for Android/iOS chat embeds.
 * Pins the input bar above the soft keyboard using visualViewport + fixed positioning.
 */
(function initChatKeyboardFix(global) {
  function setupMobileKeyboardFix(options = {}) {
    const inputEl = options.inputEl || document.getElementById('message-input') || document.getElementById('chat-input');
    const composeEl =
      options.composeEl || document.querySelector('.chat-input-container, .chat-compose');
    const messagesEl = options.messagesEl || document.getElementById('chat-messages');
    const pageEl = options.pageEl || document.querySelector('.chat-page');

    if (!inputEl || !composeEl) return;

    const root = document.documentElement;
    document.body.classList.add('chat-keyboard-aware');

    let layoutBaseline = global.innerHeight;

    const measureCompose = () => {
      root.style.setProperty('--compose-height', `${composeEl.offsetHeight}px`);
    };

    const notifyParent = (height, keyboardInset) => {
      if (global.parent === global) return;
      global.parent.postMessage(
        {
          type: 'upsupport-viewport',
          height,
          keyboardInset,
        },
        '*',
      );
    };

    const syncViewport = () => {
      const viewport = global.visualViewport;
      let keyboardInset = 0;
      let visibleHeight = global.innerHeight;

      if (viewport) {
        keyboardInset = Math.max(0, global.innerHeight - viewport.height - viewport.offsetTop);
        visibleHeight = viewport.height;
      }

      // Android fallback when visualViewport does not shrink (common inside iframes)
      const innerHeightDrop = layoutBaseline - global.innerHeight;
      if (innerHeightDrop > 80 && keyboardInset < 80) {
        keyboardInset = innerHeightDrop;
        visibleHeight = global.innerHeight;
      }

      if (keyboardInset < 48) {
        layoutBaseline = Math.max(layoutBaseline, global.innerHeight);
      }

      root.style.setProperty('--vv-height', `${visibleHeight}px`);
      root.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
      root.style.setProperty('--vv-offset-top', `${viewport?.offsetTop || 0}px`);

      root.style.height = `${visibleHeight}px`;
      root.style.maxHeight = `${visibleHeight}px`;
      document.body.style.height = `${visibleHeight}px`;
      document.body.style.maxHeight = `${visibleHeight}px`;

      if (pageEl) {
        pageEl.style.height = `${visibleHeight}px`;
        pageEl.style.maxHeight = `${visibleHeight}px`;
      }

      composeEl.style.bottom = `${keyboardInset}px`;

      document.body.classList.toggle('keyboard-open', keyboardInset > 48);
      measureCompose();
      notifyParent(visibleHeight, keyboardInset);

      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    };

    const scrollInputIntoView = () => {
      global.requestAnimationFrame(() => {
        syncViewport();
        inputEl.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'auto' });
        composeEl.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'auto' });
        if (messagesEl) {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      });
    };

    if (global.ResizeObserver) {
      const observer = new ResizeObserver(measureCompose);
      observer.observe(composeEl);
    }

    if (global.visualViewport) {
      global.visualViewport.addEventListener('resize', syncViewport);
      global.visualViewport.addEventListener('scroll', syncViewport);
    }

    global.addEventListener('resize', syncViewport);
    global.addEventListener('orientationchange', () => {
      layoutBaseline = global.innerHeight;
      setTimeout(syncViewport, 100);
      setTimeout(syncViewport, 350);
    });

    inputEl.addEventListener('focus', () => {
      syncViewport();
      setTimeout(scrollInputIntoView, 50);
      setTimeout(scrollInputIntoView, 180);
      setTimeout(scrollInputIntoView, 400);
      setTimeout(scrollInputIntoView, 700);
    });

    inputEl.addEventListener('blur', () => {
      setTimeout(() => {
        layoutBaseline = global.innerHeight;
        composeEl.style.bottom = '0px';
        syncViewport();
      }, 120);
    });

    measureCompose();
    syncViewport();
  }

  global.setupMobileKeyboardFix = setupMobileKeyboardFix;
})(typeof window !== 'undefined' ? window : global);
