import { forwardRef, HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const sectionVariants = cva("relative w-full", {
  variants: {
    spacing: {
      none: "py-0",
      xs: "py-6 lg:py-8",
      sm: "py-10 lg:py-12",
      md: "py-16 lg:py-20",
      lg: "py-20 lg:py-28",
      xl: "py-24 lg:py-36",
    },
    background: {
      default: "bg-background",
      muted: "bg-muted/30",
      accent: "bg-accent/5",
      transparent: "bg-transparent",
    },
    overflow: {
      hidden: "overflow-hidden",
      visible: "overflow-visible",
    },
  },
  defaultVariants: {
    spacing: "md",
    background: "default",
    overflow: "hidden",
  },
});

const containerVariants = cva("mx-auto px-4 lg:px-8 relative z-10", {
  variants: {
    width: {
      default: "container",
      narrow: "max-w-4xl",
      wide: "max-w-7xl",
      full: "w-full",
    },
  },
  defaultVariants: { width: "default" },
});

export interface SectionProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {
  /** Optional container width preset. Set to `none` to render children without an inner container. */
  container?: "default" | "narrow" | "wide" | "full" | "none";
  /** Class applied to the inner container (ignored when `container="none"`). */
  containerClassName?: string;
}

/**
 * Reusable layout section with configurable vertical padding, background and container width.
 * Use across landing pages and internal pages to keep rhythm consistent.
 */
export const Section = forwardRef<HTMLElement, SectionProps>(
  (
    {
      className,
      containerClassName,
      spacing,
      background,
      overflow,
      container = "default",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <section
        ref={ref}
        className={cn(sectionVariants({ spacing, background, overflow }), className)}
        {...props}
      >
        {container === "none" ? (
          children
        ) : (
          <div className={cn(containerVariants({ width: container }), containerClassName)}>
            {children}
          </div>
        )}
      </section>
    );
  }
);

Section.displayName = "Section";
