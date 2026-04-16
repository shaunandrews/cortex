import { useRef, useCallback } from 'react';
import { usePanelRef } from 'react-resizable-panels';

const TRANSITION_CLASS = 'workspace--transitioning';
const DURATION_MS = 200;

/**
 * Wraps usePanelRef with animated collapse/expand.
 *
 * Adds a transient class to the panel group so ALL panels in the layout
 * transition their flex-grow values together — the divider slides, panels
 * resize, and content reflows naturally. The class is removed after the
 * animation so drag resizing stays instant.
 *
 * Usage:
 *   const detail = usePanelTransition(35);
 *   <Panel panelRef={detail.panelRef} elementRef={detail.elementRef}
 *          defaultSize={35} minSize={25} collapsible collapsedSize={0} />
 */
export function usePanelTransition(defaultSize: number) {
  const panelRef = usePanelRef();
  const elementRef = useRef<HTMLDivElement | null>(null);
  const lastExpandedSize = useRef(defaultSize);
  const cleanupTimer = useRef<number | null>(null);
  const isInitial = useRef(true);

  const withTransition = useCallback((action: () => void) => {
    // Skip animation on the very first call (initial mount)
    if (isInitial.current) {
      isInitial.current = false;
      action();
      return;
    }

    const group = elementRef.current?.closest('[data-group]') as HTMLElement | null;
    if (!group) {
      action();
      return;
    }

    if (cleanupTimer.current !== null) {
      clearTimeout(cleanupTimer.current);
    }

    group.classList.add(TRANSITION_CLASS);
    action();

    cleanupTimer.current = window.setTimeout(() => {
      group.classList.remove(TRANSITION_CLASS);
      cleanupTimer.current = null;
    }, DURATION_MS + 50);
  }, []);

  const collapse = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const current = panel.getSize().asPercentage;
    if (current > 0) {
      lastExpandedSize.current = current;
    }

    withTransition(() => panel.collapse());
  }, [panelRef, withTransition]);

  const expand = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    withTransition(() => {
      if (panel.isCollapsed()) {
        panel.expand();
      }

      // Guard against corrupted layouts where the panel is technically
      // "expanded" but at a tiny size from bad persisted state.
      const size = panel.getSize().asPercentage;
      if (size < lastExpandedSize.current) {
        panel.resize(lastExpandedSize.current + '%');
      }
    });
  }, [panelRef, withTransition]);

  return { panelRef, elementRef, collapse, expand };
}
