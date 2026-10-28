# Accessibility audit

An audit of the whole app against **WCAG 2.2 level AA**, carried out on 2026-10-27, and what was fixed as a result; the findings first left in a backlog were fixed the day after. Level AAA points that matter in practice (44px touch targets) are noted as advice, not as failures.

**Outcome.** 42 findings: 38 fixed, 1 accepted as it is, and 3 notes on things that need no change; nothing is left in a backlog. Before the fixes, 37 of 70 axe scans failed a WCAG rule, the keyboard focus was too faint to see on 108 of 114 tab stops, and NVDA found no heading on any page. After them, no axe scan fails a WCAG rule (66 scans), every tab stop shows a focus ring of 3:1 or more, and NVDA announces page titles, headings, dialog names, record names and every status change probed. One limitation was accepted as it is: [A11Y-24](#a11y-24), bottom bar labels that do not grow with the app's own text size.

## Scope and method

**What was audited.** Every page (`/tasks`, `/matrix`, `/goals`, `/dreams`, `/groups`, `/settings` with its six tabs, `/sync`), every dialog and menu, both themes, the three locales (en, ru, pl), the five text sizes (87.5–150%) and widths of 320, 360, 768 and 1280 CSS px. Sync was audited as a page only: no pairing was started, since there was no second device to scan a code with.

**How.** Every check below is a test in the repository, so it can be rerun and keeps guarding what was fixed.

| Layer         | Tool                                                                                                                                                                                                              | Where                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Static        | `eslint-plugin-vuejs-accessibility` (native markup only; Vuetify components are opaque to it)                                                                                                                     | `eslint.config.js`                            |
| Palette       | WCAG contrast of every colour pair the theme draws, text at 4.5:1 and controls at 3:1                                                                                                                             | `src/plugins/__tests__/themeContrast.test.ts` |
| Rules         | axe-core 4 (`@axe-core/playwright`) over 31 states × 2 themes, plus 4 states in ru and pl                                                                                                                         | `e2e/a11y/axe.spec.ts`                        |
| Semantics     | Page language, titles, headings, landmark names, accessible names and states, live regions                                                                                                                        | `e2e/a11y/semantics.spec.ts`                  |
| Keyboard      | Tab through 7 states; per stop, the pixels whose colour changes by 3:1 on focus, and whether the stop is covered; focus after a dialog closes or a row leaves                                                     | `e2e/a11y/keyboard.spec.ts`                   |
| Visual        | Reflow at 320px (100% and 150%), WCAG 1.4.12 text spacing, fonts actually used per glyph (Chromium's `CSS.getPlatformFontsForNode`), tap target reach, forced colours, simulated colour blindness, reduced motion | `e2e/a11y/visual.spec.ts`                     |
| Screen reader | NVDA 2026.2 (portable, Guidepup build) driven by `@guidepup/playwright`, six scenarios, spoken text logged                                                                                                        | `e2e/sr/nvda.sr.ts`, `npm run test:sr`        |
| Mobile        | WebKit with iPhone 13 emulation (axe, reflow, target size), run once; Chromium at phone sizes in every run                                                                                                        | —                                             |

Setting `A11Y_DUMP_DIR` to a folder keeps every axe result, accessibility tree, screenshot and NVDA log a run produces. The bottom bar label sizes in [A11Y-24](#accepted-limitation) were measured once, by a probe dropped after the decision.

**Environment.** Windows 10 Pro 19045, Node 25.5, Playwright 1.62.1 (Chromium 1234, WebKit 2336), axe-core via `@axe-core/playwright` 4.14, NVDA 2026.2 via `@guidepup/guidepup` 0.38, the production build served by `npm run preview`.

**Not covered.** Real VoiceOver on iOS and TalkBack on Android (no device was available; see [Residual risk](#residual-risk)), JAWS, Narrator, and the sync flow beyond its first screen.

## Results before and after

| Measure                                                 | Before                                                             | After                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| axe scans failing a WCAG A/AA rule                      | 37 of 70                                                           | 0 of 66                                                                   |
| axe WCAG violations (nodes)                             | 161 (`color-contrast` 141, `label` 12, `aria-required-children` 8) | 0                                                                         |
| Dialogs without an accessible name (`aria-dialog-name`) | 44                                                                 | 0                                                                         |
| Tab stops with a 3:1 focus indicator                    | 6 of 114                                                           | all                                                                       |
| Dialogs that hand the focus back on close               | 1 of 4 probed                                                      | 4 of 4                                                                    |
| Semantics checks passing                                | 0 of 20                                                            | 22 of 22 (2 sync checks dropped, see scope; 4 added with the later fixes) |
| Text nodes drawn in a fallback font (pl)                | 24                                                                 | 0                                                                         |
| Empty alerts NVDA announces as the add dialog opens     | 4                                                                  | 0                                                                         |
| NVDA: headings found per page                           | 0                                                                  | `h1` on every page, `h2` per quadrant, Settings section and dialog        |

## WCAG 2.2 AA conformance

Status after the fixes. N/A means the app has no content of that kind.

| Criterion                        | Status                            | Notes                                                                                                                                        |
| -------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text content           | Pass                              | QR code named ([A11Y-20](#a11y-20)); icons are decorative or name their button                                                               |
| 1.2.x Time-based media           | N/A                               |                                                                                                                                              |
| 1.3.1 Info and relationships     | Pass                              | Headings, lists, named selects ([A11Y-04](#a11y-04), [A11Y-09](#a11y-09), [A11Y-12](#a11y-12), [A11Y-13](#a11y-13)); and [A11Y-32](#a11y-32) |
| 1.3.2 Meaningful sequence        | Pass                              |                                                                                                                                              |
| 1.3.3 Sensory characteristics    | Pass                              |                                                                                                                                              |
| 1.3.4 Orientation                | Pass                              | The manifest locks no orientation                                                                                                            |
| 1.3.5 Identify input purpose     | N/A                               | No fields about the user                                                                                                                     |
| 1.4.1 Use of colour              | Pass                              | Current page no longer colour only ([A11Y-23](#a11y-23))                                                                                     |
| 1.4.2 Audio control              | N/A                               |                                                                                                                                              |
| 1.4.3 Contrast (minimum)         | Pass                              | [A11Y-14](#a11y-14), [A11Y-15](#a11y-15), [A11Y-38](#a11y-38)                                                                                |
| 1.4.4 Resize text                | Pass, with an accepted limitation | Browser zoom enlarges everything; the app's text size setting does not reach the bottom bar labels ([A11Y-24](#a11y-24))                     |
| 1.4.5 Images of text             | N/A                               |                                                                                                                                              |
| 1.4.10 Reflow                    | Pass                              | No horizontal scrolling at 320px; no clipped text without another way to read it ([A11Y-21](#a11y-21), [A11Y-22](#a11y-22))                  |
| 1.4.11 Non-text contrast         | Pass                              | [A11Y-01](#a11y-01), [A11Y-16](#a11y-16)                                                                                                     |
| 1.4.12 Text spacing              | Pass                              |                                                                                                                                              |
| 1.4.13 Content on hover or focus | N/A                               | No tooltips; menus open on click                                                                                                             |
| 2.1.1 Keyboard                   | Pass                              | [A11Y-13](#a11y-13)                                                                                                                          |
| 2.1.2 No keyboard trap           | Pass                              | Dialogs trap focus as modals should and close on Escape                                                                                      |
| 2.1.4 Character key shortcuts    | N/A                               |                                                                                                                                              |
| 2.2.1 Timing adjustable          | Pass                              | [A11Y-18](#a11y-18)                                                                                                                          |
| 2.2.2 Pause, stop, hide          | Pass                              | Only loading indicators move                                                                                                                 |
| 2.3.1 Three flashes              | Pass                              |                                                                                                                                              |
| 2.4.1 Bypass blocks              | Pass                              | Landmarks and headings                                                                                                                       |
| 2.4.2 Page titled                | Pass                              | [A11Y-03](#a11y-03)                                                                                                                          |
| 2.4.3 Focus order                | Pass                              | [A11Y-06](#a11y-06), [A11Y-07](#a11y-07)                                                                                                     |
| 2.4.4 Link purpose               | Pass                              |                                                                                                                                              |
| 2.4.5 Multiple ways              | Pass                              | Every page is one tap away in the bottom bar                                                                                                 |
| 2.4.6 Headings and labels        | Pass                              | [A11Y-08](#a11y-08), [A11Y-10](#a11y-10)                                                                                                     |
| 2.4.7 Focus visible              | Pass                              | [A11Y-01](#a11y-01)                                                                                                                          |
| 2.4.11 Focus not obscured        | Pass                              | No stop covered by the app bar or the bottom bar                                                                                             |
| 2.5.1 Pointer gestures           | N/A                               | No path or multipoint gestures                                                                                                               |
| 2.5.2 Pointer cancellation       | Pass                              | Vuetify activates on click                                                                                                                   |
| 2.5.3 Label in name              | Pass                              |                                                                                                                                              |
| 2.5.4 Motion actuation           | N/A                               |                                                                                                                                              |
| 2.5.7 Dragging movements         | N/A                               | No dragging anywhere                                                                                                                         |
| 2.5.8 Target size (minimum)      | Pass                              | Every target reaches 24px at 360px wide; icon buttons reach 44px ([A11Y-39](#a11y-39))                                                       |
| 3.1.1 Language of page           | Pass                              | [A11Y-02](#a11y-02)                                                                                                                          |
| 3.1.2 Language of parts          | Pass                              | [A11Y-27](#a11y-27)                                                                                                                          |
| 3.2.1 On focus                   | Pass                              |                                                                                                                                              |
| 3.2.2 On input                   | Pass                              | Settings apply in place; sync not tested                                                                                                     |
| 3.2.3 Consistent navigation      | Pass                              |                                                                                                                                              |
| 3.2.4 Consistent identification  | Pass                              |                                                                                                                                              |
| 3.2.6 Consistent help            | N/A                               |                                                                                                                                              |
| 3.3.1 Error identification       | Pass                              | [A11Y-31](#a11y-31)                                                                                                                          |
| 3.3.2 Labels or instructions     | Pass                              | [A11Y-30](#a11y-30)                                                                                                                          |
| 3.3.3 Error suggestion           | Pass                              | Messages say what to enter                                                                                                                   |
| 3.3.4 Error prevention           | Pass                              | Closing a record is reversible from History; restore and sample data ask first                                                               |
| 3.3.7 Redundant entry            | Pass                              |                                                                                                                                              |
| 3.3.8 Accessible authentication  | N/A                               |                                                                                                                                              |
| 4.1.2 Name, role, value          | Pass                              | [A11Y-05](#a11y-05), [A11Y-08](#a11y-08), [A11Y-09](#a11y-09), [A11Y-11](#a11y-11), [A11Y-29](#a11y-29)                                      |
| 4.1.3 Status messages            | Pass                              | [A11Y-17](#a11y-17), [A11Y-19](#a11y-19)                                                                                                     |

## Findings

Severity: **serious** blocks or badly hinders a group of users and fails a criterion; **moderate** fails a criterion in a corner or makes a task much harder; **minor** is friction. There were no blockers in the strict sense: every task could be done some way.

| ID                          | Finding                                                                                                                        | WCAG           | Severity | Status                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------- | ---------------------------- |
| <a id="a11y-01"></a>A11Y-01 | Keyboard focus nearly invisible: Vuetify's 12% tint and faint border drew 1.3–2:1                                              | 2.4.7, 1.4.11  | serious  | fixed                        |
| <a id="a11y-02"></a>A11Y-02 | `<html lang>` stayed `en` in Russian and Polish, so a screen reader read them with an English voice                            | 3.1.1          | serious  | fixed                        |
| <a id="a11y-03"></a>A11Y-03 | Every page titled `TODO`                                                                                                       | 2.4.2          | serious  | fixed                        |
| <a id="a11y-04"></a>A11Y-04 | No heading anywhere in the app                                                                                                 | 1.3.1, 2.4.6   | serious  | fixed                        |
| <a id="a11y-05"></a>A11Y-05 | No dialog had an accessible name; the add dialog had no title at all                                                           | 4.1.2          | serious  | fixed                        |
| <a id="a11y-06"></a>A11Y-06 | Closing a dialog left the focus on the page body instead of its trigger                                                        | 2.4.3          | serious  | fixed                        |
| <a id="a11y-07"></a>A11Y-07 | Marking a row done or cancelling it dropped the focus to the page body                                                         | 2.4.3          | serious  | fixed                        |
| <a id="a11y-08"></a>A11Y-08 | Every row checkbox was named "Done", with no record name                                                                       | 2.4.6, 4.1.2   | serious  | fixed                        |
| <a id="a11y-09"></a>A11Y-09 | A list row was a focusable `div` with no role and a checkbox inside it; lists had no list semantics                            | 4.1.2, 1.3.1   | serious  | fixed                        |
| <a id="a11y-10"></a>A11Y-10 | Four matrix buttons all named "Add task"; the add button named "Add task" though it adds any type                              | 2.4.6          | moderate | fixed                        |
| <a id="a11y-11"></a>A11Y-11 | Segmented controls (Active/History, 1/2 rows, sync mode) did not expose which segment is on                                    | 4.1.2          | serious  | fixed                        |
| <a id="a11y-12"></a>A11Y-12 | The start page and cleanup selects had no accessible name                                                                      | 4.1.2, 1.3.1   | serious  | fixed                        |
| <a id="a11y-13"></a>A11Y-13 | Settings sat in a `role="list"` with non-list children; Export, Restore and Sample data were reachable by arrow keys only      | 1.3.1, 2.1.1   | serious  | fixed                        |
| <a id="a11y-14"></a>A11Y-14 | Secondary text in the light theme at 3.1–3.94:1 (row notes, dates, read-view details)                                          | 1.4.3          | serious  | fixed                        |
| <a id="a11y-15"></a>A11Y-15 | Status colours: tonal alerts in the light theme at 1.96–2.52:1, white on the dark-theme error at 3.6:1                         | 1.4.3          | serious  | fixed                        |
| <a id="a11y-16"></a>A11Y-16 | Field outlines at 2.2:1, an off switch at 1.1:1                                                                                | 1.4.11         | serious  | fixed                        |
| <a id="a11y-17"></a>A11Y-17 | Page changes, done, reopen, cancel, save and add said nothing; the snackbar's live region was created together with its text   | 4.1.3          | serious  | fixed                        |
| <a id="a11y-18"></a>A11Y-18 | An error disappeared after 5 seconds with no way to keep it                                                                    | 2.2.1          | moderate | fixed                        |
| <a id="a11y-19"></a>A11Y-19 | "Code copied." never appeared: `SyncPage` dropped `SyncFlow`'s notice                                                          | 4.1.3          | moderate | fixed                        |
| <a id="a11y-20"></a>A11Y-20 | The sync QR code had no text alternative                                                                                       | 1.1.1          | moderate | fixed                        |
| <a id="a11y-21"></a>A11Y-21 | Text cut off with nothing else showing it: dialog titles ("Отметить как выполненное?"), Settings actions, record names in rows | 1.4.10, 1.4.12 | serious  | fixed                        |
| <a id="a11y-22"></a>A11Y-22 | The snackbar was 344px wide at least, more than a 320px screen                                                                 | 1.4.10         | moderate | fixed                        |
| <a id="a11y-23"></a>A11Y-23 | The current page in the bottom bar was told by colour alone (1.3:1 against the others) and vanished in forced colours          | 1.4.1          | serious  | fixed                        |
| <a id="a11y-24"></a>A11Y-24 | Bottom bar labels shrink as the text size grows                                                                                | 1.4.4          | serious  | accepted (2026-10-27)        |
| <a id="a11y-25"></a>A11Y-25 | Polish letters (ą, ć, ę, ł, ń, ś, ź, ż) drawn in Segoe UI or Georgia mid-word                                                  | —              | moderate | fixed                        |
| <a id="a11y-26"></a>A11Y-26 | Three sync strings untranslated in Polish                                                                                      | 3.1.2          | minor    | fixed                        |
| <a id="a11y-27"></a>A11Y-27 | Error reasons from `BackupService`, `SyncConnection` and the parsers are English inside localized messages                     | 3.1.2          | minor    | fixed                        |
| <a id="a11y-28"></a>A11Y-28 | Language names in the language menu had no `lang`                                                                              | 3.1.2          | minor    | fixed                        |
| <a id="a11y-29"></a>A11Y-29 | Theme, language and sort menus did not expose the current choice                                                               | 4.1.2          | moderate | fixed                        |
| <a id="a11y-30"></a>A11Y-30 | The required Name field is not marked as required                                                                              | 3.3.2          | moderate | fixed                        |
| <a id="a11y-31"></a>A11Y-31 | An unusable deadline year or schedule number was dropped without a word                                                        | 3.3.1          | serious  | fixed                        |
| <a id="a11y-32"></a>A11Y-32 | In History a cancelled record looks like an open one: an empty checkbox and nothing else                                       | 1.3.1          | moderate | fixed                        |
| <a id="a11y-33"></a>A11Y-33 | Record dialogs have no visible Close button, only Escape, the scrim and Back                                                   | —              | moderate | fixed                        |
| <a id="a11y-34"></a>A11Y-34 | On a phone the Settings tab bar scrolls Dreams and Groups out of sight with no arrows                                          | —              | minor    | fixed                        |
| <a id="a11y-35"></a>A11Y-35 | Every field carries an empty `role="alert"`, which NVDA announces as "alert" when a dialog opens                               | —              | minor    | fixed                        |
| <a id="a11y-36"></a>A11Y-36 | At 150% on a 320px screen the schedule's "Doesn't repeat" select clips its value                                               | 1.4.10         | minor    | fixed                        |
| <a id="a11y-37"></a>A11Y-37 | At 320px the sync paste field clips its label                                                                                  | 1.4.10         | minor    | fixed                        |
| <a id="a11y-38"></a>A11Y-38 | An empty matrix quadrant was a disabled row at 3.1:1                                                                           | 1.4.3          | moderate | fixed                        |
| <a id="a11y-39"></a>A11Y-39 | Icon buttons are 36px, below the 44px of AAA 2.5.5                                                                             | 2.5.5 (AAA)    | advice   | fixed                        |
| <a id="a11y-40"></a>A11Y-40 | Reduced motion: Vuetify already drops its dialog transitions                                                                   | 2.3.3 (AAA)    | —        | no change                    |
| <a id="a11y-41"></a>A11Y-41 | WebKit axe flags the selected add-dialog tab as 79×20; it is 79×48 and fully reachable                                         | —              | —        | false positive               |
| <a id="a11y-42"></a>A11Y-42 | The matrix cannot open a task; moving a task between quadrants goes through its dialog on the Tasks page                       | —              | —        | same for everyone, no change |

### How the fixes work

**Focus ring (A11Y-01).** `src/assets/styles/focus.scss` gives every focusable control a 2px ring in the primary colour on `:focus-visible`, 5:1 or more against every background the app draws. Inside a segmented control it is drawn inset in the button's text colour, because the group clips what lies outside and a selected segment is filled with the primary colour. Text fields keep Vuetify's own full-strength outline; selects take the ring as well. List rows let the ring of the name button show past Vuetify's `overflow: hidden`.

**Page identity (A11Y-02, -03, -04, -17).** Each route names its page in `meta.titleKey`. `DefaultLayout` sets `document.title` ("Goals – TODO"), renders that name as a visually hidden `h1`, keeps `<html lang>` on the current locale, and announces the page through one live region that is in the page from the start, `useAnnouncerStore` (`src/stores/announcer.ts`). The same region says what a change moves no focus to show: "Done: …", "Reopened: …", "Cancelled: …", "Saved: …", "Added: …", and the snackbar's notices, whose own copy is hidden from the screen reader so they are not said twice. Focus stays where it is on a page change: the bottom bar works like a native tab bar.

**Dialogs (A11Y-05, -06).** Titles became `h2`, and each `VDialog` points at its title through `aria-labelledby` (the confirmation's body through `aria-describedby`); the add dialog, which has no visible title, is named "New record". `useReturnFocus` (`src/composables/useKeepFocus.ts`) hands the focus back to whatever had it when the dialog opened, since Vuetify does that only for dialogs opened through an activator slot and every dialog here opens through `v-model`.

**Rows (A11Y-07, -08, -09).** `EntityList` groups rows into `role="list"` blocks, one per section and one per run of loose records. A row is a `listitem` with no tab stop of its own; its two actions are the checkbox ("Done: Buy milk") and the record's name, a real button. A click anywhere on the row still opens it. When the row holding the focus leaves the list, `useKeepFocusInList` moves the focus to the row that took its place, or the last one, or the page heading. The matrix uses the same.

**Contrast (A11Y-14, -15, -16).** Both palettes moved to `src/plugins/theme.ts`, where the palette test reads them. The light theme's medium emphasis rose from 0.6 to 0.72; row notes no longer apply their opacity on top of the high-emphasis colour; field outlines draw at 0.55; an off switch has a solid track in the muted text colour and a surface-coloured thumb. Error, info, success and warning, with their on-colours, replace Vuetify's defaults.

**Settings (A11Y-12, -13).** The General tab is a column of sections under `h2` headings that also name their select. The action rows are `role="button"` and take a tab stop. The tab content sits in a `tabpanel` labelled by its tab.

**Fonts (A11Y-25).** Manrope and Alegreya now ship a Latin Extended subset as well, taken from Google Fonts under the same OFL.

**Forms (A11Y-30, -31, -35).** A text field, select or textarea renders its message area only once it has a message (`hideDetails: 'auto'` as Vuetify's default), because the empty area was a `role="alert"` that NVDA announced four times over as a dialog opened; `src/assets/styles/fields.scss` keeps the space it took, so the form neither tightens nor jumps when an error appears. Name says "(required)" as part of its label; it carries no `aria-required` besides, since NVDA reads a label's whole text and said "required" twice. An unusable deadline year or schedule number is reported under its field.

**Dialogs and History (A11Y-32, -33).** The record and add dialogs have a Close button: Escape, the scrim and Back already closed them, but a touch screen reader user needs something to find. A cancelled record in History says "Cancelled" under its name, since its empty checkbox looks and reads like an open record's.

**Error reasons (A11Y-27).** `BackupFormatError`, `SyncError` and `SignalFormatError` carry a `code` next to their English message, and `useErrorReason` (`src/composables/useErrorReason.ts`) turns it into a reason in the user's language. Anything else gets a general reason, and its own message goes to the console.

**Clipped text and targets (A11Y-34, -36, -37, -39).** Scrolling tab bars show arrows on phones too; a select's value wraps; the sync paste field is labelled "Code" with its instruction as a hint, which wraps. Icon buttons are 48px, the copy-code button 44px.

## Screen reader (NVDA)

What NVDA said on the same paths before and after, in English speech. The logs are kept by `npm run test:sr` under `A11Y_DUMP_DIR`.

| Path                  | Before                                                    | After                                                                                                                              |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Window title          | "TODO" on every page                                      | "Tasks – TODO", "Matrix – TODO", …                                                                                                 |
| Headings (H)          | "no next heading" on every page                           | "Tasks, heading, level 1"; on the matrix "Do, heading, level 2" and the other quadrants; in Settings a level 2 heading per section |
| Landmarks (D)         | "navigation landmark"                                     | "Pages, navigation landmark"                                                                                                       |
| Bottom bar → Goals    | "same page"                                               | "Goals"                                                                                                                            |
| Reading the task list | "clickable, check box, not checked, Done / Buy groceries" | "list, with 2 items, check box, not checked, Done: Backup the photos / button, Backup the photos"                                  |
| Confirming done       | the focus's new neighbour, nothing about the task         | "Done: Backup the photos"                                                                                                          |
| Matrix, Tab           | "Done, check box" ×3, "Add task, button"                  | "Done: Update the resume, check box", "Add a task to Schedule, button"                                                             |
| Settings selects      | "combo box … selected Tasks" (no name)                    | "Start page, combo box … selected Tasks"                                                                                           |
| Rows toggle           | "2 rows, button"                                          | "2 rows, toggle button, pressed"                                                                                                   |
| Export/Restore        | not reachable by Tab                                      | "Restore from a file, button"                                                                                                      |
| Empty Name, Save      | "Name is required"                                        | "Name is required" (already worked)                                                                                                |

Dialogs and announcements, after the fixes, with every phrase captured (Guidepup's default keeps only the first burst after a key, and missed them in the run before):

- Space on a row checkbox, confirmations on: "checked. Mark as done?, dialog, Mark Call the bank as done?", then the dialog's heading and buttons.
- Confirm: "Done: Call the bank", and the focus lands on the row that took its place: "Done: Confirm the reservation, check box, not checked".
- The add button: "alert. alert. alert. alert. New record, dialog. Name, edit, required, blank" at first; after [A11Y-35](#a11y-35) and [A11Y-30](#a11y-30), "New record, dialog. Name (required), edit, blank". Save with an empty name: "alert, Name is required".
- Save with a name: "Added: Call the plumber", the focus back on "Add, button".

## Accepted limitation

**A11Y-24, bottom bar labels.** The `22cqi` cap (see `docs/decisions.md`, Settings) keeps five labels and the add button inside a phone's width, but it makes the labels shrink as the app's text size grows: 10.0 → 9.2px at 320px and 11.8 → 11.0px at 360px going from 100% to 150%, because the add button grows and leaves each label less room. Browser zoom and pinch zoom still enlarge them, so 1.4.4 holds through the browser, but a user who raises the app's own text size gets smaller navigation. Kept as it is by decision on 2026-10-27. The option weighed and set aside was Material 3's "label on the current page only" once the five labels no longer fit at full size.

## Residual risk

No phone was available, so VoiceOver on iOS and TalkBack on Android were not tried. The fixes rely on standard ARIA that both support, but these are worth a check on a real device: the order of announcements when a dialog opens (VoiceOver tends to read the whole dialog), the hidden `h1` as the first thing on each page, the row's checkbox and name button as two swipe stops, the live region during a page change, and the Close button as the way out of a dialog. The sync flow was not exercised beyond its first screen.

## Rerunning the audit

```sh
npm run build
npm test                                   # palette contrast among the unit tests
npm run test:e2e                           # axe, semantics, keyboard and visual probes with the rest
A11Y_DUMP_DIR=/tmp/a11y npm run test:e2e   # the same, keeping every result and screenshot
npm run test:sr                            # NVDA; Windows only, takes over the keyboard
```

`npm run test:sr` needs a one-time `npx @guidepup/setup setup` and `npx @guidepup/setup install`, which download a portable NVDA into `%LOCALAPPDATA%\guidepup`. While it runs Guidepup presses keys at the OS level, so the machine has to be left alone; an editor that has the focus receives those keys too.

Since the colour schemes (2026-10-28) the axe runs also cover high contrast in both modes, every state with the AAA rules on, and the other schemes and three accents over six states; see [decisions.md](decisions.md#theming).

New violations fail `e2e/a11y/axe.spec.ts`. A violation that has to stay for a while goes into `e2e/a11y/allowlist.json` with the finding that tracks it; the list is empty today.
