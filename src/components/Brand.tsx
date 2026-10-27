import { cn } from '../lib/utils';

export function Brand({ compact = false, heading = false, className }: { compact?: boolean; heading?: boolean; className?: string }) {
  const Tag = heading ? 'h1' : 'div';
  return <Tag className={cn('m-0 inline-flex min-w-0 items-center gap-2.5 font-sans font-semibold leading-5 tracking-tight text-foreground', compact ? 'text-[15px] max-[360px]:text-sm' : 'text-base', className)}><svg aria-hidden="true" className={compact ? 'size-7 shrink-0' : 'size-9 shrink-0'} viewBox="0 0 40 40" width="40" height="40">
    <rect x="1" y="1" width="38" height="38" rx="13" fill="var(--color-primary)" />
    <path d="M10 15c4 0 4 10 8 10s4-10 8-10M10 21c4 0 4 10 8 10s4-10 8-10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M29 10h2v16" fill="none" stroke="var(--color-mint)" strokeWidth="3" strokeLinecap="round" />
  </svg><span>Meeting <span className="font-normal text-muted-foreground">Memory</span></span></Tag>;
}
