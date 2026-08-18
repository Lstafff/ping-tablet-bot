# Changelog

Заметные изменения Tennis / Ping Tablet и причины решений. Формат основан на Keep a Changelog, но записи описывают продуктовые и архитектурные решения, а не коммиты.

## [Unreleased]

### Added

- **Phase 4 frontend quality gates.** ESLint, focused Vitest component tests and a mobile Playwright smoke path now run with the existing production build in `scripts/verify.sh` and CI. The narrow suite covers progressive loading and the critical Vaul score-entry path without introducing a coverage target.
- **Telegram App entrypoint.** The bot registers a persistent `App` menu button beside the Telegram composer and opens the Mini App in Telegram's standard expanded format.
- **Phase 3 repository control plane.** Добавлены краткие правила агента, карта фактической архитектуры, backlog, Product Memory и реестр pinned upstream Skills. Раньше durable context был распределён между кодом и чатами; теперь будущая работа может загружать только релевантные документы и не выдавать planned architecture за current.
- **Evidence-based Phase 3 audit.** Зафиксированы сильные стороны, подтверждённые риски, pre-tournament readiness и последовательность безопасных slices. Это сохраняет работающий `TennisService` и текущую UI-систему вместо большого rewrite.
- **Security baseline.** Запечатан standard scan с тремя medium availability findings; auth bypass, unrelated-object IDOR, injection и secret leakage не подтверждены. Shared linked-history reset вынесен в product policy, а не объявлен vulnerability без доказанной модели владения.
- **Versioned Postgres migrations.** Добавлены schema ledger, advisory lock, standalone runner и CI/Railway migration step. Bot и API больше не выполняют DDL при старте, поэтому schema ownership воспроизводим и не зависит от гонки entrypoint-ов.
- **API safety harness.** FastAPI получил injectable app factory, ранний byte limit для JSON, route tests для auth/ownership/413 и отдельные dev dependencies. Это защищает boundary до разбора больших bodies и делает routes проверяемыми без production database.
- **Reproducible delivery boundary.** Добавлены Python 3.12/Node 22 pins, multi-stage Docker image, два Railway config-as-code файла и GitHub CI с Postgres integration suite и frontend build.
- **Locked Python environments.** Production и CI используют exact dependency locks, полученные из проверенного Python 3.12 окружения; диапазоны остаются только manifest-ами для осознанного обновления.
- **Durable architecture decisions.** Зафиксированы owner-local linked history, Railway topology/migration owner и staged product-identity direction, чтобы будущая работа не переоткрывала уже выбранные границы.

### Changed

