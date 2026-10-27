import type { ComponentProps } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex min-w-0 flex-col gap-6', className)} {...props} />;
}
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn('flex flex-wrap gap-5 border-0 border-b border-solid border-border bg-transparent p-0 text-muted-foreground', className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn('inline-flex min-h-11 items-center justify-center gap-2 border-0 border-b-2 border-solid border-transparent bg-transparent px-1 py-2 font-sans text-sm font-medium text-muted-foreground outline-offset-3 hover:text-foreground focus-visible:outline-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55 data-[state=active]:border-primary data-[state=active]:text-primary [&_svg]:size-4', className)} {...props} />;
}
export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('min-w-0 text-foreground outline-offset-3 focus-visible:outline-3 focus-visible:outline-ring', className)} {...props} />;
}
