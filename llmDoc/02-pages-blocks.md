# Prisme.ai Pages & Blocks Reference

UI components for building user interfaces.

---

## Pages

URL: `https://[workspace-slug].pages.prisme.ai/[language]/[page-slug]`

```yaml
slug: customer-dashboard
name: Customer Dashboard
accessControl: public|private
language: en
seoSettings:
  title: Dashboard
  description: View info
```

**Access:** Public, Private, Role-Based, Email-Based, SSO

**Special pages:** `_doc`, `index`, `401`, `404`

**Events:** onPageLoad (load, mount, unmount), User interaction, State change, System, Custom

---

## Blocks

### Common Properties

```yaml
slug: MyBlock
onInit: myInitEvent
updateOn: myUpdateEvent
automation: myAutomation
sectionId: myBlock
className: block-classname
css: |
  :block {
    display: flex;
  }
if: '{{myCondition}}'
repeat: '{{myArray}}'
item: myItem
```

---

## Form

```yaml
- slug: Form
  title:
    en: Contact
  schema:
    type: object
    required:
      - email
    properties:
      email:
        type: string
        format: email
        validators:
          email: true
      password:
        type: string
        ui:widget: password
        validators:
          minLength:
            value: 8
            message: "Min 8 chars"
  onSubmit: submitForm
  onChange: formChanged
  submitLabel: Send
  hideSubmit: false
  disabledSubmit: false
  disableSubmitDelay: 2000
  values:
    name: "{{user.name}}"
  buttons:
    - text: Cancel
      type: event
      value: cancelForm
  autoFocus: true
```

**Validators:** `required, min, max, email, tel, date, minLength, maxLength, pattern`
**Widgets:** `textarea, date, color, password`

---

## RichText

```yaml
- slug: RichText
  content:
    en: <p>Hello</p>
  markdown: true
  allowUnsecure: true
```

---

## Action

```yaml
- slug: Action
  text:
    en: Submit
  type: event|external|internal|inside|upload|script
  value: submitEvent
  payload:
    formId: contactForm
  popup: true
  accept: ".pdf,.doc"
  disabled: "{{!formValid}}"
  confirm:
    label: "Sure?"
    yesLabel: "Yes"
```

---

## DataTable

```yaml
- slug: DataTable
  title:
    en: Employees
  data: "{{employees}}"
  columns:
    - title: Name
      dataIndex: name
      sorter: true
    - title: Dept
      dataIndex: department
      filters:
        - text: Marketing
          value: marketing
  pagination:
    event: changePage
    page: "{{currentPage}}"
    itemCount: "{{total}}"
    pageSize: 10
  onSort: sortEmployees
  initialSort:
    by: name
    order: ascend
  bulkActions:
    - text: Delete
      event: deleteSelected
  contextMenu:
    - text: Edit
      event: editRow
  updateRowOn: "update row $id"
  sticky: true
```

---

## Image

```yaml
- slug: Image
  src: https://example.com/image.jpg
  alt: Image
```

---

## Carousel

```yaml
- slug: Carousel
  blocks:
    - slug: Image
      src: https://example.com/1.jpg
  autoscroll:
    active: true
    speed: 5000
  displayIndicators: true
```

---

## TabsView

```yaml
- slug: TabsView
  direction: horizontal|vertical
  selected: 0
  tabs:
    - text: Tab 1
      content:
        blocks:
          - slug: RichText
            content: "Content"
```

---

## Signin

```yaml
- slug: Signin
  label:
    en: Sign in
  up: false
  redirect: /dashboard
```

---

## Toast

```yaml
- slug: Toast
  toastOn: showNotification
  # Payload: {type: "success|error|warning|loading", content: {...}, duration: 5}
```

---

## Hero

```yaml
- slug: Hero
  title:
    en: Welcome
  lead:
    en: Subtitle
  img: https://example.com/hero.jpg
  backgroundColor: "#f5f5f5"
  level: 1
  content:
    blocks:
      - slug: Action
        text: Get Started
        type: internal
        value: /start
```

---

## Charts

```yaml
- slug: Charts
  type: line|column|pie
  data:
    - ["Month", "Sales"]
    - ["Jan", 1000]
  config:
    x:
      type: category
    y:
      type: value
  customProps:
    height: 400
    smooth: true
```

---

## Dialog Box (Chat)

