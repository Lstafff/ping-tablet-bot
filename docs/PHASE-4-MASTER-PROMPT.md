# Tennis / Ping Tablet — Phase 4 Master Prompt for Codex Sol

Ты работаешь над продуктом **Tennis / Ping Tablet**.

Это **Phase 4: визуальная система, интерфейс Mini App и безопасная frontend-декомпозиция**. Первый implementation slice уже мог быть применён к текущему `main`; не считай описанное в prompt автоматически незавершённым и сначала сверяй фактический код, тесты и production behavior.

Текущий repository и развернутый production-контур являются source of truth. Phase 3 уже сохранила работающий Telegram-бот, общий `TennisService`, FastAPI, versioned migrations, retry-safe score flow, owner-local linked reset/delete, CI и раздельные Railway-сервисы bot/API.

Не повторяй Phase 3-аудит целиком. Сначала подтверди только факты, которые могли измениться, и используй существующие документы:

- `docs/PROJECT.md`;
- релевантные разделы `docs/ARCHITECTURE.md`;
- `BACKLOG.md`;
- `docs/ideas/INDEX.md`;
- релевантные decisions и changelog.

## 1. Продуктовый результат Phase 4

Mini App должна стать визуально цельной, современной и характерной для Ping Tablet, сохранив:

- быстрый ввод результата;
- понятную статистику;
- уверенную навигацию в Telegram WebView;
- доступность и читаемость;
- предсказуемый feedback;
- работу текстового Telegram-бота;
- существующие domain rules, данные и API-поведение.

Главный критерий — не количество polish и не формальная чистота компонентов, а ощущение ясного, быстрого и узнаваемого продукта.

## 2. Сначала определить проблему, затем направление

Пользователя не устраивает текущий внешний вид, но это ещё не готовое решение.

Перед implementation используй `$ask-nodumb` и установи:

1. какие экраны или элементы создают ощущение слабого продукта;
2. проблема в композиции, иерархии, типографике, цвете, материалах, плотности, навигации, motion или их сочетании;
3. какие качества нужно сохранить;
4. какие наблюдаемые признаки будут означать, что редизайн успешен.

Если визуальное направление не утверждено, подготовь 2–3 действительно разные концепции на одном репрезентативном экране. Для каждой покажи продуктовый характер, сильные стороны, ограничения и стоимость распространения. Не смешивай варианты в компромисс до выбора пользователя.

Не меняй весь интерфейс до согласования направления.

Исключение — раздел **«Обязательный correction pass после первого production-теста»** ниже. Это уже подтверждённые пользователем дефекты и требования. Не возвращай их в discovery, не проси повторно подтвердить и не заменяй новым визуальным направлением.

## 3. Scope Phase 4

В scope входят:

- визуальная иерархия Mini App;
- layout, typography, color, materials, spacing и density;
- navigation, cards, lists, forms, sheets, dialogs и empty/loading/error states;
- interaction craft, haptics и motion там, где они улучшают понимание и continuity;
- responsive поведение и Telegram safe areas;
- accessibility, contrast, focus, reduced motion и reduced transparency;
- минимальный frontend safety net перед широкими изменениями;
- постепенное разделение активного frontend-кода во время работы над конкретными экранами.

Не входят без отдельного решения:

- турниры и другая новая продуктовая функциональность;
- изменение правил матчей, Elo, linked reset/delete или ownership;
- переписывание текстового Telegram-бота;
- смена React/Vite/Motion/FastAPI/Postgres;
- новая design-system dependency;
- полный frontend rewrite;
- product identity migration;
- iOS-клиент;
- API rewrite или обязательный OpenAPI codegen.

## Обязательный correction pass после первого production-теста

Ниже перечислены принятые требования по результатам реального первого теста Mini App. Это приоритетнее следующего широкого редизайна.

Для каждого пункта:

1. найди точную причину в текущем `main`;
2. воспроизведи дефект до изменения;
3. внеси минимальное behavior-preserving исправление;
4. добавь или уточни targeted regression test там, где он способен поймать дефект;
5. проверь результат в mobile browser и, когда поведение зависит от Telegram, в реальном Telegram WebView;
6. не объявляй пункт завершённым только по `build` или скриншоту статичного состояния.

Не проводи перед этим новый общий repository/UI audit: требования уже конкретны.

### 3 — Вернуть обычный формат Mini App

- Приложение не должно запрашивать Telegram Full Screen.
- Сохрани обычный расширенный формат Mini App через поддерживаемый `expand`, но убери автоматический `requestFullscreen` и fullscreen-specific lifecycle, если он больше нигде не нужен.
- Проверь запуск из Telegram на поддерживаемом клиенте: Mini App открывается в обычном формате, пользователь видит стандартный Telegram chrome и может закрыть приложение ожидаемым способом.

### 5 — Исправить tabbar и убрать задержку переключения

