# 002 — Связать сохранение профиля с нижним тулбаром

- **Status**: DONE
- **Commit**: e225894
- **Severity**: MEDIUM
- **Category**: Spatial consistency, state indication
- **Estimated scope**: 3 files, about 55 lines

## Problem

При переходе в редактирование профильный toolbar исчезает, а отдельная кнопка `Сохранить` появляется телепортом. Сейчас это два несвязанных fixed-контейнера: `.bottom-nav` в `web/src/styles.css:1335` и `.profile-save-slot` в `web/src/styles.css:1938`; в `web/src/main.tsx:1235` они переключаются без общей геометрии.

```tsx
{profileEditing ? <div className="profile-save-slot">...</div> : null}
{canShowNavigation ? <BottomNavigation ... /> : null}
```

## Target

- Один fixed-слот внизу всегда владеет геометрией toolbar.
- Внутри `AnimatePresence mode="wait"` навигация и кнопка получают общий `layoutId="profile-bottom-toolbar"`.
- Геометрический morph: 240 ms, easing `[0.77, 0, 0.175, 1]` (ease-in-out для элемента, который движется на экране).
- Внутренний контент: exit 100 ms, enter 140 ms, easing `[0.23, 1, 0.32, 1]`; только opacity и transform.
- При reduced motion: контейнер не меняет форму анимированно, контент делает opacity 120 ms.

## Repo conventions to follow

- Motion уже установлен (`motion/react`) и `LayoutGroup id="ping-tablet-layout"` оборачивает приложение.
- Нижняя навигация использует `GlassContainer`; сохранить стекло, активный pill и семантику `<nav>`.
- Использовать полные transform-строки, не `x`/`y`/`scale` shorthand.

## Steps

1. В `web/src/main.tsx` создать единый `.bottom-toolbar-slot`, который отображает либо `BottomNavigation`, либо `motion.div` с кнопкой сохранения.
2. В `web/src/components/BottomNavigation.tsx` дать корневому motion-контейнеру общий `layoutId` и передать точную transition 240 ms с `[0.77, 0, 0.175, 1]`.
3. В `web/src/styles.css` перенести fixed-positioning в `.bottom-toolbar-slot`; сделать `.bottom-nav` и `.profile-save-slot` относительными и шириной 100%.
4. Добавить короткое исчезновение/появление контента; не анимировать `width`, `height`, `left`, `right` или padding напрямую.

## Boundaries

- Не менять submit-логику, `form="profile-name-form"`, disabled-состояние и стеклянный материал.
- Не менять размеры итоговой навигации и кнопки вне общего контейнера.
- Не добавлять зависимости.

## Verification

- **Mechanical**: `cd web && npm run build`; `git diff --check`.
- **Feel check**: нажать «Настройки», затем «Сохранить»; внешний pill должен восприниматься как одна поверхность, содержимое — сменяться без наложения. На 10% скорости проверить, что граница и тень движутся вместе.
- Включить `prefers-reduced-motion`: должна остаться короткая смена opacity без заметного изменения геометрии.
- **Done when**: кнопка и toolbar связаны одной поверхностью, переход занимает до 240 ms и не вызывает layout-прыжков контента страницы.
