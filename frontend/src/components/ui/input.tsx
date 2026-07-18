import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          [
            "flex h-12 w-full rounded-2xl border border-[#E5E5E7] bg-white px-4",
            "text-[15px] text-[#1D1D1F] placeholder:text-[#86868B]",
            "transition-[border-color,background-color,box-shadow] duration-300 ease-out",
            "outline-none hover:border-[#BFD9FF] focus:border-[#007AFF] focus:bg-white",
            "focus:shadow-[0_0_0_4px_rgba(0,122,255,0.08)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" "),
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
