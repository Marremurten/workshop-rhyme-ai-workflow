import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
}

export default function FormField({
  label,
  htmlFor,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-300"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClassName =
  "mt-1 block w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white";
