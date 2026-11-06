import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { Block } from '@/lib/blockers'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

/* Small building blocks shared by the views, in the appearance of the platform's
 * deployment-blueprint pages, coloured only through the theme variables (primary,
 * card, muted, border…). One card level: nothing is boxed inside a card. Icons are
 * inline SVG (components/icons.tsx), spinners are CSS. */

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted'

const toneClass: Record<Tone, string> = {
  ok: 'text-emerald-700 border-emerald-600/30 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40',
  warn: 'text-amber-700 border-amber-600/30 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40',
  bad: 'text-red-700 border-red-600/30 bg-red-50 dark:text-red-300 dark:bg-red-950/40',
  info: 'text-blue-700 border-blue-600/30 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40',
  muted: 'text-muted-foreground border-border bg-muted',
}

const toneText: Record<Tone, string> = {
  ok: 'text-emerald-700 dark:text-emerald-400',
  warn: 'text-amber-700 dark:text-amber-400',
  bad: 'text-red-700 dark:text-red-400',
  info: 'text-blue-700 dark:text-blue-400',
  muted: 'text-muted-foreground',
}

const toneBorder: Record<Tone, string> = {
  ok: 'border-l-emerald-500',
  warn: 'border-l-amber-500',
  bad: 'border-l-red-500',
  info: 'border-l-blue-500',
  muted: 'border-l-border',
}

export function Pill({ tone = 'muted', children, testId }: { tone?: Tone; children: ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', toneClass[tone])}>
      {children}
    </span>
  )
}

/** Status as a coloured dot + text: lighter than a pill, for tables and lists. */
export function Dot({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 text-sm', toneText[tone])}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-current" />
      {children}
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]', className)}
    />
  )
}

/** Title of a view: eyebrow (its group, in the theme primary), heading, one lead line. */
export function PageHeader({ title, sub, actions, eyebrow }: { title: string; sub?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 max-w-3xl flex-col">
        {eyebrow && <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</span>}
        <h2 className="text-2xl font-bold tracking-tight md:text-[28px] md:leading-9">{title}</h2>
        {sub && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A card: optional header row (title, subtitle, actions) above a padded body. */
export function Panel({ title, sub, actions, children, className, testId, footer, flush }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; testId?: string; footer?: ReactNode; flush?: boolean }) {
  return (
    <section data-testid={testId} className={cn('min-w-0 rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 flex-col">
            {title && <h3 className="flex items-center gap-2 text-sm font-semibold">{title}</h3>}
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
      {footer && <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">{footer}</div>}
    </section>
  )
}

const tileTone: Record<Tone, string> = {
  ok: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  bad: 'bg-red-500/10 text-red-600 dark:text-red-400',
  info: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
}

/** Icon in a tinted rounded tile (stat cards, list items). */
export function Tile({ icon, tone = 'info' }: { icon: ReactNode; tone?: Tone }) {
  return <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tileTone[tone])}>{icon}</span>
}

/** Key figures as a row of small cards. */
export function StatStrip({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 }) {
  const grid = { 2: 'grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-2 md:grid-cols-4', 5: 'grid-cols-2 md:grid-cols-5' }[cols]
  return <div className={cn('grid gap-3', grid)}>{children}</div>
}

export function Stat({ label, value, hint, tone, testId, mono = true, icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; testId?: string; mono?: boolean; icon?: ReactNode }) {
  return (
    <div data-testid={testId} className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      {icon && <Tile icon={icon} tone={tone || 'info'} />}
      <div className="flex min-w-0 flex-col">
        <span className={cn('text-2xl font-bold leading-8', mono && 'tabular-nums', tone && tone !== 'muted' && !icon && toneText[tone])}>{value}</span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  )
}

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'dangerGhost'
const btnClass: Record<BtnVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent',
  outline: 'border border-input bg-background hover:bg-muted',
  ghost: 'border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'bg-red-600 text-white hover:bg-red-700 border border-transparent',
  dangerGhost: 'border border-transparent text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40',
}

export function Btn({
  children,
  onClick,
  variant = 'outline',
  disabled,
  blocked,
  busy,
  testId,
  title,
  type = 'button',
  small,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  /** Prefer `blocked`: a disabled button must always say why. */
  disabled?: boolean
  /** Why the action cannot run (shown next to the button) and how to unblock it (shown on click). */
  blocked?: Block
  busy?: boolean
  testId?: string
  title?: string
  type?: 'button' | 'submit'
  small?: boolean
}) {
  const [open, setOpen] = useState(false)
  const cls = cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
    small ? 'h-8 px-2.5 text-sm' : 'h-9 px-3.5 text-sm',
    btnClass[variant]
  )
  if (blocked && !busy) {
    return (
      <span className="inline-flex max-w-full flex-col items-start gap-1">
        <span className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid={testId}
            data-blocked="true"
            aria-disabled="true"
            aria-expanded={blocked.fix ? open : undefined}
            onClick={() => setOpen((o) => !o)}
            className={cn(cls, 'cursor-help opacity-50')}
          >
            {children}
          </button>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid={testId ? `${testId}-reason` : undefined}>
            <span aria-hidden className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] leading-none">i</span>
            {blocked.reason}
          </span>
        </span>
        {open && blocked.fix && (
          <span className="max-w-md border-l-2 border-l-amber-500 pl-2 text-xs leading-relaxed" role="note" data-testid={testId ? `${testId}-fix` : undefined}>
            {blocked.fix}
          </span>
        )}
      </span>
    )
  }
  return (
    <button type={type} data-testid={testId} aria-label={title} onClick={onClick} disabled={disabled || busy} className={cls}>
      {busy && <Spinner />}
      {children}
    </button>
  )
}

