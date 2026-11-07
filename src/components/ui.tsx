import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "lg" | "md" | "sm";

const base = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none select-none";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark active:bg-brand-dark",
  secondary: "bg-white text-brand border-2 border-brand hover:bg-brand-soft",
  ghost: "text-ink hover:bg-black/5",
};
const sizes: Record<Size, string> = { lg: "h-14 px-7 text-lg", md: "h-12 px-5 text-base", sm: "h-10 px-4 text-sm" };

export const btn = (variant: Variant = "primary", size: Size = "lg", extra = "") => `${base} ${variants[variant]} ${sizes[size]} ${extra}`;

export function Button({ variant = "primary", size = "lg", className = "", ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={btn(variant, size, className)} {...rest} />;
}

export function ButtonLink({ variant = "primary", size = "lg", className = "", ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={btn(variant, size, className)} {...rest} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-white shadow-card ${className}`}>{children}</div>;
}