- Tabbar не должен выделяться как текст при tap/drag; отключи text selection и нежелательный tap highlight только для интерактивной области, не глобально для всего приложения.
- Активное состояние и контент выбранного экрана должны начинать меняться сразу после tap, без искусственной задержки.
- Индикатор должен двигаться только по горизонтали по устойчивой траектории с неизменными высотой и вертикальной координатой.
- Переход слева в центр не должен подпрыгивать вверх; переход из центра вправо не должен ударяться о край или отскакивать.
- Не используй bounce/overshoot для основного tabbar. Движение в обе стороны должно быть симметричным, interruptible и корректным при быстрых повторных переключениях.
- Проверь последовательности `История → Матчи → Профиль`, обратное направление и быстрые taps на реальном mobile viewport.

### 6 и 8 — Восстановить emoji в большом и мини-аватаре

- Выбранный emoji должен отображаться в большом аватаре профиля, мини-аватаре header и на всех других страницах.
- Если выбран emoji, default user icon не должна оставаться поверх, под ним или рядом с ним.
- Размер и оптическое положение emoji должны быть согласованы отдельно для большого и мини-аватара; нельзя масштабировать desktop/system glyph так, чтобы он обрезался или исчезал.
- Переход mini-avatar ↔ back icon должен сохранять выбранный emoji и корректно скрывать default path.
- Добавь regression coverage минимум для `null`, emoji и `data:image/...` avatar values.

### 11 — Починить progressive loading истории

- Удали видимый компонент пагинации для больших списков матчей.
- Когда пользователь приближается к концу уже загруженного списка, автоматически запроси следующую порцию и добавь её без замены существующих строк и без скачка scroll position.
- Sentinel должен находиться перед фактическим концом контента, чтобы данные успевали загрузиться до упора в список.
- Защити flow от параллельных повторных запросов, дублей, stale response и бесконечного повторного вызова после `has_more = false`.
- Покажи локальное состояние загрузки; при ошибке сохрани уже загруженную историю и дай повторить только следующий batch.
- Проверь global «Историю игр», а также вкладки статистики «По дням» и «По играм». Unit-test одного `IntersectionObserver` недостаточен: нужен integration/e2e сценарий с несколькими порциями данных и фактическим append.

### 12 — Упростить dialog с цифровой клавиатурой

- Для режима изменения матчей заголовок dialog: **«Изменить счёт»**.
- Для режима изменения мячей заголовок dialog: **«Изменить мячи»**.
- Убери видимые дополнительные заголовки/labels **«Общий счёт мячей»**, **«Общий итог мячей»** и **«Общий счёт с …»** над переключателем значений.
- Сохрани доступное имя групп и клавиатуры через `aria-label`/`aria-labelledby`, но не возвращай удалённый визуальный текст ради accessibility.

### 20 — Один Apple emoji style на всех платформах

- Emoji должны снова отображаться во всех местах: picker, большой avatar, mini-avatar/header, уровни и другие пользовательские поверхности.
- Внешний вид не должен зависеть от системного emoji-font пользователя; требование продукта — единый Apple emoji style.
- CSS font stack с `Apple Color Emoji` не гарантирует Apple rendering на Android/Windows и не считается выполнением требования.
- Используй один общий renderer/asset pipeline для emoji. Перед добавлением Apple assets проверь право на их распространение. Если repository не содержит лицензированного Apple-compatible набора, остановись и запроси у пользователя легальный asset source либо отдельное решение об альтернативном едином наборе; не выдавай Noto/system emoji за Apple.
- Предусмотри понятный fallback, чтобы при ошибке загрузки asset emoji не становились невидимыми.
- Проверь несколько emoji, variation selectors и одинаковый rendering минимум в iOS Telegram, Android Telegram и desktop browser.

### 23 — Перенести progressive blur под нижний control

- Progressive blur — viewport layer, а не элемент в конце списка.
- На главных экранах он должен располагаться визуально **под tabbar**, а на экранах с акцентной нижней кнопкой — **под этой кнопкой**.
- Правильный z-order: scroll content → progressive blur → tabbar/акцентная кнопка.
- Blur остаётся привязанным к нижней границе viewport и safe area, не уезжает вместе со списком и не перекрывает интерактивный control.
- Начало градиента должно мягко размывать контент, который проходит под control; сам tabbar/кнопка остаются резкими и кликабельными.
- Проверь «Историю игр», «По дням», «По играм» и экраны с нижней accent action на коротком и длинном контенте.

### 26 — Добавить carousel-переход между тремя главными экранами

