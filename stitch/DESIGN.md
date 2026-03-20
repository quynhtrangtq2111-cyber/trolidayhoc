# Design System Specification: High-End Editorial Gamification

## 1. Overview & Creative North Star
**Creative North Star: "The Tactile Playground"**

This design system moves beyond the generic "flat" ed-tech aesthetic to create a digital environment that feels physical, premium, and deeply engaging. We are not just building an educational app; we are building a world that feels safe yet energetic. By blending high-end editorial typography with "bubbly" high-roundness geometry, we create a signature visual identity. 

The system breaks away from standard grids through **intentional asymmetry** and **overlapping layers**. Elements should feel like they are floating in a soft, airy space, using depth and tonal shifts rather than rigid lines to guide the eye. It is "Digital Claymorphism" meets "Editorial Precision."

---

## 2. Colors: Vibrancy & Soul
Our palette is energetic but balanced by a soft, pastel-infused foundation.

### Palette Strategy
- **Primary (`#0055c4`):** Electric Blue. Used for core actions and high-priority feedback.
- **Secondary (`#6d5a00` / `#fdd400`):** Sunny Yellow. Used for "joy moments" like rewards and achievements.
- **Tertiary (`#006a33` / `#3fff8b`):** Playful Mint Green. Used for progress and success states.
- **Error (`#b31b25`):** Soft Coral/Red. Used sparingly to correct without causing "test anxiety."

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** Boundaries must be defined solely through background color shifts. For instance, a `surface-container-low` (`#ecf1f6`) card should sit on a `surface` (`#f3f7fb`) background. Use the Spacing Scale (e.g., `8` or `10`) to create breathing room between these shifts rather than a line.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
1.  **Background (`#f3f7fb`):** The base canvas.
2.  **Surface-Container-Low:** For large structural sections.
3.  **Surface-Container-Lowest (`#ffffff`):** For active, interactive cards that need to "pop."
4.  **Surface-Container-High:** For nested elements within cards (e.g., an input field inside a white card).

### The "Glass & Gradient" Rule
To add visual "soul," utilize gradients for primary CTAs: transition from `primary` to `primary_container`. For floating elements, use **Glassmorphism**: apply `surface_container_lowest` at 70% opacity with a `20px` backdrop-blur.

---

## 3. Typography: The Editorial Voice
We utilize two distinct typefaces to balance playfulness with academic authority.

*   **Headings (Plus Jakarta Sans):** A modern, geometric sans-serif with a friendly soul. Used for `display`, `headline`, and `label` roles. The high X-height ensures legibility even when energetic.
*   **Body (Be Vietnam Pro):** A clean, highly readable font for `title` and `body` roles. It provides the "professional" anchor to the system.

**Hierarchy of Intent:**
- **Display-LG (3.5rem):** Reserved for "Hero" moments and big wins.
- **Headline-MD (1.75rem):** For card titles and section starts.
- **Body-LG (1rem):** The standard for educational content to reduce cognitive load.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows and borders are replaced by **Tonal Layering** to create a more sophisticated, "3D" feel.

- **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural lift.
- **Ambient Shadows:** When a card must "float" (e.g., a modal or active state), use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(0, 85, 196, 0.08)`. Note the tint—we use a 4-8% opacity of the `primary` or `on-surface` color, never pure black.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` token at **15% opacity**. High-contrast, 100% opaque borders are strictly forbidden.
- **3D Logic:** Use a subtle `1.5px` inner highlight (top edge) using `on-primary` at 20% opacity on buttons to simulate a "pressed" or "molded" 3D plastic look.

---

## 5. Components

### Buttons (The "Bubbly" Core)
- **Primary:** Gradient from `primary` to `primary_container`. High roundness (`xl`: `3rem`). Large padding (`1.2rem` top/bottom).
- **Secondary:** `secondary_container` background with `on_secondary_container` text. Use for secondary paths.
- **States:** On hover, increase the shadow diffusion. On press, use a subtle `scale(0.96)` transform.

### Cards & Progress
- **Cards:** Forbid divider lines. Separate "Header" and "Body" within a card using a vertical space of `6` (2rem) or a subtle background shift to `surface_container_high`.
- **Progress Bars:** Use `tertiary_fixed` for the track and `tertiary` for the fill. Rounded ends are mandatory (`full` scale).

### Input Fields
- **Styling:** Use `surface_container_highest` for the background. No border.
- **Roundness:** Match the `md` scale (1.5rem) to maintain the "soft" feel while distinguishing from the rounder buttons.

### Interactive "3D" Icons
Icons should be treated as "Objects." Use 3D-styled isometric icons where possible. When using flat icons, apply a "Playful Shadow" to the icon itself to make it feel like a physical sticker on the UI.

---

## 6. Do's and Don'ts

### Do:
- **Use Intentional Asymmetry:** Let cards overlap slightly or have varying widths to create a dynamic, gamified energy.
- **Embrace White Space:** Use the high end of the spacing scale (`12`, `16`, `20`) to keep the experience feeling "premium" and uncrowded.
- **Micro-interactions:** Every tap should have a reaction—a subtle bounce or a color shift.

### Don't:
- **Don't use 1px Borders:** Never use a hard line to separate content. Use tonal shifts.
- **Don't use Sharp Corners:** Nothing in this system should be sharper than the `sm` (0.5rem) radius. Avoid the `none` scale entirely.
- **Don't Over-saturate:** While colors are vibrant, keep the *backgrounds* pastel (`surface` tones) to prevent eye fatigue during long study sessions.
- **Don't Grid-Lock:** Avoid making every page look like a spreadsheet. Break the grid with floating 3D elements and offset text.