- **Рейтинг ФНТР объединён с уровнями.** Отдельный переход в «Рейтинг» отключён, а добавление и сброс рейтинга перенесены под список уровней. ФНТР-рейтинг использует существующее серверное правило и сразу переводит игрока в «Профик»; профиль и текущий уровень отмечаются компактным badge «ФНТР». Отдельный экран отвергнут, потому что он разделял два представления одного статуса и скрывал результат сохранения за обратным переходом.
- **Collapsing opponent header and contextual Back.** Страница статистики соперника больше не показывает отдельный заголовок «статистика»: прежние аватар, имя и счёт образуют один sticky-хэдер и по скроллу компактно собираются в строку, меняя только transform/opacity/color. Back возвращает в общую историю, если соперник был открыт из неё, и на главную — если он был открыт из списка матчей.
- **Explicit API response boundary (P4-002).** Все текущие FastAPI routes получили Pydantic response models и OpenAPI-схемы стабильных ошибок; TypeScript types синхронизированы с фактическими полями. Ручное зеркало и обязательный checklist выбраны вместо codegen, пока существует один TypeScript-клиент; P4-001 подтверждён актуальными ESLint/Vitest/Playwright gates в архитектурной документации.
- **History match navigation.** Каждый матч в общей истории теперь открывает статистику соответствующего соперника; строка остаётся целиком доступной кнопкой вместо отдельного вложенного действия.
- **Header title transition.** Main headers now replace text with a restrained vertical per-letter wave: the old title leaves upward and the new title enters from below. The earlier slot-layout morph remains exported as `LegacyMorphingHeaderTitle` for later experiments, but was removed from the active path because its layout interpolation made routine navigation feel unstable.
- **Mini App mobile interaction pass.** History and opponent tables load progressively, opponent score entry uses a bounded Vaul drawer and an in-app numeric keypad, edit totals use the same keypad pattern, opponent tabs transition with restrained spatial continuity, and the bottom tabbar morphs into the context action without spring overshoot or glow.
- **Temporary debug typography and emoji rendering.** The frontend bundles SF Pro Rounded as the primary debug UI font. Avatar, level and picker emoji now use each platform's native color emoji stack; the bundled Noto webfont was removed because it could shadow Android WebView's native font and leave glyphs invisible. A uniform Apple-style set still requires a separately licensed asset source.
- README и `.env.example` теперь описывают bot, FastAPI, Mini App и фактически используемые WebApp variables. Неопределённая production topology названа явно, а локальная Web-сборка больше не выглядит доказательством полного deploy.
- **Linked reset/delete semantics.** Сброс и удаление теперь меняют только состояние инициатора; данные второй стороны сохраняются и восстанавливают зеркало после новой партии. Если данные очищены у обоих, следующая партия начинает счёт с нуля. Undo одной партии остаётся shared correction её создателя.
- **Bounded score/history paths.** Обычный linked score обновляет две Elo-записи инкрементально, а общая история пагинируется SQL-запросом. Полные rebuild остаются только на редких destructive corrections.
- **Mini App data boundary.** API client и TypeScript contracts вынесены из `main.tsx`; score mutation возвращает актуальный profile/opponent state, поэтому успешное сохранение больше не ждёт семь повторных GET.
- **Action feedback.** Pending state разделён по action family, operation id и введённый score сохраняются при retry, stale opponent responses игнорируются, invite/edit/avatar errors показываются в активном слое.
- **Destructive-action copy.** Bot и Mini App больше не обещают удаление всей общей истории одним игроком; подтверждения точно объясняют локальное действие, восстановление и старт с нуля.
- **Accessible motion and theme adaptation.** Диалоги получили focus lifecycle и Escape, edit sheet — обратимую drawer-траекторию, reduced-motion/transparency режимы отключают лишние эффекты, а muted/focus semantic tokens проходят более строгий контрастный baseline.

### Fixed

