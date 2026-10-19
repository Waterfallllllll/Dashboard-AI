---
version: alpha
name: Evergreen Dashboard
description: Спокойная, модульная и доступная дизайн-система персонального информационного дашборда.
---

# Evergreen Dashboard Design System

Этот файл является источником истины для визуального языка продукта. Значения в YAML-блоках нормативны; текст объясняет назначение и правила применения.

Дизайн основан на требованиях [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md) и визуальном направлении [Task Management Dashboard](https://dribbble.com/shots/25241984-Task-Management-Dashboard). Референс используется для композиции, плотности и настроения, но не копируется буквально.

Структура документа соответствует спецификации [DESIGN.md Format](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md).

## Overview

Evergreen Dashboard — персональное рабочее пространство, которое должно ощущаться спокойным, собранным и живым. Интерфейс объединяет разнородные данные, но не должен выглядеть как тяжёлая корпоративная аналитика.

### Характер продукта

- **Спокойный:** тёплая светлая основа, мягкие границы, минимум визуального шума.
- **Сфокусированный:** один глубокий зелёный акцент направляет внимание на основное действие.
- **Персональный:** погода, время, рутины и таймер создают ощущение собственного пространства.
- **Надёжный:** понятные состояния синхронизации, ошибок и разрешений.
- **Компактный:** высокая информационная ценность без тесноты.
- **Живой:** погодная сцена и точечные micro-interactions добавляют динамику.

### Визуальная формула

```text
Тёплый нейтральный фон
+ белые модульные карточки
+ глубокий evergreen-акцент
+ крупные числовые показатели
+ тонкие контуры
+ мягкие радиусы
+ редкая осмысленная анимация
```

### Основные принципы

1. Информация важнее декора.
2. Зелёный цвет обозначает активность, прогресс и основные действия, а не заполняет весь экран.
3. Глубина создаётся преимущественно тональными слоями и границами.
4. В каждый момент у экрана есть одно очевидное главное действие.
5. Состояние нельзя передавать только цветом: необходимы иконка, текст или форма.
6. Карточки должны хорошо выглядеть в любом разрешённом размере виджета.
7. Mobile — самостоятельный сценарий, а не уменьшенная desktop-версия.

### Голос интерфейса

- Короткие предложения.
- Конкретные действия: «Подключить календарь», «Повторить», «Разрешить уведомления».
- Sentence case вместо постоянного uppercase.
- Ошибка объясняет проблему и следующий шаг.
- Технические названия провайдеров допустимы только там, где помогают принять решение.

## Colors

Палитра построена вокруг глубокого зелёного Evergreen и тёплых нейтральных оттенков. Чистый чёрный не используется для больших поверхностей, чистый белый применяется только для карточек и контрастных элементов.

### Основные роли

- **Evergreen:** CTA, активная навигация, прогресс, focus ring и подтверждённые состояния.
- **Warm neutral:** фон приложения, карточки, разделители и основной текст.
- **Semantic colors:** только ошибки, предупреждения и информационные состояния.
- **Weather colors:** ограничены погодным виджетом и не меняют семантику остальных компонентов.

### Светлая тема

- Основной фон — `surface-page`.
- Sidebar и top bar — `surface-subtle`.
- Карточки — `surface-card`.
- Вложенные области и skeleton — `surface-muted`.
- Основной текст — `text-primary`.
- Вторичный текст — `text-secondary`.

### Тёмная тема

Тёмная тема не является инверсией. Она использует зеленовато-графитовые поверхности, сниженный контраст границ и более светлый Evergreen для интерактивных элементов.

```yaml
colors:
  primary-950: "#062B1D"
  primary-900: "#093D2A"
  primary-800: "#0B5137"
  primary-700: "#0D6844"
  primary-600: "#0F7A4F"
  primary-500: "#15915F"
  primary-400: "#38AF7A"
  primary-300: "#79CBA4"
  primary-200: "#B7E6CF"
  primary-100: "#DDF4E8"
  primary-50: "#F0FAF5"

  neutral-950: "#111512"
  neutral-900: "#1A201C"
  neutral-800: "#2C352F"
  neutral-700: "#465149"
  neutral-600: "#5F6B63"
  neutral-500: "#7B867E"
  neutral-400: "#A0AAA3"
  neutral-300: "#C5CCC7"
  neutral-200: "#DEE3DF"
  neutral-100: "#EDF0ED"
  neutral-50: "#F6F7F5"
  neutral-0: "#FFFFFF"

  surface-page: "#F3F5F2"
  surface-subtle: "#F8F9F7"
  surface-card: "#FFFFFF"
  surface-muted: "#EDF1ED"
  surface-selected: "#E5F4EC"
  surface-overlay: "rgba(17, 21, 18, 0.48)"

  text-primary: "#151A17"
  text-secondary: "#5F6B63"
  text-tertiary: "#7B867E"
  text-disabled: "#A0AAA3"
  text-on-primary: "#FFFFFF"
  text-link: "#0D6844"

  border-subtle: "#E4E8E4"
  border-default: "#D3DAD4"
  border-strong: "#AEB9B1"
  focus-ring: "#15915F"

  success: "#0F7A4F"
  success-surface: "#E5F4EC"
  warning: "#8A5A00"
  warning-surface: "#FFF3D6"
  error: "#B4232E"
  error-surface: "#FDECEE"
  info: "#285EA8"
  info-surface: "#EAF2FD"

  dark-surface-page: "#0E1410"
  dark-surface-subtle: "#121A15"
  dark-surface-card: "#18211B"
  dark-surface-muted: "#222D25"
  dark-surface-selected: "#193A2A"
  dark-surface-overlay: "rgba(0, 0, 0, 0.68)"
  dark-text-primary: "#F2F5F3"
  dark-text-secondary: "#B4BEB7"
  dark-text-tertiary: "#8F9B93"
  dark-text-disabled: "#657168"
  dark-border-subtle: "#29342C"
  dark-border-default: "#354238"
  dark-border-strong: "#526057"
  dark-primary: "#62D69D"
  dark-primary-hover: "#7DE1AE"
  dark-text-on-primary: "#082719"

  weather-clear: "#5B9FCF"
  weather-cloud: "#8FA6AD"
  weather-rain: "#476D82"
  weather-storm: "#293F4A"
  weather-snow: "#E8F2F5"
  weather-fog: "#A8B5B1"
  weather-night: "#123C35"
```

### Контраст

- Обычный текст должен соответствовать WCAG 2.2 AA: не менее `4.5:1`.
- Крупный текст и значимые графические элементы: не менее `3:1`.
- `text-tertiary` используется только для вспомогательного текста, а не для обязательных инструкций.
- Белый текст допускается на `primary-600` и более тёмных оттенках.
- В тёмной теме основной интерактивный цвет — `dark-primary`, текст на нём — `dark-text-on-primary`.
- Погодная иллюстрация всегда имеет локальный scrim, если изображение снижает читаемость текста.

### Реализация темы

В SCSS токены отображаются в semantic CSS custom properties:

```scss
:root {
  color-scheme: light;
  --color-page: #f3f5f2;
  --color-card: #ffffff;
  --color-text: #151a17;
  --color-text-muted: #5f6b63;
  --color-border: #e4e8e4;
  --color-primary: #0f7a4f;
}

[data-theme='dark'] {
  color-scheme: dark;
  --color-page: #0e1410;
  --color-card: #18211b;
  --color-text: #f2f5f3;
  --color-text-muted: #b4beb7;
  --color-border: #29342c;
  --color-primary: #62d69d;
}
```

Компоненты используют semantic properties, а не raw palette values.

## Typography

Основной шрифт — **Geist Sans**. Он нейтрален, хорошо работает с кириллицей, компактными подписями и крупными показателями. Для таймера, часов и числовых метрик используется **Geist Mono** с tabular numerals.

Не использовать более трёх начертаний на одном экране: Regular 400, Medium 500, SemiBold 600.

```yaml
typography:
  display-lg:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  display-md:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline-lg:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline-md:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  headline-sm:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title-md:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.005em"
  title-sm:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label-lg:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
  label-md:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
  caption:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.01em"
  metric-lg:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 48px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.05em"
    fontFeature: "\"tnum\" 1"
  metric-md:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 32px
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.04em"
    fontFeature: "\"tnum\" 1"
  timer:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 40px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.045em"
    fontFeature: "\"tnum\" 1"
```

### Иерархия

- Название страницы: `headline-lg` на desktop, `headline-md` на mobile.
- Заголовок карточки: `title-sm`.
- Основное содержимое: `body-md`.
- Подписи и metadata: `body-sm` или `caption`.
- Большие часы/температура: `metric-lg`.
- Таймер: `timer`; на узкой карточке — `metric-md`.
- Кнопки: `label-lg`.

Текст не уменьшается ниже 11 px. Инструкции, ошибки и интерактивные подписи — не ниже 13 px.

## Layout

Композиция следует адаптивной Bento Grid: стабильная колонная сетка, карточки разных размеров и ровные интервалы. Masonry не используется, чтобы порядок чтения и клавиатурная навигация оставались предсказуемыми.

```yaml
spacing:
  none: 0
  2xs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 40px
  5xl: 48px
  6xl: 64px
  grid-gap: 16px
  card-padding-compact: 16px
  card-padding-default: 20px
  card-padding-large: 24px
  page-mobile: 16px
  page-tablet: 24px
  page-desktop: 32px
  sidebar-width: 224px
  sidebar-rail-width: 72px
  topbar-height: 72px
  bottom-nav-height: 64px
  touch-target: 44px
  content-max-width: 1440px
```

### Desktop, от 1200 px

- Фиксированный sidebar шириной 224 px.
- Контент ограничен 1440 px и центрируется в оставшейся области.
- Dashboard использует 12 колонок с gap 16 px.
- Размеры виджетов: compact — 3 колонки, standard — 4, wide — 6, full — 12.
- Рекомендуемая первая строка: время 3, погода 6, таймер 3.
- Вторая строка: календарь 4, рутины 4, новости 4.
- Минимальная полезная ширина карточки — 260 px.
- Top bar и sidebar могут быть sticky, но не перекрывают фокусируемый контент.

### Tablet, 768–1199 px

- Sidebar превращается в rail 72 px либо скрываемое меню.
- Сетка содержит 6 колонок.
- Compact занимает 3 колонки, остальные размеры — 6.
- Редактор виджетов открывается правой панелью шириной до 400 px.

### Mobile, 320–767 px

- Одна колонка.
- Горизонтальный scroll страницы запрещён.
- Page padding — 16 px, gap — 12 px.
- Верхняя панель содержит название экрана и не более двух действий.
- Основная навигация расположена снизу и учитывает safe-area inset.
- Настройки виджетов и сложные формы открываются полноэкранно либо как bottom sheet высотой до 90dvh.
- Таймер может сворачиваться в закреплённую mini-panel над bottom navigation.
- Второстепенные metadata скрываются раньше основных значений.

### Container queries

Карточка реагирует на собственную ширину, а не только на viewport:

- до 280 px — вертикальная компактная композиция;
- 281–479 px — стандартная;
- от 480 px — расширенная, допускающая две внутренние колонки.

Неподдерживаемая среда получает стандартную одноколоночную компоновку карточки.

### Safe areas и viewport

- Использовать `100dvh`, а не фиксированный `100vh`, для mobile overlays.
- Нижняя навигация и bottom sheet учитывают `env(safe-area-inset-bottom)`.
- В модальных интерфейсах не блокировать доступ к экранной клавиатуре.

## Elevation & Depth

Иерархия строится тональными поверхностями:

1. `surface-page` — общий фон.
2. `surface-subtle` — sidebar, top bar и крупные группирующие области.
3. `surface-card` — основные карточки.
4. `surface-muted` — вложенные строки, input backgrounds и skeleton.

Правила:

- Базовая карточка имеет границу 1 px `border-subtle`.
- Тень применяется только к floating surfaces: drawer, popover, menu и dialog.
- Hover карточки — изменение border и лёгкий подъём не более 2 px.
- Акцентная карточка использует цвет, а не тяжёлую тень.
- В dark theme тени почти незаметны; слои отделяются цветом поверхности.

Рекомендуемые тени в SCSS:

```scss
$shadow-card: 0 1px 2px rgb(17 21 18 / 4%);
$shadow-floating: 0 12px 32px rgb(17 21 18 / 14%);
$shadow-dialog: 0 24px 64px rgb(17 21 18 / 20%);
```

## Shapes

Форма интерфейса мягкая, но не игрушечная. Основные карточки имеют радиус 16 px; небольшие элементы — 8–12 px; pill используется только для chips, статусов и компактных CTA.

```yaml
rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  full: 9999px
```

Правила формы:

- Виджеты: `rounded.lg`.
- Крупные weather/auth surfaces: `rounded.xl`.
- Inputs и стандартные кнопки: `rounded.md`.
- Icon buttons: `rounded.full`.
- Chips/status: `rounded.full`.
- Вложенный элемент не должен иметь больший радиус, чем родитель.
- Круг используется для аватара, icon button, progress marker и погодных частиц.

## Components

```yaml
components:
  app-shell:
    backgroundColor: "{colors.surface-page}"
    textColor: "{colors.text-primary}"
    width: "100%"
    height: "100dvh"
  sidebar:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-primary}"
    width: "{spacing.sidebar-width}"
    padding: "{spacing.xl}"
    rounded: "{rounded.xl}"
  topbar:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-primary}"
    height: "{spacing.topbar-height}"
    padding: "{spacing.lg}"
    rounded: "{rounded.lg}"
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding-default}"
  card-compact:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding-compact}"
  card-accent:
    backgroundColor: "{colors.primary-600}"
    textColor: "{colors.text-on-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding-default}"
  button-primary:
    backgroundColor: "{colors.primary-600}"
    textColor: "{colors.text-on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-700}"
    textColor: "{colors.text-on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.neutral-0}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  icon-button:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    size: "{spacing.touch-target}"
  input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  search-input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  chip:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  chip-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.primary-800}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.primary-800}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  checkbox:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xs}"
    size: "20px"
  checkbox-checked:
    backgroundColor: "{colors.primary-600}"
    textColor: "{colors.text-on-primary}"
    rounded: "{rounded.xs}"
    size: "20px"
  switch-track:
    backgroundColor: "{colors.neutral-300}"
    rounded: "{rounded.full}"
    width: "44px"
    height: "24px"
  switch-track-checked:
    backgroundColor: "{colors.primary-600}"
    rounded: "{rounded.full}"
    width: "44px"
    height: "24px"
  drawer:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    width: "400px"
    padding: "{spacing.2xl}"
    rounded: "{rounded.xl}"
  bottom-sheet:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    width: "100%"
    padding: "{spacing.xl}"
    rounded: "{rounded.xl}"
  dialog:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    width: "min(480px, calc(100vw - 32px))"
    padding: "{spacing.2xl}"
    rounded: "{rounded.xl}"
  toast:
    backgroundColor: "{colors.neutral-900}"
    textColor: "{colors.neutral-0}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  skeleton:
    backgroundColor: "{colors.surface-muted}"
    textColor: "transparent"
    rounded: "{rounded.sm}"
  status-success:
    backgroundColor: "{colors.success-surface}"
    textColor: "{colors.success}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
  status-warning:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
  status-error:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.error}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
```

### App shell

Desktop:

- Sidebar находится в отдельной светлой панели с внешним отступом 8–12 px.
- Верхняя панель содержит глобальный поиск/command trigger, уведомления и профиль.
- Контент начинается с заголовка, короткого контекста дня и действий настройки.
- Sidebar не содержит промо-карточки: пространство используется для навигации и статуса интеграций.

Mobile:

- Sidebar отсутствует.
- Нижняя навигация содержит не более четырёх пунктов.
- Профиль и выход находятся в настройках, а не в bottom navigation.

### Widget card

Обязательные области:

1. Header: иконка/название, optional metadata, context menu.
2. Content: главное значение или список.
3. Footer: вторичный статус, последнее обновление или действие.

Правила:

- Header не выше 40 px без необходимости.
- Карточка не должна иметь вложенную «карточку в карточке» без явной смысловой причины.
- Context menu открывается icon button размером 44×44 px.
- Интерактивная карточка получает hover только на устройствах с hover.
- Drag handle показывается только в режиме редактирования.

### Date and time

- Время — главный элемент, `metric-lg`.
- Дата и день недели — `body-md`.
- Timezone — `caption`, если отличается от системного.
- Карточка остаётся нейтральной; не конкурирует с погодой и таймером.
- Часы используют tabular numerals, чтобы ширина не менялась каждую секунду.

### Weather

Погодная карточка — главный эмоциональный элемент dashboard.

- Занимает wide-размер по умолчанию.
- Анимация покрывает всю поверхность карточки.
- Текст располагается в безопасной контрастной зоне.
- Температура — `metric-lg`, описание — `body-md`.
- Почасовой прогноз раскрывается внутри карточки без перехода на новый экран.
- Day/night и weather code определяют сцену, но базовый layout не меняется.
- При загрузке показывается нейтральный skeleton, а не случайная погода.
- При `prefers-reduced-motion` используется статичная сцена.
- Декоративные частицы имеют `pointer-events: none` и скрыты от accessibility tree.

### Calendar

- События организованы вертикальным списком по времени.
- Время занимает фиксированную узкую колонку.
- Цвет календаря показан небольшим marker и никогда не заменяет текст.
- All-day event имеет явную подпись «Весь день».
- Ближайшее событие может использовать `surface-selected`.
- Ссылка на встречу — вторичная компактная кнопка.

### Routines

- Checkbox расположен слева, touch target — минимум 44 px.
- Выполненное дело сохраняет читаемый текст; используется strike-through с достаточным контрастом.
- Прогресс отображается числом и progress bar.
- Даты «вчера / сегодня / завтра» — segmented control или три chips.
- Быстрое добавление всегда визуально отделено от существующих пунктов.
- Destructive action скрыто в context menu и требует подтверждения для серии.

### AI news

- Один материал — заголовок, источник, время, topic chip и optional thumbnail.
- Заголовок ограничивается тремя строками в карточке.
- Источник заметнее excerpt.
- Внешняя ссылка обозначается соответствующей иконкой.
- Изображения не обязательны: отсутствие изображения не создаёт пустой placeholder.
- Первый материал может быть визуально крупнее, но не выглядит рекламой.

### Timer

- Оставшееся время — центр композиции.
- Work и break явно подписаны текстом.
- Primary control — play/pause.
- Stop/reset — secondary или destructive в зависимости от контекста.
- Состояние не обозначается только зелёным/красным.
- Активный таймер может использовать тёмную evergreen-карточку с белым текстом.
- В mobile mini-panel показывает фазу, время и одну кнопку.

### Widget editor

Desktop drawer:

- ширина 400 px;
- sticky header с заголовком и close;
- список элементов с drag handle, названием, описанием и switch;
- auto-save status внизу;
- preview остаётся видимым за drawer.

Mobile:

- full-screen либо bottom sheet до `90dvh`;
- reorder доступен кнопками «Выше/ниже», даже если drag-and-drop неудобен;
- close и save status остаются видимыми;
- sheet закрывается жестом только если нет несохранённого конфликта.

### Forms

- Label всегда видим и находится над input.
- Placeholder не заменяет label.
- Helper/error text находится под полем.
- Ошибка связывается с input через accessibility attributes.
- Поля даты и времени используют локализованные native controls там, где это удобно.
- Primary submit расположен справа на desktop и занимает всю ширину на mobile.

### Buttons

- На экране не более одного визуально доминирующего primary action в одной смысловой области.
- Минимальная высота — 44 px.
- Icon-only button требует accessible name и tooltip.
- Loading сохраняет ширину кнопки.
- Disabled заметно отличается, но текст остаётся читаемым.
- Destructive button не использует primary green.

### Navigation

- Активный пункт имеет одновременно цвет, фон и marker/иконку.
- Иконка — 20 px, label — `label-lg`.
- Sidebar sections допустимы только при наличии минимум двух смысловых групп.
- Нижняя навигация использует иконку 22–24 px и короткую подпись.
- Notification badge не перекрывает иконку.

### Dialog, drawer и bottom sheet

- Нативный `<dialog>` предпочтителен для modal dialog.
- Фокус перемещается внутрь при открытии и возвращается к trigger при закрытии.
- `Escape` закрывает non-destructive overlay.
- Клик по backdrop не закрывает форму с введёнными несохранёнными данными без подтверждения.
- Background становится inert на время modal interaction.
- Drawer используется для быстрых настроек; отдельная страница остаётся доступна по URL.

### Loading, empty and error states

Loading:

- skeleton повторяет финальную геометрию;
- shimmer медленный и отключается при reduced motion;
- карточки загружаются независимо.

Empty:

- короткое объяснение;
- одно основное действие;
- небольшая тематическая иконка;
- без больших декоративных иллюстраций в рабочих карточках.

Error:

- локальная ошибка остаётся внутри виджета;
- содержит понятное сообщение и «Повторить»;
- stale data остаются видимыми с меткой «Данные могут быть устаревшими»;
- permission error предлагает открыть соответствующую настройку.

### Authentication

- Desktop: split layout, форма занимает 40–45%, спокойная продуктовая иллюстрация — оставшееся пространство.
- Mobile: только форма и компактный brand mark.
- Google OAuth — единственная primary button.
- Telegram recovery — secondary action.
- Юридические ссылки расположены внизу.
- Иллюстрация повторяет evergreen-палитру и мотив модульных карточек, но не показывает ложные реальные данные.

### Icons

- Один outline-набор иконок.
- Базовый размер — 20 px; navigation — 22 px; крупные empty states — максимум 40 px.
- Толщина stroke — 1.75–2 px.
- Filled icon используется только для выбранного состояния либо бренда.
- Не смешивать иконки разных семейств.
- Иконка без текста должна иметь tooltip и accessible name.

### Data visualization

- Графики вторичны относительно ежедневных действий.
- Основная серия — Evergreen.
- Не более четырёх серий на одном графике.
- Pattern/label дополняет цвет для accessibility.
- Оси и legend скрываются только если значение остаётся однозначным.
- Progress ring не используется без числового значения в центре или рядом.
- Для небольших сравнений предпочтительны bars, а не pie chart.

### Motion

Движение подтверждает изменение состояния и помогает понять пространственную связь.

- Hover/press: 120–160 ms.
- Toggle, checkbox, chip: 160–200 ms.
- Drawer/bottom sheet: 220–280 ms.
- Перестановка виджетов: 200–260 ms.
- Easing для входа: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Easing для выхода: `cubic-bezier(0.4, 0, 1, 1)`.
- Не анимировать layout-свойства, если можно использовать transform/opacity.
- Бесконечная анимация допустима только для погоды и активного loading indicator.

При `prefers-reduced-motion: reduce`:

- transitions сокращаются почти до нуля;
- parallax, частицы и shimmer отключаются;
- смысловое изменение остаётся видимым мгновенно;
- таймер продолжает обновлять текст без декоративной пульсации.

## Do's and Don'ts

### Do

- Использовать `surface-page` как спокойный фон и `surface-card` для контента.
- Оставлять достаточно воздуха вокруг больших чисел.
- Выделять Evergreen только основное действие или активное состояние.
- Использовать одну систему радиусов и интервалов.
- Проверять длинные русские заголовки и системное увеличение текста до 200%.
- Сохранять минимальный touch target 44×44 px.
- Показывать source, freshness и sync state у внешних данных.
- Использовать container queries для внутренней адаптации виджетов.
- Предусматривать keyboard alternative для drag-and-drop.
- Делать dark theme полноценной темой, а не фильтром-инверсией.
- Использовать `:focus-visible` для отчётливого focus ring.
- Учитывать `prefers-reduced-motion`, safe areas и динамический viewport.

### Don't

- Не копировать логотип, иллюстрации, аватары или тексты из референса.
- Не превращать каждый виджет в зелёную карточку.
- Не использовать больше одного яркого accent color без семантической причины.
- Не применять glassmorphism как базовый стиль.
- Не использовать тяжёлые тени на каждой карточке.
- Не скрывать обязательный label внутри placeholder.
- Не передавать статус только цветом.
- Не делать весь виджет кликабельным, если внутри есть другие действия.
- Не добавлять autoplay-анимацию, не связанную с погодой или загрузкой.
- Не уменьшать текст ради размещения большего количества данных.
- Не использовать horizontal scroll для основной mobile-страницы.
- Не блокировать dashboard глобальным loader из-за одного внешнего API.

### Контрольный список перед выпуском

- Светлая и тёмная темы проверены на контраст.
- Dashboard проверен на ширинах 320, 375, 768, 1024, 1280 и 1440 px.
- Виджеты проверены в compact, standard и wide размерах.
- Все интерактивные элементы доступны с клавиатуры.
- Screen reader получает названия icon buttons и обновления статусов.
- Reduced motion отключает декоративное движение.
- Skeleton не вызывает layout shift.
- Ошибки и empty states не меняют размеры сетки непредсказуемо.
- Погодный фон не снижает читаемость.
- Primary action остаётся очевидным на каждом экране.