```yaml
- slug: Dialog Box.Dialog Box
  setup:
    input:
      enabled: true
      placeholder:
        en: Message
      event: sendInput
      disableSubmit: '{{disableSubmit}}'
      upload:
        expiresAfter: "{{uploadDuration}}"
        public: false
      attachments: '{{attachments}}'
      payload:
        id: '{{conversationId}}'
      tools:
        list: '{{tools}}'
      datasources:
        list: '{{datasources}}'
  history: "{{messages}}"
  display:
    startAtTop: false
    sentMessages:
      background: '#015DFF'
      text: '#fff'
    receivedMessages:
      background: '#F1F2F7'
      text: '#333'
      sanitize: false
```

---

## Popover

```yaml
- slug: Popover.Popover
  url: /form
  config:
    header:
      title: Help
      bgColor: '#4a6cf7'
    button:
      bgColor: '#4a6cf7'
      position:
        right: 20px
        bottom: 20px
    tooltip:
      text: 'Need help?'
      openDelay: 500
```

---

## BlocksList

Container for rendering a list of child blocks.

```yaml
- slug: BlocksList
  blocks:
    - slug: RichText
      content: "First block"
    - slug: Action
      text: "Click me"
      type: event
      value: myEvent
  tag: div
  blocksClassName: my-blocks
```

| Property | Type | Description |
|----------|------|-------------|
| `blocks` | `Block[]` | Array of block configurations with `slug` and props |
| `tag` | `string` | HTML tag wrapper: `div`, `section`, `fragment`, etc. |
| `blocksClassName` | `string` | CSS class for block wrapper |

---

## Button

Advanced button component with multiple action types.

```yaml
- slug: Button
  content: "Click Me"
  type: event
  value:
    event: myButtonEvent
    payload:
      key: value
  icon:
    name: arrow
    placement: left
  theme: default
  disabled: false
  loading: false
  confirm:
    title: "Are you sure?"
    label: "Confirm action"
    yesLabel: "Yes"
    noLabel: "Cancel"
    mode: modal
```

| Property | Type | Description |
|----------|------|-------------|
| `content` | `BlockContent` | Button label (text or nested blocks) |
| `type` | `'event' \| 'internal' \| 'external' \| 'script' \| 'upload' \| 'menu'` | Action type |
| `value` | `EventSpec \| string \| object` | Action value based on type |
| `icon` | `string \| {name, placement}` | Icon configuration |
| `theme` | `string` | Visual theme: `default`, `info`, `success`, `error`, `warning`, `transparent` |
| `disabled` | `boolean` | Disable the button |
| `loading` | `boolean` | Show loading state |
| `confirm` | `object` | Confirmation dialog config |

---

## Icon

Display built-in or custom icons.

```yaml
- slug: Icon
  icon: arrow
  rotate: 90
  width: 24
  height: 24
```

**Built-in icons:** `prisme.ai`, `arrow`, `attachment`, `atom`, `back`, `brain`, `books`, `bubble`, `calendar`, `charts`, `chevron`, `checkmark`, `copy`, `cross`, `cube`, `download`, `expand`, `eye`, `export`, `file`, `filter`, `folder`, `gear`, `help`, `home`, `import`, `link`, `magnifier`, `navigate`, `news`, `pause`, `pencil`, `people`, `play`, `plus`, `privacy`, `puzzle`, `reload`, `robot`, `search`, `send`, `share`, `sliders`, `star`, `store`, `test-tube`, `three-dots`, `thumb`, `tool`, `tools`, `trash`, `warning`

| Property | Type | Description |
|----------|------|-------------|
| `icon` | `string \| ReactNode` | Icon name or custom element |
| `rotate` | `number` | Rotation angle in degrees |
| `width` | `string \| number` | Icon width |
| `height` | `string \| number` | Icon height |
| `withMask` | `boolean` | Apply mask styling |

---

## ProductHome

Product landing page with search, tags, and item list.

```yaml
- slug: ProductHome
  title:
    en: "My Products"
  heading:
    icon: store
    title:
      en: "Welcome to the Store"
    description:
      en: "Browse our products"
  search:
    active: true
    placeholder:
      en: "Search products..."
    onSubmit: searchProducts
    onChange: searchChanged
  tags:
    - text:
        en: "Category 1"
      type: event
      value: filterCategory1
      selected: true
  list:
    items:
      - icon: cube
        title: "Product 1"
        description: "Description"
        onClick:
          type: internal
          value: /product/1
    hasMore:
      event: loadMoreProducts
      enabled: true
    create:
      title:
        en: "Create New"
      submitButton:
        label:
          en: "Create"
        event: createProduct
```

