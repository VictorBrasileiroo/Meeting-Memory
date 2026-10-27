import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" type={type} className={cn('flex min-h-11 w-full min-w-0 rounded-lg border border-solid border-input bg-surface px-3 py-2 font-sans text-base leading-6 text-foreground shadow-none outline-offset-3 transition-colors placeholder:text-muted-foreground hover:border-foreground focus-visible:outline-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive motion-reduce:transition-none', className)} {...props} />;
}