- **Обратная навигация вложенных экранов.** При возврате со страницы соперника, «Уровня» и следующих вложенных экранов исходящая страница теперь целиком уходит вправо, открывая предыдущую под собой. Раньше для всех переходов вне главного tabbar направление принудительно становилось нулевым и экран исчезал мгновенно; отдельный back-transition сохраняет прежнюю анимацию главных вкладок и отключает позиционный сдвиг при reduced motion.
- **Responsive add-score flow and shared selector.** Центральный `+` теперь открывает sheet коротким transform/opacity-переходом без shared-layout морфа, а выбор соперника показывает Vaul-клавиатуру сразу, не ожидая статистику из сети. Переключатели игрока и вкладок статистики используют один CSS-transform компонент; лишняя карточка соперника на экране счёта удалена.
- **History reorder motion.** Смена направления истории снова анимирует только строки матчей. Sticky-группы намеренно не участвуют в layout-анимации: прежний общий morph конфликтовал с закреплёнными заголовками и просвечивающим фоном.
- **Faster initial and opponent screens.** Первый экран больше не ждёт историю, а страница соперника не блокируется на таблицах и выборке 100 игр: профиль и общий счёт открывают интерфейс, вторичные данные догружаются независимо.
- **Shared linked profiles.** Имя и аватар связанного игрока теперь читаются из его актуального профиля и показываются второму игроку в списке и sticky-хэдере; локальная копия в связи больше не скрывает изменения.
- **Opponent header collapse.** Аватар при скролле уменьшается, уходит вверх и полностью исчезает; имя и счёт собираются по центру в двухстрочный заголовок общего цвета, а строка побед и партий поднимается и плавно затухает.
- **Mini App cache revalidation.** Production HTML теперь всегда перепроверяется после открытия, а хешированные Vite assets кешируются как immutable на год. Раньше static mount не задавал `Cache-Control`, поэтому Telegram WebView мог продолжать запускать старый frontend после успешного Railway deploy; query-параметр в `WEBAPP_URL` отвергнут как ручной и одноразовый cache-bust.
- История получила сплошной непрозрачный sticky-слой под page header и заголовками периодов. Заголовок периода теперь ограничен собственной группой и уходит вместе с последним матчем; возврат во вкладку не заменяет уже прогруженную историю первой страницей и сохраняет позицию скролла.
- Компактный аватар больше не участвует в shared-layout переходе с большим профильным аватаром и остаётся неподвижным между главными вкладками. Волна заголовка укладывается в 180 ms экранного перехода, поэтому хвост предыдущего текста не остаётся на новом экране.
- Opponent/edit/profile navigation no longer stretches «Редактировать», animates a readable opponent score, or leaves overlapping screens during non-tab transitions. History restores saved scroll before paint and skips its whole-screen slide when returning to a previously scrolled position.
- History now keeps its page header and current period heading visible while scrolling; the activity endpoint label is anchored to the right edge, and the Vaul score-drawer handle is centered with one unambiguous positioning rule.
- The progressive-loading browser check now waits past the existing opponent-tab exit transition before counting rows; this removes a test-only race where outgoing and incoming tables briefly appeared together, without changing product behavior.
- Initial data loading no longer shows the branded «Загружаем матч» screen. Opening an opponent renders cached opponent identity and score while fresh data arrives instead of remounting and reanimating the home score.
- Undo for the most recently saved score is now an icon action immediately to the right of «Добавить счёт» and disappears again after the undo completes.
- Invite sharing no longer repeats the «Твой код» label, modal close/back icons are larger, and nested action sheets use an actual back arrow instead of a close icon.
- Кнопки и tabbar больше не допускают выделение текста, touch highlight или прилипший outline; tab indicator no longer springs or rebounds against its edges.
- Мини-аватар использует ту же геометрию, что и основной профиль, корректно скрывает дефолтный контур при выбранном avatar emoji, а режим настроек сохраняет центральную ось аватара, имени и Telegram username.
- Модальные и action-sheet поверхности сохраняют боковые отступы и увеличенное скругление; ввод кода не разворачивает диалог на весь экран, а низкий viewport не выводит кнопку Vaul за интерактивную область.
- Тексты и состояния синхронизированы: «Текущая серия», «Профессиональный рейтинг», нейтральный активный уровень с галочкой и совпадающая с heatmap легенда активности.
- **Railway API port expansion.** API entrypoint теперь запускается через shell и передаёт `uvicorn` числовой `$PORT` с локальным fallback `8080`. Раньше Railway передавал строку `$PORT` буквально, из-за чего первый production healthcheck завершался ошибкой; жёсткий порт отвергнут, чтобы сохранить назначаемый платформой ingress port.
- Повторная отправка одного score operation больше не создаёт вторую game и второй Elo event.
- Повторное использование score operation для другого счёта или соперника отклоняется с `409`, а не возвращает несвязанную игру.
- Устранена возможность первого linked reset/delete незаметно стереть статистику и Elo второго игрока.
- Большой JSON отклоняется с `413` до Pydantic parsing; avatar сохраняет отдельный достаточный лимит.
- Ошибки mutations после первоначальной загрузки больше не остаются в невидимом state.
- Browser preview использует тот же расширенный score response, что и production API, поэтому демонстрационное сохранение не падает после refactor-а контракта.
