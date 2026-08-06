import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm hover:brightness-110",
        secondary:
          "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-sm hover:bg-[var(--secondary)]",
        ghost:
          "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--secondary)]",
        danger:
          "border-transparent bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:brightness-110",
        outline:
          "border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--secondary)]",
      },
      size: {
        default: "h-10 px-3.5 py-2",
        sm: "h-8 rounded-md px-2.5 text-xs",
        lg: "h-11 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    href?: string;
    asChild?: boolean;
    children?: ReactNode;
  };

export function Button({
  href,
  variant = "primary",
  size = "default",
  asChild = false,
  className,
  children,
  ...rest
}: Props) {
  const cls = cn(buttonVariants({ variant, size }), className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cls} {...rest}>
      {children}
    </Comp>
  );
}

export { buttonVariants };
