-- billing_cycles に請求書詳細カラムを追加
-- GAS側の invoiceBaseLinesJson / invoiceSubject / freeeInvoiceNumber / invoicePdfUrl に相当

ALTER TABLE billing_cycles
  ADD COLUMN IF NOT EXISTS invoice_base_lines_json TEXT,
  ADD COLUMN IF NOT EXISTS invoice_subject TEXT,
  ADD COLUMN IF NOT EXISTS freee_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;
