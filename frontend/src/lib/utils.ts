import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function receiptShareUrl(receiptId: string) {
  return `${window.location.origin}/receipt/${receiptId}?ref=share`
}
