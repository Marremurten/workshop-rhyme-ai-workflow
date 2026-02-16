import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "danger" | "ghost" | "secondary";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700",
  danger: "rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700",
  ghost: "w-full text-sm text-blue-600 hover:underline",
  secondary:
    "rounded bg-gray-700 px-3 py-1 text-sm text-gray-300 hover:bg-gray-600",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export default function Button({
  variant = "primary",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${variantClasses[variant]}${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
}
