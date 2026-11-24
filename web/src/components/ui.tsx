import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Button({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={clsx("inline-flex min-h-10 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
}
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx("min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 focus:ring-2", className)} {...props} />;
}
export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}
export function ErrorState({ message }: { message: string }) {
  return <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>;
}
export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <div className="p-6 text-center text-sm text-slate-500">{label}</div>;
}
