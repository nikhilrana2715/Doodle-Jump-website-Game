# Nova Hop Design System · v1.0

## 1. Product brief
- **Product:** a mobile-first arcade web game (PWA) with 4 screens: Menu, HUD (in-game), Pause, Game Over. There's also the desktop "How to play" side card.
- **Users:**
  - **Casual players** on phones want to start instantly and steer with one thumb.
  - **Desktop players** use the keyboard and like to chase scores.
  - **Returning players** unlock skins and beat their best.
- **Key flows:** Menu → Play → (Pause) → Game Over → Play again / Share / Menu. A secondary flow is skin unlock from the Menu.
- **Pain points we design for:**
  - Touch targets must stay ≥ 44 px.
  - Text has to read over a sky that keeps changing color, so we use glass panels with ink text-shadows.
  - Layout must work from 320 px phones up to landscape and desktop.

## 2. Audit (v2.0 → v1.0 system)
| Area | Found | Now |
|---|---|---|
| Font sizes | 18 different px values (10–72) | 8-step type scale |
| Spacing | ~25 padding/gap/margin values (2, 3, 6, 7, 10, 11, 14, 18, 22, 26, 30, 36, 54 …) | 7-step 4-px scale |
| Radius | 7 variants (7, 12, 30, 99, 999, 50 % …) | 5 tokens + circle |
| Colors | 18 hex values, all brand-aligned but some hardcoded | Named tokens in `:root` |
| Buttons | 1 base + 3 variants | `Button / Primary · Ghost · Small` |

## 3. Tokens (`css/style.css :root`)
**Color**
| Token | Value | Use |
|---|---|---|
| `--night` | `#120d33` | App background |
| `--ink` | `#1b1446` | Text on gold, outlines, shadows |
| `--gold` / `--gold-hi` / `--gold-lo` | `#ffc04d` / `#ffe08a` / `#c76a12` | **Primary** actions, score highlights |
| `--mint` | `#5ef2c2` | **Success** / shield |
| `--pink` | `#ff6fae` | Accent / combo / danger hint |
| `--violet` / `--sky` / `--orange` | `#9b6bff` / `#8cc4ff` / `#ff8a3d` | Decorative accents |
| `--glass*`, `--muted` | rgba whites | Panels and secondary text |

**Type:** `--fs-xs 11 · sm 13 · md 15 · lg 18 · xl 22 · 2xl 28 · 3xl 42 · display 72`. Display font is Fredoka; body font is Nunito. The logo uses its own clamp() sizes.

**Space:** `--sp-1 4 · 2 8 · 3 12 · 4 16 · 6 24 · 8 32 · 14 56`

**Radius:** `--r-xs 8 · sm 12 · md 18 · lg 26 · pill 999`

**Motion:** `--ease-pop` (overshoot, for buttons and appearances) and `--ease-out` (screens). Everything is disabled under `prefers-reduced-motion`.

## 4. Components
| Name | Class | Notes |
|---|---|---|
| `Button / Primary` | `.btn.primary` | One per screen. Gold gradient with a 6 px "3D" base that sinks on press |
| `Button / Ghost` | `.btn.ghost` | Secondary actions (Menu, Restart, Share) |
| `Button / Small` | `.btn.small` | Inline form submit |
| `Button / Icon` | `.icon-btn` | 44 px circle, HUD only |
| `Pill` | `.pill`, `.mini-stat` | Settings toggles & small stats |
| `Chip` | `.chip` | HUD counters |
| `Panel` | `.panel` | Glass card for menus and dialogs |
| `Toast` | `.toast` | Zone banners and short confirmations (2.2 s) |
| `Skin card` | `.skin` | States: selected, locked, affordable, shake (denied) |
| `Ribbon` | `.ribbon` | NEW BEST celebration |
| `Input / Text` | `.board-form input` | Leaderboard name |

## 5. Do / Don't
- ✅ **Do** use only one gold `Button / Primary` per screen. ❌ **Don't** put two gold buttons side by side; make the second one Ghost.
- ✅ **Do** put text on a glass panel or give it an ink text-shadow. ❌ **Don't** place bare white text straight on the sky gradient.
- ✅ **Do** reference tokens (`var(--sp-4)`). ❌ **Don't** add raw `px` spacing or new hex colors in components.
- ✅ **Do** keep touch targets ≥ 44 px. ❌ **Don't** shrink HUD buttons on small screens.

## 6. Changelog
- **v1.0 (2026-11-12):** extracted type, space and radius scales from the v2.0 UI. All components now use tokens. Added `Button row`, `Version` label and the Share/Haptics controls.
