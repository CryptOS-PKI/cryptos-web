/*
Copyright The CryptOS Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { type RefObject, useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export const focusableIn = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
  );

/**
 * While active, keeps Tab and Shift+Tab inside the container, moves focus into it
 * (the first field, else the element marked data-autofocus, else the first
 * focusable), and gives focus back to whatever held it before on release.
 */
export const useFocusTrap = (
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  /** A selector for the element to focus first, tried before the defaults. */
  initial?: string,
) => {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;

    const items = focusableIn(root);
    const first =
      (initial ? root.querySelector<HTMLElement>(initial) : null) ??
      root.querySelector<HTMLElement>("[data-autofocus]") ??
      items.find((el) => el.matches("input,select,textarea")) ??
      items[0] ??
      root;
    first.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const list = focusableIn(root);
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const head = list[0];
      const tail = list.at(-1) as HTMLElement;
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };

    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [ref, active, initial]);
};
