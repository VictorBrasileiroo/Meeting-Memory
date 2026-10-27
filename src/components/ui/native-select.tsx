// shadcn/ui Native Select pattern: retain the browser's keyboard and form semantics.
import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return <div data-slot="native-select-wrapper" className="relative w-full">
    <select data-slot="native-select" className={cn('min-h-11 w-full appearance-none rounded-lg border border-solid border-input bg-surface py-2 pr-10 pl-3 font-sans text-base leading-6 text-foreground outline-offset-3 transition-colors hover:border-foreground focus-visible:outline-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive motion-reduce:transition-none', className)} {...props}>{children}</select>
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
  </div>;
}