| Property | Type | Description |
|----------|------|-------------|
| `title` | `LocalizedText` | Page title |
| `heading` | `BlockContent \| object` | Header with icon, title, description |
| `search` | `object` | Search configuration |
| `tags` | `ActionConfig[]` | Filter tags |
| `list` | `object` | Items list with pagination and create form |
| `additionalButtons` | `ActionConfig[]` | Extra action buttons |

---

## ProductLayout

Full product page layout with sidebar and content area.

```yaml
- slug: ProductLayout
  sidebar:
    header:
      back:
        label: "Back"
        href: "/home"
      buttons:
        - icon: gear
          type: event
          value: openSettings
    items:
      - icon: home
        text: "Dashboard"
        type: internal
        value: /dashboard
        selected: true
    bottomItems:
      - icon: help
        text: "Help"
        type: external
        value: https://docs.example.com
    opened: true
    autoClose: true
  content:
    title: "Page Title"
    description: "Page description"
    tabs:
      - title: "Tab 1"
        content:
          blocks:
            - slug: RichText
              content: "Tab content"
        selected: true
  assistant:
    url: /chat
    visible: true
  toastOn: showToast
```

| Property | Type | Description |
|----------|------|-------------|
| `sidebar` | `object` | Sidebar configuration with header, items, bottomItems |
| `content` | `object` | Main content area with title, tabs, description |
| `assistant` | `object` | Assistant chat panel config |
| `toastOn` | `string` | Event to trigger toast notifications |
| `sidebarExpanded` | `boolean` | Sidebar expansion state |

---

## DropDown

Dropdown menu with customizable trigger and items.

```yaml
- slug: DropDown
  trigger:
    icon: three-dots
    text: "Options"
  items:
    - text: "Edit"
      type: event
      value: editItem
      icon: pencil
    - text: "Delete"
      type: event
      value: deleteItem
      icon: trash
  placement: bottomRight
  closeOn: closeDropdown
```

| Property | Type | Description |
|----------|------|-------------|
| `trigger` | `BlockContent \| {icon, text}` | Trigger element |
| `items` | `(ActionConfig \| BlockContent)[]` | Menu items |
| `placement` | `string` | Dropdown position (Ant Design placement) |
| `closeOn` | `string` | Event to close dropdown |

---

## Modal

Modal dialog overlay.

```yaml
- slug: Modal
  trigger: "Open Modal"
  title: "Modal Title"
  content:
    blocks:
      - slug: Form
        schema:
          type: object
          properties:
            name:
              type: string
        onSubmit: submitForm
  visible: false
  onClose: closeModal
  closeOn: formSubmitted
```

| Property | Type | Description |
|----------|------|-------------|
| `trigger` | `BlockContent` | Element that opens the modal |
| `title` | `BlockContent` | Modal header title |
| `content` | `BlockContent` | Modal body content |
| `visible` | `boolean` | Control visibility programmatically |
| `onClose` | `EventSpec` | Event when modal closes |
| `closeOn` | `string` | Event name to close modal |

---

## StackedNavigation

Stacked/nested navigation with breadcrumb-style history.

```yaml
- slug: StackedNavigation
  head:
    - slug: Action
      text: "Back"
      type: event
      value: goBack
  content:
    title: "Current Page"
    blocks:
      - slug: RichText
        content: "Page content"
```

| Property | Type | Description |
|----------|------|-------------|
| `head` | `Block[]` | Header blocks (usually navigation) |
| `content` | `{title, blocks}` | Current content with title and blocks |

---

## Breadcrumbs

Navigation breadcrumb trail.

```yaml
- slug: Breadcrumbs
  links:
    - text: "Home"
      type: internal
      value: /
    - text: "Products"
      type: internal
      value: /products
    - text: "Current Page"
      type: internal
      value: /products/123
```

| Property | Type | Description |
|----------|------|-------------|
| `links` | `ActionConfig[]` | Array of navigation links |

---

## Footer

Page footer component.

```yaml
- slug: Footer
  content:
    blocks:
      - slug: RichText
        content: "© 2024 Company Name"
```

| Property | Type | Description |
|----------|------|-------------|
| `content` | `BlocksListConfig` | Footer content blocks |

