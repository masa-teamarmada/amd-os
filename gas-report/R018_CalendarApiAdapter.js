// R018_CalendarApiAdapter.gs
// ============================================================
// Google Calendar Advanced Service wrapper
// - listEventsByApi_: Calendar.Events.list を使って期間内イベント取得
// - getCalendarDefaultColorId_: Calendar.CalendarList.get でカレンダー色取得
//
// 事前条件：GASプロジェクトで Advanced Google services の Calendar API を有効化
// ============================================================

/**
 * Calendar API（Advanced）で色付きイベント取得
 * @param {string} calendarId
 * @param {Date} start inclusive
 * @param {Date} endExclusive exclusive
 * @returns {Array} events
 */
function listEventsByApi_(calendarId, start, endExclusive) {
  var calId = String(calendarId || '').trim();
  if (!calId) throw new Error('calendarId empty');

  var timeMin = start.toISOString();
  var timeMax = endExclusive.toISOString();

  var all = [];
  var pageToken;

  do {
    var res = Calendar.Events.list(calId, {
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken: pageToken
    });

    if (res && res.items && res.items.length) {
      for (var i = 0; i < res.items.length; i++) all.push(res.items[i]);
    }
    pageToken = res.nextPageToken;
  } while (pageToken);

  return all;
}

/**
 * カレンダー自体のデフォ色（calendarColorId）を取る
 * @param {string} calendarId
 * @returns {string} colorId or ""
 */
function getCalendarDefaultColorId_(calendarId){
  var calId = String(calendarId || '').trim();
  if (!calId) return '';

  var calEntry = Calendar.CalendarList.get(calId);
  return String(calEntry && calEntry.colorId ? calEntry.colorId : '').trim();
}
