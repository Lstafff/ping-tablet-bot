# 001 — Сделать переходы экранов короткими и цельными

- **Status**: DONE
- **Commit**: e225894
- **Severity**: HIGH
- **Category**: Purpose and frequency, cohesion, performance
- **Estimated scope**: 2 files, about 40 lines

## Problem

Частый переход из списка соперников пытается превратить всю строку в hero-блок другого размера. Связка `layoutId` между `web/src/main.tsx:1344` и `web/src/main.tsx:1463` меняет геометрию, фон и внутреннюю структуру одновременно, поэтому карточка заметно растягивается и её содержимое скрывается рывком. Одновременно общий контейнер в `web/src/main.tsx:1203` использует `mode="popLayout"`, из-за чего старый и новый экраны могут кратко накладываться.

```tsx
<AnimatePresence initial={false} mode="popLayout">
  <motion.main key={screen} ... />
</AnimatePresence>

<motion.button layout layoutId={`opponent-card-${opponent.id}`} ... />
<motion.section layoutId={`opponent-card-${opponent.id}`} className="opponent-hero" ... />
```

## Target

- Удалить shared-layout morph карточки и hero: это частая навигация, ей нужен короткий отклик, а не декоративная перестройка.
- Переключать экраны через `AnimatePresence mode="wait"`.
- Обычные экраны: exit 120 ms и enter 180 ms, `opacity` плюс не более `translateY(4px)`, easing `[0.23, 1, 0.32, 1]`.
- Экран счёта сохраняет пространственный вход снизу длительностью 280 ms с easing `[0.32, 0.72, 0, 1]`.
- При `prefers-reduced-motion` убрать перемещение и оставить только opacity 120 ms.
- Нажатие карточки оставить CSS-переходом `transform 140ms cubic-bezier(0.23, 1, 0.32, 1)` к `scale(0.97)`.

## Repo conventions to follow

- Приложение уже использует `MotionConfig reducedMotion="user"` в `web/src/main.tsx:1195` и `useReducedMotion()` для явного удаления перемещения.
- Сильный ease-out уже используется в `RollingNumber`: `[0.23, 1, 0.32, 1]`.
- Длительности интерфейса остаются ниже 300 ms.

## Steps

1. В `web/src/main.tsx` заменить `mode="popLayout"` у экранов на `mode="wait"`; развести enter/exit timing так, чтобы старый экран исчезал за 120 ms, новый появлялся за 180 ms.
2. Для `score` оставить движение снизу, но использовать drawer easing `[0.32, 0.72, 0, 1]` и отключать transform при reduced motion.
3. Удалить `layout`, `layoutId` и layout spring у `.opponent-card` и `.opponent-hero`; вернуть обычные элементы или motion без shared layout.
4. В `web/src/styles.css` дать `.opponent-card` interruptible press transition 140 ms на `transform`; не анимировать размеры, padding или position.

## Boundaries

- Не менять данные соперника, маршруты, пагинацию и обработчики.
- Не добавлять зависимости.
- Не анимировать содержимое таблиц и графиков при каждом переключении вкладки.
- Если cited markup заметно изменился, остановиться и сверить план, а не импровизировать.

## Verification

- **Mechanical**: `cd web && npm run build`; `git diff --check`.
- **Feel check**: открыть Дашу из списка и вернуться 5 раз; карточка не должна растягиваться или оставаться поверх hero, а контент не должен двойно экспонироваться. В DevTools на 10% скорости проверить отсутствие промежуточной деформации текста и аватара.
- Включить `prefers-reduced-motion`: экран должен только мягко менять opacity без сдвига.
- **Done when**: переход укладывается в 300 ms, не морфит несвязанные структуры и остаётся понятным при быстрых повторных переходах.
