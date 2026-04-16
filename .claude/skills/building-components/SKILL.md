---
name: building-components
description: Use when creating or editing a component in the Cortex component system at app/src/components/. Covers file structure, WPDS tokens, API conventions, CSS rules, tests, and the component catalog. Also use when migrating duplicated UI into a shared component.
version: 1.0.0
user-invocable: true
argument-hint: "[component-name]"
---

# Building a Cortex component

Use this whenever you're creating a new component in `app/src/components/`, or migrating an inline pattern into one. The goal is a small, consistent component system that feels hand-crafted, not assembled.

The existing component — `MenuItem` at `app/src/components/MenuItem/` — is the reference. When in doubt, match its shape.

## Before you start

1. **Check the brief.** What pattern is duplicated? Cite the call sites. A component needs at least two real usages OR a clear upcoming one — don't extract a single-use pattern.
2. **Name it.** Use PascalCase. Pick the shortest name that reads correctly at call sites. Not `SiteIconComponent`. Not `SiteAvatarBox`. Just `SiteIcon`.
3. **Draft the API in the conversation first.** Props, slots, states, variants. Get the user's nod before writing code — a wrong API is expensive to undo once calls sites exist.
4. **Find existing tokens and primitives.** Don't roll your own before checking.

## File structure

Every component lives in its own directory:

```
app/src/components/
  {Name}/
    {Name}.tsx        ← component + types, forwardRef'd
    {Name}.css        ← scoped styles, imported from the .tsx
    {Name}.test.tsx   ← rendering + state + event + attribute tests
  index.ts            ← barrel — add `export { default as Name } from './Name/Name'`
```

No README.md unless the user asks. No `index.ts` inside the component directory — the barrel at `components/index.ts` is the single re-export point.

Call sites always import from the barrel:

```tsx
import { MenuItem } from '../../components';
```

## WPDS tokens

**All** color, spacing, typography, radius, shadow, and border values come from WPDS CSS custom properties — never hardcoded.

- Token reference: `node_modules/@wordpress/theme/src/prebuilt/css/design-tokens.css`. Grep here before writing any value.
- Design-tokens file is imported once by `src/main.tsx` — they're available everywhere.
- The project overrides the border-radius scale in `src/App.css :root` — don't re-override per component.

### Which tokens for which thing

| Concern | Use |
|---|---|
| Row/button background on hover/focus/press | `--wpds-color-bg-interactive-neutral-weak-active` |
| Row/button background when selected/current | `--wpds-color-bg-interactive-brand-weak-active` |
| Subtle surface (cards, stages) | `--wpds-color-bg-surface-neutral-weak` |
| Primary content text | `--wpds-color-fg-content-neutral` |
| Secondary / muted text | `--wpds-color-fg-content-neutral-weak` |
| Error/destructive | `--wpds-color-fg-interactive-error-strong` / `--wpds-color-bg-interactive-error-strong` |
| Borders between surfaces | `--wpds-color-stroke-surface-neutral-weak` |
| Focus ring | `--wpds-color-stroke-focus-brand` |
| Motion | `--motion-duration-quick` / `-normal` / `-slow`, `--motion-easing-default` (defined in `App.css :root`) |

If no token fits, **don't invent one in component CSS**. Either propose a new token in `App.css :root` (and tell the user) or add a leave-behind comment explaining why a raw value is necessary. `.site-icon`'s `border-radius: 4px` is the canonical example — documented with a comment because neither `xs` (2px) nor `sm` (6px) fit a 24px avatar.

## Component (.tsx) conventions

