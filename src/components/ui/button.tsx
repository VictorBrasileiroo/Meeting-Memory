// Adapted from shadcn/ui (MIT): local tokens, wrapping labels and explicit button type.
import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-solid border-transparent font-sans text-sm font-medium leading-5 text-center no-underline transition-colors duration-150 outline-offset-3 focus-visible:outline-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:opacity-55 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        outline: 'border-input bg-surface text-foreground hover:bg-secondary',
        ghost: 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
        'destructive-outline': 'border-destructive bg-transparent text-destructive hover:bg-destructive-soft',
      },
      size: {
        default: 'min-h-11 px-4 py-2.5',
        sm: 'min-h-9 px-3 py-1.5',
        icon: 'size-10 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...(!asChild ? { type: type ?? 'button' } : {})} {...props} />;
}
