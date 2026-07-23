// ===========================================================================
// Navic 出勤管理フロントエンド
// API プレフィックス: /navic/api/attendance/
// ===========================================================================

const ATTENDANCE_API = "/navic/api/attendance";

const STATUS_LABEL = {
  working: "勤務中",
  completed: "退勤済",
  scheduled: "予定",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function attendanceContainer() {
  return (
    document.getElementById("attendance-list") ||
    document.getElementById("attendanceList") ||
    document.getElementById("attendance-content") ||
    document.getElementById("attendance")
  );
}

// 本日の出勤状況を描画（出勤/退勤ボタン付き）
window.renderAttendance = async function () {
  const container = attendanceContainer();
  if (!container) return;

  try {
    const response = await fetch(`${ATTENDANCE_API}/today`);
    if (!response.ok) throw new Error("出勤状況の取得に失敗しました");
    const rows = await response.json();

    const body = rows
      .map((row) => {
        const staffId = row.staff_id;
        const checkIn = row.check_in || "";
        const checkOut = row.check_out || "";
        const status = row.status ? STATUS_LABEL[row.status] || row.status : "未出勤";

        const checkInBtn = !checkIn
          ? `<button onclick="window.checkIn(${staffId})">出勤</button>`
          : "";
        const checkOutBtn = checkIn && !checkOut
          ? `<button onclick="window.checkOut(${staffId})">退勤</button>`
          : "";

        return `
          <tr data-staff-id="${staffId}">
            <td>${escapeHtml(row.staff_name || staffId)}</td>
            <td>${escapeHtml(checkIn || "-")}</td>
            <td>${escapeHtml(checkOut || "-")}</td>
            <td>${escapeHtml(status)}</td>
            <td>
              ${checkInBtn}
              ${checkOutBtn}
              <button onclick="window.showStaffSchedule(${staffId})">スケジュール</button>
            </td>
          </tr>`;
      })
      .join("");

    container.innerHTML = `
      <table class="attendance-table">
        <thead>
          <tr>
            <th>スタッフ</th>
            <th>出勤</th>
            <th>退勤</th>
            <th>状態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`;
  } catch (error) {
    container.innerHTML = `<p class="error">エラー: ${escapeHtml(error.message)}</p>`;
  }
};

// 出勤打刻
window.checkIn = async function (staffId) {
  try {
    const response = await fetch(`${ATTENDANCE_API}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId }),
    });
    if (!response.ok) throw new Error("出勤打刻に失敗しました");
    await window.renderAttendance();
  } catch (error) {
    alert("エラー: " + error.message);
  }
};

// 退勤打刻
window.checkOut = async function (staffId) {
  try {
    const response = await fetch(`${ATTENDANCE_API}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId }),
    });
    if (!response.ok) throw new Error("退勤打刻に失敗しました");
    await window.renderAttendance();
  } catch (error) {
    alert("エラー: " + error.message);
  }
};

// 週間カレンダー表示（今日から7日間）
window.showStaffSchedule = async function (staffId) {
  try {
    const response = await fetch(`${ATTENDANCE_API}/week/${staffId}`);
    if (!response.ok) throw new Error("週間スケジュールの取得に失敗しました");
    const week = await response.json();

    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const cards = week
      .map((day) => {
        const d = new Date(day.date + "T00:00:00");
        const label = `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
        const hasData = day.check_in || day.check_out;
        const status = day.status ? STATUS_LABEL[day.status] || day.status : "";

        const inner = hasData
          ? `<div class="times">${escapeHtml(day.check_in || "--:--")} 〜 ${escapeHtml(day.check_out || "--:--")}</div>
             <div class="status">${escapeHtml(status)}</div>`
          : `<div class="empty">クリックで追加</div>`;

        return `
          <div class="calendar-day" style="border:1px solid #ccc;border-radius:6px;padding:8px;min-width:110px;cursor:pointer;text-align:center;"
               onclick="window.editDaySchedule(${staffId}, '${day.date}', '${escapeHtml(day.check_in || "")}', '${escapeHtml(day.check_out || "")}')">
            <div class="date" style="font-weight:bold;margin-bottom:4px;">${label}</div>
            ${inner}
          </div>`;
      })
      .join("");

    // 既存モーダルを閉じてから開く
    document.querySelector("div[style*='position:fixed']")?.remove();

    const modal = document.createElement("div");
    modal.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;";
    modal.innerHTML = `
      <div style="background:#fff;border-radius:8px;padding:20px;max-width:90%;max-height:90%;overflow:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;">週間スケジュール</h3>
          <button onclick="this.closest('div[style*=fixed]').remove()">閉じる</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">${cards}</div>
      </div>`;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
  } catch (error) {
    alert("エラー: " + error.message);
  }
};

// 日付クリック時の編集（時間変更 / 追加）
window.editDaySchedule = async function (staffId, date, currentIn, currentOut) {
  const checkIn = prompt(`${date} の出勤時間 (HH:MM):`, currentIn || "09:00");
  if (checkIn === null) return;
  const checkOut = prompt(`${date} の退勤時間 (HH:MM):`, currentOut || "18:00");
  if (checkOut === null) return;

  try {
    const response = await fetch(`${ATTENDANCE_API}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, date, checkIn, checkOut }),
    });
    if (!response.ok) throw new Error("保存に失敗しました");
    await window.showStaffSchedule(staffId);
    if (typeof window.renderAttendance === "function") {
      window.renderAttendance();
    }
  } catch (error) {
    alert("エラー: " + error.message);
  }
};

// スケジュール追加（日付選択式）
window.addSchedule = async function (staffId) {
  const date = prompt("日付を入力してください (YYYY-MM-DD):");
  if (!date) return;
  const checkIn = prompt("出勤時間を入力 (HH:MM):", "09:00");
  if (checkIn === null) return;
  const checkOut = prompt("退勤時間を入力 (HH:MM):", "18:00");
  if (checkOut === null) return;

  try {
    const response = await fetch(`${ATTENDANCE_API}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, date, checkIn, checkOut }),
    });
    if (!response.ok) throw new Error("登録に失敗しました");
    alert("スケジュールを追加しました");
    document.querySelector("div[style*='position:fixed']")?.remove();
    window.showStaffSchedule(staffId);
  } catch (error) {
    alert("エラー: " + error.message);
  }
};