---

## Head

HTML head metadata injection.

```yaml
- slug: Head
  content: |
    <meta name="robots" content="noindex">
    <link rel="stylesheet" href="https://example.com/style.css">
```

| Property | Type | Description |
|----------|------|-------------|
| `content` | `string` | Raw HTML to inject into document head |

---

## Header

Page header with logo, title, and navigation.

```yaml
- slug: Header
  title:
    en: "My Website"
  level: 1
  logo:
    src: https://example.com/logo.png
    alt: "Company Logo"
    action:
      type: internal
      value: /
  nav:
    - text: "Home"
      type: internal
      value: /
    - text: "About"
      type: internal
      value: /about
  fixed: true
```

| Property | Type | Description |
|----------|------|-------------|
| `title` | `LocalizedText` | Header title |
| `level` | `1-6` | Heading level (h1-h6) |
| `logo` | `{src, alt, action?}` | Logo configuration |
| `nav` | `(ActionConfig \| BlocksListConfig)[]` | Navigation items |
| `fixed` | `boolean` | Fixed position header |

---

## Tooltip

Tooltip on hover/click.

```yaml
- slug: Tooltip
  content: "Hover over me"
  label: "This is the tooltip text"
  placement: top
  trigger: hover
  onShow: tooltipShown
  onHide: tooltipHidden
```

| Property | Type | Description |
|----------|------|-------------|
| `content` | `BlockContent` | Element that triggers tooltip |
| `label` | `BlockContent` | Tooltip content |
| `placement` | `string` | Tooltip position |
| `trigger` | `'hover' \| 'click' \| 'focus'` | Trigger method |
| `onShow` | `EventSpec` | Event when tooltip shows |
| `onHide` | `EventSpec` | Event when tooltip hides |

---

## Cards

Card grid/carousel with multiple variants.

```yaml
- slug: Cards
  title:
    en: "Featured Items"
  variant: classic
  layout:
    type: carousel
    autoScroll: true
  cards:
    - title:
        en: "Card 1"
      description:
        en: "Description"
      cover: https://example.com/image.jpg
      content:
        - type: button
          value: "Learn More"
          url: /item/1
```

**Variants:** `classic`, `short`, `article`, `square`, `actions`, `blocks`

| Property | Type | Description |
|----------|------|-------------|
| `title` | `LocalizedText` | Section title |
| `cards` | `Card[]` | Array of cards (type depends on variant) |
| `variant` | `string` | Card style variant |
| `layout` | `{type, autoScroll?}` | Layout: `grid`, `column`, `carousel` |

---

## Loading

Loading spinner component.

```yaml
- slug: Loading
  className: my-loading-spinner
  spinClassName: custom-spin
```

| Property | Type | Description |
|----------|------|-------------|
| `className` | `string` | CSS class |
| `spinClassName` | `string` | Spinner-specific class |
| `icon` | `Component` | Custom loading icon |

---

## DateRangePicker

Date range selection with presets.

```yaml
- slug: DateRangePicker
  onChange: dateRangeChanged
  ranges: default
  showTime: false
  from: "2024-01-01"
  to: "2024-12-31"
  selectedRange: 0
```

| Property | Type | Description |
|----------|------|-------------|
| `onChange` | `EventSpec` | Change event (payload: {from, to}) |
| `ranges` | `'default' \| Range[]` | Preset range options |
| `showTime` | `boolean` | Include time selection |
| `from` | `string` | Initial start date |
| `to` | `string` | Initial end date |
| `selectedRange` | `number` | Index of selected preset |

---

## KPI

Key Performance Indicator display.

```yaml
- slug: KPI
  value: 1234
  unit:
    en: "users"
  label:
    en: "Total Users"
  description:
    en: "All registered users"
  format:
    type: number
    options:
      style: decimal
      maximumFractionDigits: 0
  loading: false
  relatedValues:
    - value: 50
      unit:
        en: "%"
      label:
        en: "Growth"
      icon: arrow
```

| Property | Type | Description |
|----------|------|-------------|
| `value` | `string \| number` | Main KPI value |
| `unit` | `LocalizedText` | Unit label |
| `label` | `LocalizedText` | KPI name |
| `description` | `LocalizedText` | Tooltip description |
| `format` | `{type, options}` | Number formatting (Intl.NumberFormat) |
| `loading` | `boolean` | Show loading state |
| `relatedValues` | `KPIValue[]` | Secondary metrics |

