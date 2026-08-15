/**
 * 公開ICS (iCalendar) の取り込み。
 *
 * なぜこの経路か: 愛媛大テナントはユーザー同意を無効化しており、Microsoft公式の
 * 検証済みアプリですら Calendars.Read が「管理者の承認が必要」で弾かれた
 * (2026-08-15 実測 / EHM_OS_M365_VERDICT_20260815.md)。Outlookの「予定表を公開する」
 * で発行できるICS URLなら、OAuthも管理者承認も要らずに件名・日時・場所が取れる。
 *
 * 扱う範囲: SUMMARY / DTSTART / DTEND / LOCATION / UID / STATUS だけ。
 * 公開範囲を「タイトルと場所」にしたICSには DESCRIPTION が構造的に含まれないが、
 * 「すべての詳細」で公開されたフィードが登録された場合に備え、**本文は読み捨てる**。
 */

export type IcsEvent = {
  uid: string;
  summary: string;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isAllDay: boolean;
  status: string | null;
};

/**
 * RFC 5545 の行折り返しを戻す。72オクテット付近で折られ、継続行は空白かタブで始まる。
 * 折り返しを戻さないと、日本語の件名が途中で切れて別プロパティに見える。
 */
function unfoldLines(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** `SUMMARY;LANGUAGE=ja:打合せ` → { name:"SUMMARY", params:{LANGUAGE:"ja"}, value:"打合せ" } */
function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(";");
  const name = (parts[0] || "").toUpperCase();
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name, params, value };
}

/** ICSのテキスト値のエスケープを戻す (`\,` `\;` `\n` `\\`)。 */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * ICSの日時をISO文字列へ。
 * - `20260815T090000Z` … UTC
 * - `20260815T090000` + TZID … タイムゾーン付きlocal。TZIDのVTIMEZONE解決まではせず、
 *   日本の予定表という前提でJST(+09:00)として解釈する。異なるTZの予定は時刻がずれるため、
 *   将来TZIDを見る必要が出たらここを直す。
 * - `20260815` (VALUE=DATE) … 終日
 */
function parseIcsDate(value: string, params: Record<string, string>): { iso: string | null; isAllDay: boolean } {
  const raw = value.trim();
  if (params.VALUE === "DATE" || /^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    if (!y || !m || !d) return { iso: null, isAllDay: true };
    return { iso: `${y}-${m}-${d}T00:00:00+09:00`, isAllDay: true };
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(raw);
  if (!match) return { iso: null, isAllDay: false };
  const [, y, m, d, hh, mm, ss, zulu] = match;
  const suffix = zulu === "Z" ? "Z" : "+09:00";
  return { iso: `${y}-${m}-${d}T${hh}:${mm}:${ss}${suffix}`, isAllDay: false };
}

export function parseIcs(raw: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: Partial<IcsEvent> | null = null;
  // VTIMEZONE の中にも DTSTART があるので、VEVENT の中だけを見る必要がある。
  const depth: string[] = [];

  for (const line of unfoldLines(raw)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;

    if (name === "BEGIN") {
      depth.push(value.toUpperCase());
      if (value.toUpperCase() === "VEVENT") current = { isAllDay: false };
      continue;
    }
    if (name === "END") {
      const ended = depth.pop();
      if (ended === "VEVENT" && current) {
        if (current.uid && current.summary !== undefined) {
          events.push({
            uid: current.uid,
            summary: current.summary || "(件名なし)",
            location: current.location ?? null,
            startsAt: current.startsAt ?? null,
            endsAt: current.endsAt ?? null,
            isAllDay: current.isAllDay === true,
            status: current.status ?? null,
          });
        }
        current = null;
      }
      continue;
    }
    if (!current || depth[depth.length - 1] !== "VEVENT") continue;

    switch (name) {
      case "UID":
        current.uid = value.trim();
        break;
      case "SUMMARY":
        current.summary = unescapeText(value).trim();
        break;
      case "LOCATION": {
        const location = unescapeText(value).trim();
        current.location = location.length > 0 ? location : null;
        break;
      }
      case "DTSTART": {
        const { iso, isAllDay } = parseIcsDate(value, params);
        current.startsAt = iso;
        if (isAllDay) current.isAllDay = true;
        break;
      }
      case "DTEND": {
        const { iso } = parseIcsDate(value, params);
        current.endsAt = iso;
        break;
      }
      case "STATUS":
        current.status = value.trim();
        break;
      // DESCRIPTION / ATTENDEE / ORGANIZER / ATTACH は意図的に読み捨てる。
      // 「すべての詳細」で公開されたフィードが登録されても本文を保存しない。
      default:
        break;
    }
  }
  return events;
}

/**
 * URLの末尾4文字だけを見せる指紋。URL全体はDTO・ログ・画面へ出さない
 * (知っていれば認証なしで予定が読めるため)。
 */
export function feedFingerprint(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length <= 4) return "****";
  return `…${trimmed.slice(-4)}`;
}

export class IcsFetchError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "IcsFetchError";
    this.status = status;
  }
}

/** 公開ICSを取得する。認証は付けない (公開URLなので付ける相手がいない)。 */
export async function fetchIcs(url: string, timeoutMs = 20000): Promise<string> {
  if (!/^https:\/\//i.test(url)) {
    throw new IcsFetchError("ICSのURLはhttpsだけを受け付ける", null);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" },
    });
    if (!res.ok) {
      // URLは載せない。提供者が「公開取り消し」を押すと404になるので、状態の手がかりだけ残す。
      throw new IcsFetchError(`ICSの取得に失敗した (HTTP ${res.status})`, res.status);
    }
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) {
      throw new IcsFetchError("取得した内容がiCalendar形式ではない", res.status);
    }
    return text;
  } catch (error) {
    if (error instanceof IcsFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new IcsFetchError("ICSの取得がタイムアウトした", null);
    }
    throw new IcsFetchError(
      `ICSの取得に失敗した: ${error instanceof Error ? error.message : String(error)}`,
      null,
    );
  } finally {
    clearTimeout(timer);
  }
}
