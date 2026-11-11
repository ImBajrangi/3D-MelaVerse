import { useEffect, useRef, type KeyboardEvent } from 'react';

/**
 * Rule A11Y-FOCUS-001: Robust Dialog Focus Lifecycle & Semantics
 * Traps Tab/Shift+Tab inside modal boundaries, closes on Escape, and restores focus on close.
 */
export function useDialogFocus(isOpen: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const getTabbableElements = (container: HTMLElement | null): HTMLElement[] => {
    if (!container) return [];
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      'details summary',
    ].join(', ');

    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => {
        const style = window.getComputedStyle(el);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
        );
      }
    );
  };

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const timer = window.setTimeout(() => {
        const tabbables = getTabbableElements(dialogRef.current);
        if (tabbables.length > 0) {
          tabbables[0].focus();
        } else {
          dialogRef.current?.focus();
        }
      }, 15);
      return () => window.clearTimeout(timer);
    } else {
      if (
        triggerRef.current &&
        document.body.contains(triggerRef.current) &&
        !(triggerRef.current as HTMLButtonElement).disabled
      ) {
        triggerRef.current.focus();
      } else {
        const fallbackTarget = document.querySelector<HTMLElement>(
          '[data-focus-fallback], main, #root'
        );
        if (fallbackTarget) {
          if (fallbackTarget.getAttribute('tabindex') === null) {
            fallbackTarget.setAttribute('tabindex', '-1');
          }
          fallbackTarget.focus();
        }
      }
    }
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      const nodes = getTabbableElements(dialogRef.current);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };

  return { dialogRef, handleKeyDown };
}