---

## Notifications

Browser notification trigger.

```yaml
- slug: Notifications
  notifyOn: showNotification
  # Event payload: {message: "Title", options: {body: "Content"}}
```

| Property | Type | Description |
|----------|------|-------------|
| `notifyOn` | `string` | Event to trigger browser notification |

---

## Collapse

Accordion/collapsible sections.

```yaml
- slug: Collapse
  sections:
    - label: "Section 1"
      content:
        blocks:
          - slug: RichText
            content: "Section 1 content"
    - label: "Section 2"
      content: "Simple text content"
```

| Property | Type | Description |
|----------|------|-------------|
| `sections` | `{label, content}[]` | Collapsible sections |

---

## ProductCard

Product/item card display.

```yaml
- slug: ProductCard
  icon: cube
  title: "Product Name"
  description: "Product description"
  updatedAt: "2024-01-15T10:00:00Z"
  docLink: https://docs.example.com/product
  author: "John Doe"
  active: true
  counters:
    - icon: eye
      count: 150
      label: "Views"
  labels:
    - text: "New"
      type: event
      value: filterNew
  onClick:
    type: internal
    value: /product/123
```

| Property | Type | Description |
|----------|------|-------------|
| `icon` | `'active' \| 'inactive' \| string \| BlockContent` | Card icon/status |
| `title` | `BlockContent` | Product title |
| `description` | `BlockContent` | Product description |
| `updatedAt` | `Date \| string` | Last update timestamp |
| `docLink` | `string` | Documentation link |
| `author` | `string` | Author name |
| `active` | `boolean` | Active state styling |
| `counters` | `{icon, count, label}[]` | Metric counters |
| `labels` | `ActionConfig[]` | Tag labels |
| `onClick` | `Function \| ActionConfig` | Click action |

---

## SearchInput

Search input field with debouncing.

```yaml
- slug: SearchInput
  placeholder:
    en: "Search..."
  onChange: searchChanged
  onSubmit: searchSubmit
  fieldName: query
```

| Property | Type | Description |
|----------|------|-------------|
| `placeholder` | `LocalizedText` | Input placeholder |
| `onChange` | `EventSpec` | Debounced change event (500ms) |
| `onSubmit` | `EventSpec` | Form submit event |
| `fieldName` | `string` | Field name in payload (default: "value") |

---

## Filters

Advanced filter controls with presets.

```yaml
- slug: Filters
  onSubmit: applyFilters
  submitLabel:
    en: "Apply"
  submitIcon: filter
  presets:
    - name: "Active Only"
      values:
        status: active
      icon: checkmark
  fields:
    - status
    - type
    - category
  showFields: true
```

| Property | Type | Description |
|----------|------|-------------|
| `onSubmit` | `EventSpec` | Submit event with filter values |
| `submitLabel` | `LocalizedText` | Submit button label |
| `submitIcon` | `string` | Submit button icon |
| `presets` | `{name, values, icon}[]` | Preset filter configurations |
| `fields` | `string[]` | Field name suggestions |
| `showFields` | `boolean` | Display field selector |

---

## TimeList

Time-sectioned list with pagination.

```yaml
- slug: TimeList
  items: "{{conversations}}"
  dateField: createdAt
  templateBlock: ConversationCard
  sections:
    - label:
        en: "Today"
      timerange: [0, day]
    - label:
        en: "Last 7 days"
      timerange: [7, day]
    - label:
        en: "Older"
  selected:
    id: "{{selectedId}}"
  updateItemOn: updateConversation
  onPagination: loadMoreConversations
  loadMoreLabel:
    en: "Load more"
  resetOn: resetList
  nextPage: "{{nextPage}}"
```

| Property | Type | Description |
|----------|------|-------------|
| `items` | `object[]` | Array of items to display |
| `dateField` | `string` | Field name for date grouping (default: "createdAt") |
| `templateBlock` | `string` | Block slug to render each item |
| `sections` | `{label, timerange}[]` | Time section definitions |
| `selected` | `object` | Selection criteria |
| `updateItemOn` | `string` | Event to update items |
| `onPagination` | `EventSpec` | Pagination event |
| `loadMoreLabel` | `LocalizedText` | Load more button label |
| `resetOn` | `string` | Event to reset list |
| `nextPage` | `number` | Next page number |