- Сохрани понравившуюся пользователю directional/carousel animation между вкладками статистики.
- Примени тот же язык перехода к трём главным экранам: `История`, `Матчи`, `Профиль`.
- Направление движения соответствует положению вкладок; обратное переключение зеркально.
- Tabbar и нижние fixed layers остаются неподвижными; анимируется содержимое экрана, а не весь viewport chrome.
- Переход начинается сразу, не блокирует tap и корректно прерывается новым выбором вкладки.
- Не допускай горизонтального overflow, белого кадра, скачка scroll position или layout height. Для reduced motion используй короткую opacity-only замену.

### 27 — Исправить Vaul для «Добавить счёт»

- При открытии уменьшается только экран позади dialog; overlay и сам Vaul drawer не должны входить в масштабируемый container.
- Drawer располагается поверх background, прилегает к нижнему краю и занимает всю доступную ширину Mini App.
- Высота drawer определяется содержимым клавиатуры и безопасными отступами; он не должен быть во всю высоту экрана. Для маленького viewport допустим ограниченный внутренний scroll вместо превращения drawer в fullscreen.
- Сохрани закрытие жестом/handle, Telegram Back, focus lifecycle и введённый счёт при неуспешной отправке.
- Проверь layering и transform origin на реальном Telegram WebView: background масштабируется один раз, dialog остаётся резким, полноширинным и визуально независимым.

## 4. Existing system first

Сначала найди фактические active imports и usages. Классифицируй существующие решения как:

```text
KEEP
ADAPT
CONSOLIDATE
REPLACE
```

Сохраняй рабочие границы:

- `TennisService` как общий application seam;
- `web/src/api/client.ts` и `web/src/api/types.ts` как текущую transport boundary;
- `web/src/lib/tma.ts` как Telegram capability adapter;
- semantic theme, accent, status, material и motion tokens;
- `motion/react` как основной animation engine;
- существующие server-side auth, ownership и domain invariants.

`web/mini-app` и `web/primitives` — источники отдельных решений, а не готовая production design system. Не подключай их wholesale и не создавай параллельную систему компонентов.

## 5. Frontend safety gate

Backlog-задача `P4-001` уже может быть выполнена в текущем `main`. Сначала проверь существующие ESLint/Vitest/Playwright gates и расширяй их только targeted regression-сценариями для затрагиваемого correction slice:

- выбери lint runner на основании текущего TypeScript/React toolchain;
- добавь focused tests только для критичных состояний затрагиваемого slice;
- добавь один устойчивый e2e smoke path для запуска Mini App, загрузки профиля и ключевого happy path с контролируемым Telegram `initData`/test environment;
- включи выбранные проверки в CI;
- не подменяй unit/e2e проверку production build-ом;
- не гонись за coverage percentage.

Если production-like Telegram e2e требует секретов или новой внешней инфраструктуры, остановись на локальном/CI contract smoke и явно назови непроверенный реальный Telegram слой.

## 6. Правило декомпозиции `main.tsx` и `styles.css`

Активный UI всё ещё сконцентрирован в больших `web/src/main.tsx` и `web/src/styles.css`. Разделяй их **постепенно во время редизайна**, а не отдельным массовым rewrite.

Для каждого выбранного screen/flow:

1. зафиксируй текущее поведение и critical states;
2. найди код и стили, которые меняются по одной причине;
3. выдели минимальный feature/component/hook/style boundary только если это помогает текущей работе;
4. сохрани API, Telegram и domain behavior;
5. проверь slice до перехода к следующему экрану.

Предпочтительное направление, только при подтверждённой пользе:

```text
web/src/
  app/
  features/
    profile/
    opponents/
    scoring/
    statistics/
    settings/
  components/
  api/
  lib/
  styles/
```

Это не обязательная целевая структура. Не создавай пустые слои, barrel-файлы и универсальные primitives «на будущее». Объединяй только реализации с одной причиной меняться.

## 7. Порядок редизайна

Работай вертикальными slices, после каждого из которых приложение остаётся пригодным к запуску.

Рекомендуемый порядок:

1. выбрать один репрезентативный экран и утвердить visual direction;
2. закрепить foundation: typography, color, spacing, surfaces и navigation rules;
3. реализовать один end-to-end flow с его loading/empty/error/success states;
4. проверить Telegram WebView, mobile viewport, safe areas и accessibility;
5. распространить подтверждённые правила на следующий cohesive screen family;
6. удалить только те старые варианты, которые больше не используются;
7. провести финальную consistency и regression проверку.

Не делать сначала глобальный token rewrite, а затем надеяться, что все экраны автоматически станут лучше.

## 8. Motion и interaction craft

Для interaction/component work используй `$emil-design-eng`.

Для новой animation:

```text
$emil-design-eng
→ $animate
→ implementation
→ $review-animations
```

Для улучшения существующей animation:

```text
$review-animations
→ $emil-design-eng / $animate
→ implementation
→ $review-animations
```

