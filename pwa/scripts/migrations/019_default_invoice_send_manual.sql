-- 019: 全 PJ の請求書送付モードをデフォルト manual にする (まさ要望、2026-05-07)
-- 背景: auto は freee 経由で誤送信のリスクがあるため、明示的に admin で
-- 切り替えた PJ だけ auto を許す方針に。

update projects set invoice_send_manual = true where invoice_send_manual is not true;

alter table projects alter column invoice_send_manual set default true;
