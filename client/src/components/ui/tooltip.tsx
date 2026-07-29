import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

/**
 * Mobile-friendly Tooltip: opens on tap (touch devices) and hover (desktop).
 */
function Tooltip({
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [open, setOpen] = React.useState(false);
  const isTouchRef = React.useRef(false);

  React.useEffect(() => {
    const handler = () => { isTouchRef.current = true; };
    window.addEventListener("touchstart", handler, { once: true, passive: true });
    return () => window.removeEventListener("touchstart", handler);
  }, []);

  // Close tooltip when tapping outside on mobile
  React.useEffect(() => {
    if (!open || !isTouchRef.current) return;
    const close = () => setOpen(false);
    const timer = setTimeout(() => {
      document.addEventListener("touchstart", close, { once: true });
    }, 100);
    return () => { clearTimeout(timer); document.removeEventListener("touchstart", close); };
  }, [open]);

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={open}
        onOpenChange={(v) => {
          if (!isTouchRef.current) setOpen(v);
        }}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && (child as any).type === TooltipTrigger) {
            return React.cloneElement(child as React.ReactElement<any>, {
              onTouchEnd: (e: React.TouchEvent) => {
                if (isTouchRef.current) {
                  e.preventDefault();
                  setOpen((prev) => !prev);
                }
              },
            });
          }
          return child;
        })}
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit max-w-none origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