Сохраняй быстрые high-frequency actions. Motion должна объяснять связь состояний, давать feedback или поддерживать spatial continuity. Не добавляй декоративное движение, blur и springs без функции. Учитывай interruptibility, touch, reduced motion, reduced transparency и производительность Telegram WebView.

## 9. Тексты и system feedback

Для русских пользовательских текстов используй `$sasha`.

Для async/loading/error/offline/copy/save/delete flows используй `$system-feedback`; если меняется copy — вместе с `$sasha`.

Не лечи структурную проблему дополнительным текстом. Пользователь должен понимать:

- что происходит;
- завершилось ли действие;
- сохранены ли введённые данные;
- что можно сделать после ошибки;
- актуальны ли показанные данные.

## 10. API contracts и identity

`P4-002` и `P4-003` находятся в backlog, но не должны автоматически расширять visual redesign.

- Explicit API response contracts можно выполнять отдельным behavior-preserving slice после frontend safety gate или перед вторым non-Telegram client.
- OpenAPI codegen вводить только при доказанной экономии поддержки.
- Product identity separation выполнять только после решения account linking, collision, recovery и provider semantics.
- Identity migration должна быть additive, проверяемой и обратимой; destructive schema rewrite запрещён без отдельного одобрения, backup и rollback plan.

## 11. Проверка каждого slice

Используй реальные project commands:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/tennis-bot-pyc python3 -m unittest discover -s tests
cd web && npm run build
```

После добавления frontend gates запускай также новые lint/test/e2e команды и включай их в `scripts/verify.sh` или CI только если они воспроизводимы.

Для UI обязательно разделяй:

- static checks;
- browser visual inspection;
- реальный Telegram WebView/device check.

Проверяй минимум:

- light/dark Telegram theme;
- узкий mobile viewport и safe areas;
- keyboard/focus/Escape/back behavior;
- VoiceOver-relevant semantics;
- loading/empty/error/offline/stale states;
- reduced motion/transparency;
- touch targets и repeated score actions;
- отсутствие регрессий текстового бота и API.

Build не является доказательством визуального качества или e2e-поведения.

## 12. Documentation и changelog

После meaningful implementation:

- обнови `CHANGELOG.md` через `$changelog-discipline`;
- обновляй `ARCHITECTURE.md` только если реально изменилась boundary;
- отмечай backlog item done только с evidence;
- не переносись из `ideas/` в scope без решения пользователя;
- зафиксируй актуальный live Railway status вместо утверждения, что production не проверен.

## 13. Git и deploy safety

- Сначала проверь branch и working tree.
- Сохраняй unrelated пользовательские изменения.
- Стадируй только явные paths; не используй `git add -A`.
- Не коммить secrets, `.env`, database URLs, dumps или user data.
- Не force-push и не обходи checks.
- Push, PR, merge, Railway deploy, destructive migration и публикация требуют явного подтверждения пользователя.
- Не устанавливай и не предлагай ngrok или другие traffic tunnels.

## 14. Формат работы и отчёта

Перед implementation дай короткий результат исследования:

```text
1. Что именно делает внешний вид слабым
2. Что нужно сохранить
3. Предлагаемое visual direction или варианты
4. Первый безопасный vertical slice
5. Как будет проверен результат
6. Что не входит в scope
```

После каждого завершённого slice сообщай:

- что изменилось для пользователя;
- какие boundaries были выделены и почему;
- что проверено автоматически;
- что проверено визуально;
- что не проверено;
- какие риски остались;
- один ближайший следующий шаг.

## 15. Начинай Phase 4

1. Проверь branch, working tree и фактический production/frontend state.
2. Прочитай `PROJECT.md`, релевантный `ARCHITECTURE.md`, backlog и только совпадающие ideas/decisions.
3. Подтверди активный component/style/token import graph.
4. Если correction pass выше не завершён, не начинай новый visual discovery: воспроизведи и исправь подтверждённые дефекты небольшими проверяемыми slices.
5. Не переоткрывай принятые требования из correction pass через `$ask-nodumb`; используй Skill только для ещё не выбранного нового визуального направления.
6. После correction pass, если направление не утверждено, подготовь 2–3 разные концепции одного экрана без изменения production-кода.
7. Предложи один небольшой vertical slice и нужный ему frontend safety gate.
8. После выбора реализуй slice, одновременно выделяя только полезные boundaries из `main.tsx` и `styles.css`.
9. Проведи automated, browser и Telegram-specific validation пропорционально риску.
10. Не начинай турниры, identity migration, iOS или полный rewrite.
11. Продолжай экран за экраном только после подтверждения предыдущего slice.

Итоговая цель Phase 4:

```text
не новый framework
не новый продукт
не максимальное количество компонентов
не визуальная косметика поверх прежних проблем

а

сильный и узнаваемый Mini App
ясная визуальная иерархия
быстрые сценарии
последовательные interactions
доступные состояния
frontend, который становится проще по мере редизайна
```