- Use `forwardRef` whenever the component renders an interactive element (button, input, anchor) or needs dnd-kit / ref-based integration.
- `type: 'button'` by default on button components — never inherit form-submit behavior.
- Spread unmatched props onto the root element. Callers need to pass `data-*`, `aria-*`, dnd-kit `attributes`/`listeners`, `style`, `tabIndex`, etc. Don't enumerate.
- Props come first, rest spread last (so caller's `className` etc. wins only via explicit handling below).
- `className` concatenation: start with the component's base class, add state classes conditionally, then the caller's `className`. Use an array + `.join(' ')`, not string-plus:
  ```tsx
  const classes = ['menu-item'];
  if (isSelected) classes.push('is-selected');
  if (className) classes.push(className);
  <button className={classes.join(' ')} />
  ```
- Use `@wordpress/ui` primitives (`Text`, `Icon`, `Button`, `Popover`, `VisuallyHidden`) instead of raw elements when the role matches.
- Use `@wordpress/icons` for icons. Never emoji or text characters. Never custom SVG unless the icon truly doesn't exist — then follow the `app/src/icons/automattic.tsx` pattern (use `SVG` + `Path` from `@wordpress/primitives`).
- JSDoc props that aren't obvious from the name. Don't annotate `onClick`. Do annotate `isFocused` ("Controlled highlight, separate from browser focus.").

### State props vs pseudo-classes

- **CSS pseudo-classes** handle interaction states: `:hover`, `:focus-visible`, `:active`. The component does not know about these.
- **Props** handle controlled/persistent states: `isSelected`, `isFocused` (when you need a keyboard-nav cursor distinct from browser focus), `isDisabled`, `isDragging`. These produce `.is-*` classes.
- Don't expose a prop when CSS can do it. Don't rely on CSS when the state must be controllable.

### Naming

- Boolean props: `isSelected`, `isFocused`, `isDisabled`, `isDragging` — always prefixed `is` for state; `has` for presence if needed.
- Slot props: `icon`, `label`, `count`, `actions`, `children`. No `leftIcon` / `rightIcon` unless a component has both — say `icon` and `trailing` (or similar).
- Event props: `onClick`, `onSelect`, `onToggle`. Match DOM names when the behavior matches.

## CSS (.css) conventions

- Import from the component's `.tsx` (not from `App.css`):
  ```tsx
  import './MenuItem.css';
  ```
- **Class naming** — BEM-ish, not strict BEM:
  - `.component-name` — root
  - `.component-name-slot` — parts (e.g., `.menu-item-icon`, `.menu-item-label`)
  - `.component-name.is-state` — modifiers (`.menu-item.is-selected`)
- **No `!important`.** If you're tempted, the specificity is wrong — fix the cascade.
- **Focus ring:** use `outline` with negative `outline-offset`, not `box-shadow`. Box-shadow gets clipped by any `overflow: hidden` or `overflow-y: auto` ancestor. Example:
  ```css
  .menu-item:focus-visible {
    outline: 2px solid var(--wpds-color-stroke-focus-brand);
    outline-offset: -2px;
  }
  ```
- Motion always via tokens:
  ```css
  transition: background-color var(--motion-duration-quick) var(--motion-easing-default);
  ```
- Use logical properties where they improve portability (`padding-inline-start` > `padding-left`). The codebase isn't consistent about this yet — match the file's existing style rather than mixing.
- Do not put component-specific styles in `App.css`. If you find one there that belongs to your component, move it.

## Tests (.test.tsx)

Tests live next to the component and run under Vitest + `@testing-library/react`. Minimum coverage for any interactive component:

1. **Renders the label / children.**
2. **Renders each slot when provided** (icon, trailing, count).
3. **Conditional rendering rules** (e.g., count only shows when > 0).
4. **State classes** — `isSelected`, `isFocused`, etc. apply the right `.is-*` class.
5. **Events forward** — `onClick` is called.
6. **Attribute spread** — arbitrary `data-*` / `aria-*` reaches the DOM.
7. **Ref forwards** — `useRef` + `render` yields an `HTMLElement` of the expected type.

Don't test implementation details (class order, specific token values). Do test the public contract.

Run a single file: `npx vitest run src/components/MenuItem/MenuItem.test.tsx`. Run everything: `npm run test`.

## Component catalog

Every component needs a section in `app/src/views/ComponentsCatalog.tsx` showing its real-world variants. The catalog is the living docs.

Pattern:

```tsx
<section className="catalog-section">
  <header className="catalog-section-header">
    <Text variant="heading-lg">{ComponentName}</Text>
    <Text variant="body-sm" className="catalog-section-desc">
      One-paragraph description: what it does, where it's used, the states it supports.
    </Text>
  </header>
  <div className="catalog-specimens">
    <CatalogSpecimen label="State name">
      <{Component} {...props} />
    </CatalogSpecimen>
    {/* more specimens */}
  </div>
</section>
```

`CatalogSpecimen` is already defined at the bottom of `ComponentsCatalog.tsx` — reuse it. Don't create a new variant helper.

**What specimens to include:**

- Resting
- Every controlled state (`isSelected`, `isFocused`, `isDisabled`, `isDragging`, etc.)
- Every slot combo that's meaningful (icon-only, icon + count, all slots filled, etc.)
- At least one edge case: long label truncation, zero-count, empty slot
- An interactive stage at the end labelled "Hover / focus / active" so the reader can exercise pseudo-class states

Keep demo data inline in the catalog (follow the `demoImageA` data-URI pattern if you need imagery — no network calls).

## Docs

- No separate doc files. The component catalog + JSDoc on non-obvious props is the documentation.
- If a component has a subtle constraint (focus trap order, ref ownership, token quirk), add a short comment at the top of the `.tsx` — not a multi-paragraph docblock.

## Before shipping

Run and fix until all are green:

1. `npm run test` — 100% of the existing suite passes.
2. `npx tsc --noEmit` — no type errors.
3. `npx eslint src/components src/views/ComponentsCatalog.tsx` — no errors. (Pre-existing errors in files you didn't touch are not your problem; confirm they're pre-existing before ignoring.)
4. Dispatch the `design-review` agent to read the diff and produce a punch list. Fix P1+ before handing back. Skip if the change is literally a one-token tweak.

## Absolute rules

- **Never start the dev server.** Shaun runs it. No `npm run dev`, no `npx vite`.
- **Never open or drive the browser.** No chrome-devtools. If visual verification is needed, ask Shaun.
- **Never hardcode colors or raw pixel spacing.** Tokens or a commented, justified exception.
- **Never use raw HTML elements when a `@wordpress/ui` primitive exists.**
- **Never emoji or text glyphs as icons.** `@wordpress/icons` only.
- **Never a new file or component without the user asking.** Ask first; implement second.

## Reference: MenuItem

When stuck, read these three files — they're the full, complete example:

- `app/src/components/MenuItem/MenuItem.tsx`
- `app/src/components/MenuItem/MenuItem.css`
- `app/src/components/MenuItem/MenuItem.test.tsx`

And its catalog section: `app/src/views/ComponentsCatalog.tsx` (the section under `<Text variant="heading-lg">MenuItem</Text>`).
