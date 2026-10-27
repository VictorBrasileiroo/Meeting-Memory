import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full border border-solid border-transparent px-2.5 py-1 font-sans text-xs font-medium leading-4 [&_svg]:size-3.5 [&_svg]:shrink-0', {
  variants: { variant: {
    default: 'bg-primary-soft text-primary',
    secondary: 'bg-secondary text-muted-foreground',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    destructive: 'bg-destructive-soft text-destructive',
    outline: 'border-border bg-transparent text-foreground',
  } }, defaultVariants: { variant: 'default' },
});
export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
