import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full",
    "text-[15px] font-medium transition-[background-color,border-color,opacity,box-shadow] duration-300 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    "disabled:pointer-events-none disabled:opacity-40",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-[#007AFF] text-white hover:opacity-90",
        secondary:
          "border border-[#E5E5E7] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#ECECF0]",
        ghost: "bg-transparent text-[#1D1D1F] hover:bg-black/[0.03]",
        link: "bg-transparent text-[#007AFF] hover:opacity-80",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-sm",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
