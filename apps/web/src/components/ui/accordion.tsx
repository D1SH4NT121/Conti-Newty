import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface AccordionContextType {
  value?: string | string[];
  onValueChange: (val: string) => void;
  collapsible?: boolean;
}

const AccordionContext = React.createContext<AccordionContextType | null>(null);

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  collapsible?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({
  collapsible = true,
  value: controlledValue,
  defaultValue,
  onValueChange,
  children,
  className,
  ...props
}) => {
  const [internalValue, setInternalValue] = React.useState<string>(defaultValue || "");
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = (val: string) => {
    const nextVal = value === val && collapsible ? "" : val;
    setInternalValue(nextVal);
    onValueChange?.(nextVal);
  };

  return (
    <AccordionContext.Provider value={{ value, onValueChange: handleValueChange, collapsible }}>
      <div className={cn("space-y-0", className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-value={value}
        className={cn("border-b border-border transition-colors", className)}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, { itemValue: value });
          }
          return child;
        })}
      </div>
    );
  }
);
AccordionItem.displayName = "AccordionItem";

interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  itemValue?: string;
}

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, itemValue = "", ...props }, ref) => {
    const ctx = React.useContext(AccordionContext);
    const isOpen = ctx?.value === itemValue;

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => ctx?.onValueChange(itemValue)}
        className={cn(
          "flex w-full items-center justify-between py-4 text-left font-medium transition-all hover:text-white cursor-pointer select-none",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200 text-zinc-400",
            isOpen && "rotate-180 text-white"
          )}
        />
      </button>
    );
  }
);
AccordionTrigger.displayName = "AccordionTrigger";

interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  itemValue?: string;
}

export const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, itemValue = "", ...props }, ref) => {
    const ctx = React.useContext(AccordionContext);
    const isOpen = ctx?.value === itemValue;

    if (!isOpen) return null;

    return (
      <div
        ref={ref}
        className={cn("overflow-hidden text-sm transition-all pb-4 pt-1", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AccordionContent.displayName = "AccordionContent";
