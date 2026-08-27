// ⚠️ pwa/src/components/admin/kiyo-money-flow/ からのコピー。正本は pwa 側。
// これは「見せ方」だけの部品で、金額の計算は一切していない（数字は本体のAPIが返した値）。
// なのでズレても金額事故にはならないが、図の見た目が本体と食い違う。
// 本体側を直したらここも同じ内容にする。独自の見た目をここで足さないこと。

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
