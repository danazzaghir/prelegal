"use client";

/** Shared styles and small building blocks for buttons and forms. */

export const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#209dd7] focus:outline-none focus:ring-1 focus:ring-[#209dd7]";

const buttonBase =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Main actions, such as New agreement and Download PDF (blue primary). */
export const primaryButtonClass = `${buttonBase} bg-[#209dd7] hover:bg-[#1a86b8] focus:ring-[#209dd7]`;

/** Buttons that submit a form, such as Sign in and Send (purple secondary). */
export const submitClass = `${buttonBase} bg-[#753991] hover:bg-[#62307a] focus:ring-[#753991]`;

type TextFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">;

/** A labelled text input, with an optional hint below it. */
export function TextField({ label, hint, value, onChange, ...input }: TextFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <input {...input} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="block text-xs text-[#888888]">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}
