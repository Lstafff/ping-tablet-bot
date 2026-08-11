# Changelog

Заметные изменения Tennis / Ping Tablet и причины решений. Формат основан на Keep a Changelog, но записи описывают продуктовые и архитектурные решения, а не коммиты.

## [Unreleased]

### Added

- **Phase 3 repository control plane.** Добавлены краткие правила агента, карта фактической архитектуры, backlog, Product Memory и реестр pinned upstream Skills. Раньше durable context был распределён между кодом и чатами; теперь будущая работа может загружать только релевантные документы и не выдавать planned architecture за current.
- **Evidence-based Phase 3 audit.** Зафиксированы сильные стороны, подтверждённые риски, pre-tournament readiness и последовательность безопасных slices. Это сохраняет работающий `TennisService` и текущую UI-систему вместо большого rewrite.
- **Security baseline.** Запечатан standard scan с тремя medium availability findings; auth bypass, unrelated-object IDOR, injection и secret leakage не подтверждены. Shared linked-history reset вынесен в product policy, а не объявлен vulnerability без доказанной модели владения.
- **Versioned Postgres migrations.** Добавлены schema ledger, advisory lock, standalone runner и CI/Railway migration step. Bot и API больше не выполняют DDL при старте, поэтому schema ownership воспроизводим и не зависит от гонки entrypoint-ов.
- **API safety harness.** FastAPI получил injectable app factory, ранний byte limit для JSON, route tests для auth/ownership/413 и отдельные dev dependencies. Это защищает boundary до разбора больших bodies и делает routes проверяемыми без production database.
- **Reproducible delivery boundary.** Добавлены Python 3.12/Node 22 pins, multi-stage Docker image, два Railway config-as-code файла и GitHub CI с Postgres integration suite и frontend build.
- **Locked Python environments.** Production и CI используют exact dependency locks, полученные из проверенного Python 3.12 окружения; диапазоны остаются только manifest-ами для осознанного обновления.
- **Durable architecture decisions.** Зафиксированы owner-local linked history, Railway topology/migration owner и staged product-identity direction, чтобы будущая работа не переоткрывала уже выбранные границы.

### Changed

- README и `.env.example` теперь описывают bot, FastAPI, Mini App и фактически используемые WebApp variables. Неопределённая production topology названа явно, а локальная Web-сборка больше не выглядит доказательством полного deploy.
- **Linked reset/delete semantics.** Сброс и удаление теперь меняют только состояние инициатора; данные второй стороны сохраняются и восстанавливают зеркало после новой партии. Если данные очищены у обоих, следующая партия начинает счёт с нуля. Undo одной партии остаётся shared correction её создателя.
- **Bounded score/history paths.** Обычный linked score обновляет две Elo-записи инкрементально, а общая история пагинируется SQL-запросом. Полные rebuild остаются только на редких destructive corrections.
- **Mini App data boundary.** API client и TypeScript contracts вынесены из `main.tsx`; score mutation возвращает актуальный profile/opponent state, поэтому успешное сохранение больше не ждёт семь повторных GET.
- **Action feedback.** Pending state разделён по action family, operation id и введённый score сохраняются при retry, stale opponent responses игнорируются, invite/edit/avatar errors показываются в активном слое.
- **Destructive-action copy.** Bot и Mini App больше не обещают удаление всей общей истории одним игроком; подтверждения точно объясняют локальное действие, восстановление и старт с нуля.
- **Accessible motion and theme adaptation.** Диалоги получили focus lifecycle и Escape, edit sheet — обратимую drawer-траекторию, reduced-motion/transparency режимы отключают лишние эффекты, а muted/focus semantic tokens проходят более строгий контрастный baseline.

### Fixed

- **Railway API port expansion.** API entrypoint теперь запускается через shell и передаёт `uvicorn` числовой `$PORT` с локальным fallback `8080`. Раньше Railway передавал строку `$PORT` буквально, из-за чего первый production healthcheck завершался ошибкой; жёсткий порт отвергнут, чтобы сохранить назначаемый платформой ingress port.
- Повторная отправка одного score operation больше не создаёт вторую game и второй Elo event.
- Повторное использование score operation для другого счёта или соперника отклоняется с `409`, а не возвращает несвязанную игру.
- Устранена возможность первого linked reset/delete незаметно стереть статистику и Elo второго игрока.
- Большой JSON отклоняется с `413` до Pydantic parsing; avatar сохраняет отдельный достаточный лимит.
- Ошибки mutations после первоначальной загрузки больше не остаются в невидимом state.
- Browser preview использует тот же расширенный score response, что и production API, поэтому демонстрационное сохранение не падает после refactor-а контракта.
