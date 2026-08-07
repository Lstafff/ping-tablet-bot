# Mini App UI Kit

Исходный набор React-компонентов для Telegram Mini Apps. Он не публикуется как
npm-пакет: папки `mini-app` и `primitives` копируются в проект рядом друг с
другом. Адаптировано из библиотеки Ильи Гришина.

```text
project/
├── primitives/
└── mini-app/
```

## Использование

Подключите обязательные стили один раз:

```js
import "./mini-app/styles/index.css"
```

Оберните приложение в provider и импортируйте компоненты напрямую из исходников:

```jsx
import MiniAppProvider from "./mini-app/MiniAppProvider"
import { RegularButton } from "./mini-app/components/Button"

export default function App() {
    return (
        <MiniAppProvider>
            <RegularButton variant="filled" label="Continue" />
        </MiniAppProvider>
    )
}
```

`styles/app-shell.css` подключается отдельно и только когда Mini App занимает
всю страницу: он задаёт стили `body` и safe-area. Для встраивания UI kit в
существующий интерфейс этот файл не нужен.

Сложные компоненты сохранены, поэтому принимающему React-проекту нужны их runtime-
зависимости: `prop-types`, `motion`, `@lisse/core`, `@lisse/react`,
`@tanstack/react-virtual`, `calligraph`, `clsx`, `colorthief`,
`markdown-to-jsx` и `wouter`.

## Storybook

Storybook относится к исходному проекту UI kit и не включён в приложение. Для
Mini App используются только runtime-компоненты из этой папки.

## Документация

- [Каталог компонентов](agent/COMPONENTS.md)
