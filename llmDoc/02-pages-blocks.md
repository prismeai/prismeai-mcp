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
