/**
 * 308_MonthlyReport_CalendarExtract.gs
 * 
 * 役割:
 * - Googleカレンダーから今月のMTG予定を抽出
 * - プロジェクト関連のイベントを収集
 * 
 * 依存:
 * - 310_MonthlyReport_Formatter.gs
 * 
 * 前提:
 * - プロジェクトごとのカレンダーIDが紐付け済み
 */

/**
 * Googleカレンダーから今月の活動を抽出
 * @param {string} projectId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Object} 抽出結果
 */
function mr_extractFromCalendar_(projectId, startDate, endDate) {
  try {
    // プロジェクトのカレンダーIDを取得
    const calendarId = mr_calendar_getProjectCalendarId_(projectId);
    if (!calendarId) {
      return {
        success: false,
        error: 'カレンダーが見つかりません',
        events: []
      };
    }
    
    // イベントを取得
    const events = mr_calendar_getEvents_(calendarId, startDate, endDate);
    
    // イベントを拡充
    const enrichedEvents = mr_calendar_enrichEvents_(events);
    
    // 統計情報を計算
    const stats = mr_calendar_calculateStats_(enrichedEvents);
    
    return {
      success: true,
      calendarId: calendarId,
      events: enrichedEvents,
      stats: stats,
      period: {
        start: mr_formatReadable_(startDate),
        end: mr_formatReadable_(endDate)
      }
    };
    
  } catch (error) {
    Logger.log('Calendar抽出エラー: ' + error);
    return {
      success: false,
      error: error.toString(),
      events: []
    };
  }
}

/**
 * プロジェクトのカレンダーIDを取得
 * @param {string} projectId
 * @return {string|null}
 */
function mr_calendar_getProjectCalendarId_(projectId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_Projects');
    
    if (!sheet) {
      Logger.log('DB_Projects シートが見つかりません');
      // デフォルトカレンダーを返す
      return CalendarApp.getDefaultCalendar().getId();
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      return CalendarApp.getDefaultCalendar().getId();
    }
    
    const headers = data[0];
    const projectIdIdx = headers.indexOf('projectId');
    const calendarIdIdx = headers.indexOf('calendarId');
    
    if (projectIdIdx === -1) {
      return CalendarApp.getDefaultCalendar().getId();
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][projectIdIdx] === projectId) {
        const calendarId = calendarIdIdx !== -1 ? data[i][calendarIdIdx] : '';
        if (calendarId) {
          return calendarId;
        }
        break;
      }
    }
    
    // デフォルトカレンダーを使用
    return CalendarApp.getDefaultCalendar().getId();
    
  } catch (error) {
    Logger.log('カレンダーID取得エラー: ' + error);
    return CalendarApp.getDefaultCalendar().getId();
  }
}

/**
 * カレンダーからイベントを取得
 * @param {string} calendarId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Array}
 */
function mr_calendar_getEvents_(calendarId, startDate, endDate) {
  try {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      Logger.log('カレンダーが見つかりません: ' + calendarId);
      return [];
    }
    
    const events = calendar.getEvents(startDate, endDate);
    return events;
    
  } catch (error) {
    Logger.log('カレンダーイベント取得エラー: ' + error);
    return [];
  }
}

/**
 * イベント情報を拡充
 * @param {Array} events
 * @return {Array}
 */
function mr_calendar_enrichEvents_(events) {
  return events.map(event => {
    const startTime = event.getStartTime();
    const endTime = event.getEndTime();
    const durationMin = (endTime - startTime) / 1000 / 60;
    
    return {
      title: event.getTitle(),
      description: event.getDescription() || '',
      start_time: startTime,
      end_time: endTime,
      start_jst: mr_formatReadable_(startTime),
      end_jst: mr_formatReadable_(endTime),
      duration_minutes: durationMin,
      location: event.getLocation() || '',
      attendees: mr_calendar_getAttendees_(event),
      is_all_day: event.isAllDayEvent(),
      event_id: event.getId(),
      creator_email: event.getCreators()[0] || ''
    };
  });
}

/**
 * イベントの参加者を取得
 * @param {CalendarEvent} event
 * @return {Array}
 */
function mr_calendar_getAttendees_(event) {
  try {
    const guests = event.getGuestList();
    return guests.map(guest => ({
      email: guest.getEmail(),
      name: guest.getName() || guest.getEmail(),
      status: guest.getGuestStatus().toString()
    }));
  } catch (error) {
    Logger.log('参加者取得エラー: ' + error);
    return [];
  }
}

/**
 * 統計情報を計算
 * @param {Array} events
 * @return {Object}
 */
function mr_calendar_calculateStats_(events) {
  const totalEvents = events.length;
  const totalMinutes = events.reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
  
  // MTGタイプ別集計(タイトルから推測)
  const types = {
    '定例会': 0,
    '月次報告': 0,
    'ヒアリング': 0,
    'レビュー': 0,
    'その他': 0
  };
  
  events.forEach(event => {
    const title = event.title.toLowerCase();
    if (title.includes('定例') || title.includes('週次')) {
      types['定例会']++;
    } else if (title.includes('月次') || title.includes('報告')) {
      types['月次報告']++;
    } else if (title.includes('ヒアリング') || title.includes('面談')) {
      types['ヒアリング']++;
    } else if (title.includes('レビュー') || title.includes('確認')) {
      types['レビュー']++;
    } else {
      types['その他']++;
    }
  });
  
  return {
    totalEvents: totalEvents,
    totalHours: totalHours,
    averageDuration: totalEvents > 0 ? Math.round(totalMinutes / totalEvents) : 0,
    eventsByType: types
  };
}

/**
 * カレンダーイベントを要約用テキストに変換
 * @param {Array} events
 * @return {string}
 */
function mr_calendar_formatForSummary_(events) {
  if (!events || events.length === 0) {
    return '期間内にカレンダーイベントはありません。';
  }
  
  const formatted = events.map(event => {
    const attendeeNames = event.attendees.map(a => a.name).join(', ');
    return `【${mr_formatDateOnly_(event.start_time)}】${event.title}\n時間: ${mr_formatTimeOnly_(event.start_time)} 〜 ${mr_formatTimeOnly_(event.end_time)} (${event.duration_minutes}分)\n参加者: ${attendeeNames}\n${event.description ? '概要: ' + event.description.slice(0, 100) + '...' : ''}`;
  }).join('\n\n');
  
  return formatted;
}