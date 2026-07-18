import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        [
          "peer h-4 w-4 shrink-0 rounded-[5px] border border-[#D2D2D7] bg-white",
          "transition-[background-color,border-color,box-shadow] duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          "data-[state=checked]:border-[#007AFF] data-[state=checked]:bg-[#007AFF]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        ].join(" "),
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        <Check className="h-3.5 w-3.5 stroke-[3]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
