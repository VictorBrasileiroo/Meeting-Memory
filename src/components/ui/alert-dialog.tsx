import type { ComponentProps } from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '../../lib/utils';
import { buttonVariants } from './button';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

// CSP adaptation: Radix's Overlay injects a runtime <style> through RemoveScroll.
// Keep its modal Content (focus trap, cancel autofocus, Escape, return focus,
// aria-hidden outside) and use a static overlay + packaged :has() scroll lock.
export function AlertDialogContent({ className, children, ...props }: Omit<ComponentProps<typeof AlertDialogPrimitive.Content>, 'forceMount'>) {
  return <AlertDialogPrimitive.Portal>
    <div data-slot="alert-dialog-overlay" aria-hidden="true" className="pointer-events-auto fixed inset-0 z-50 bg-overlay" />
    <AlertDialogPrimitive.Content data-slot="alert-dialog-content" className={cn('fixed top-1/2 left-1/2 z-50 grid max-h-[85dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-xl border border-solid border-border bg-surface p-6 font-sans text-foreground shadow-dialog outline-none', className)} {...props}>{children}</AlertDialogPrimitive.Content>
  </AlertDialogPrimitive.Portal>;
}
export function AlertDialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-dialog-header" className={cn('grid gap-2 text-left', className)} {...props} />;
}
export function AlertDialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-dialog-footer" className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}
export function AlertDialogTitle({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title data-slot="alert-dialog-title" className={cn('m-0 text-xl font-semibold leading-7 tracking-tight', className)} {...props} />;
}
export function AlertDialogDescription({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description data-slot="alert-dialog-description" className={cn('m-0 text-sm leading-6 text-muted-foreground', className)} {...props} />;
}
export function AlertDialogAction({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return <AlertDialogPrimitive.Action data-slot="alert-dialog-action" className={cn(buttonVariants(), className)} {...props} />;
}
export function AlertDialogCancel({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel data-slot="alert-dialog-cancel" className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />;
}