/** Message with a coloured left rule (no filled box). */
export function Banner({ tone = 'info', children, testId, onClick }: { tone?: Tone; children: ReactNode; testId?: string; onClick?: () => void }) {
  const cls = cn('w-full border-l-2 py-1.5 pl-3 text-left text-sm', toneBorder[tone], tone === 'muted' ? 'text-muted-foreground' : 'text-foreground')
  if (onClick)
    return (
      <button type="button" data-testid={testId} onClick={onClick} className={cn(cls, 'rounded-r-md hover:bg-muted')}>
        {children}
      </button>
    )
  return (
    <div data-testid={testId} role={tone === 'bad' ? 'alert' : 'status'} className={cls}>
      {children}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>
}

/** Label / value rows separated by hairlines. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-border">{children}</div>
}

export function Row({ left, right, testId }: { left: ReactNode; right?: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2 text-sm">
      <span className="min-w-0">{left}</span>
      {right !== undefined && <span className="min-w-0 text-right text-muted-foreground">{right}</span>}
    </div>
  )
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
}

/** Explanations stay one click away instead of always on screen. */
export function Help({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <details className="group text-sm text-muted-foreground">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 hover:text-foreground">
        <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-xs leading-none">?</span>
        {label || tr('Comment ça marche', 'How it works')}
      </summary>
      <div className="mt-2 max-w-prose">{children}</div>
    </details>
  )
}

/** Plain modal (no Radix dialog needed): confirmation of an action with its consequence. */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
  busy,
  testId,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  testId?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="text-sm">{children}</div>
        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onCancel} testId={testId ? `${testId}-cancel` : undefined}>
            {tr('Annuler', 'Cancel')}
          </Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm} busy={busy} testId={testId ? `${testId}-confirm` : undefined}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export const textareaClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Segmented control (exclusive choice), e.g. diff filters. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; testId?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          data-testid={o.testId}
          onClick={() => onChange(o.value)}
          className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-all', value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Table({ head, children, testId }: { head: ReactNode[]; children: ReactNode; testId?: string }) {
  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={i} className="px-2 py-2 font-medium first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('border-b border-border px-2 py-2.5 align-top first:pl-0', className)}>{children}</td>
}
