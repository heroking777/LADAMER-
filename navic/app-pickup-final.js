// スケジュール追加
window.addSchedule = async function(staffId) {
  const date = prompt("日付を入力してください (YYYY-MM-DD):");
  if (!date) return;
  const checkIn = prompt("出勤時間を入力 (HH:MM):", "09:00");
  if (checkIn === null) return;
  const checkOut = prompt("退勤時間を入力 (HH:MM):", "18:00");
  if (checkOut === null) return;

  try {
    const response = await fetch("/navic/api/attendance/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, date, checkIn, checkOut })
    });
    if (!response.ok) throw new Error("登録に失敗しました");
    alert("スケジュールを追加しました");
    document.querySelector("div[style*='position:fixed']")?.remove();
    window.showStaffSchedule(staffId);
  } catch (error) {
    alert("エラー: " + error.message);
  }
};
