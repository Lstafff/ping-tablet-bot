# 003 — Запускать счётчик при входе на главный экран

- **Status**: DONE
- **Commit**: e225894
- **Severity**: MEDIUM
- **Category**: Feedback, preventing a jarring change
- **Estimated scope**: 2 files, about 25 lines

## Problem

`RollingNumber` в `web/src/main.tsx:497` анимирует только смену уже смонтированной цифры, потому что `AnimatePresence initial={false}`. Поэтому главный итог в `web/src/main.tsx:1325` сразу появляется статичным, хотя ввод счёта использует тот же вертикальный язык движения цифр.

```tsx
<AnimatePresence initial={false} mode="popLayout">
  <motion.span initial={{ opacity: 0, transform: "translateY(68%)" }} ... />
</AnimatePresence>
```

## Target

- Добавить `animateOnMount?: boolean` в `RollingNumber`, по умолчанию `false`.
- Только главный счёт `58 : 37` передаёт `animateOnMount`.
- Каждая цифра входит через `opacity: 0` + `translateY(68%)` в `opacity: 1` + `translateY(0)` за 180 ms, easing `[0.23, 1, 0.32, 1]`.
- Между цифрами — stagger 35 ms; separator не двигается.
- При reduced motion убрать translate и stagger, оставить opacity 120 ms.

## Repo conventions to follow

- Текущая смена цифр уже использует GPU-friendly `transform` и `opacity` и тот же ease-out.
- Сохранить `aria-label` на целом числе и `aria-hidden` на визуальных glyphs.

## Steps

1. В `web/src/main.tsx` расширить `RollingNumber` пропом `animateOnMount` и передавать его в `AnimatePresence initial`.
2. Добавить задержку `index * 0.035` только для initial enter главного счётчика; при последующих изменениях числа не задерживать реакцию.
3. Передать `animateOnMount` двум `RollingNumber` внутри `.scoreline` в `HomeScreen`.
4. При необходимости добавить `will-change: transform, opacity` только на активный glyph, не на весь экран.

## Boundaries

- Не анимировать проценты, подпись, список соперников или счётчики в таблицах при mount.
- Не менять формат и доступное имя `Побед N, поражений M`.
- Не добавлять зависимости.

## Verification

- **Mechanical**: `cd web && npm run build`; `git diff --check`.
- **Feel check**: открыть главный экран после другого раздела; цифры должны быстро докатиться снизу слева направо, а список уже быть доступным. На 10% скорости проверить одинаковую baseline и отсутствие обрезки glyphs.
- Включить `prefers-reduced-motion`: цифры должны только проявиться за 120 ms.
- **Done when**: анимация запускается при каждом новом входе на home, не замедляет дальнейшие обновления и сохраняет доступность.
