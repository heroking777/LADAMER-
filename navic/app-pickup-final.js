
const API_BASE = '/navic/api';
let currentPage = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
    loadPage('dashboard');
    setupNavigation();
});

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            loadPage(page);
        });
    });
}

function getPageTitle(page) {
    const titles = {
        dashboard: 'ダッシュボード',
        pickup: 'おすすめ設定',
        reservations: '予約一覧',
        staff: 'スタッフ管理',
        customers: '顧客管理',
        locations: '利用場所管理',
        attendance: '出勤情報',
        calls: '通話ログ',
        tags: 'タグ管理'
    };
    return titles[page] || 'ダッシュボード';
}

async function fetchAPI(endpoint) {
    const response = await fetch(API_BASE + endpoint);
    if (!response.ok) {
        throw new Error('API error: ' + response.status);
    }
    return response.json();
}

function getStatusLabel(status) {
    const labels = {
        pending: '保留中',
        confirmed: '確定',
        completed: '完了',
        cancelled: 'キャンセル'
    };
    return labels[status] || status;
}

async function loadPage(page) {
    currentPage = page;
    const contentArea = document.getElementById('content-area');
    const titleElement = document.getElementById('page-title');
    if (titleElement) {
        titleElement.textContent = getPageTitle(page);
    }
    try {
        switch (page) {
            case 'dashboard':
                await renderDashboard(contentArea);
                break;
            case 'pickup':
                await renderPickup(contentArea);
                break;
            case 'reservations':
                await renderReservations(contentArea);
                break;
            case 'staff':
                await renderStaff(contentArea);
                break;
            case 'customers':
                await renderCustomers(contentArea);
                break;
            case 'locations':
                await renderLocations(contentArea);
                break;
            case 'attendance':
                await renderAttendance(contentArea);
                break;
            case 'tags':
                await renderTags(contentArea);
                break;
            case 'calls':
                await renderCalls(contentArea);
                break;
            default:
                contentArea.innerHTML = '<p>ページが見つかりません</p>';
        }
    } catch (error) {
        contentArea.innerHTML = '<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>' + error.message + '</p></div>';
    }
}


async function savePickupOrder() {
  try {
    const items = document.querySelectorAll("#pickup-list > div");
    const priorities = [];
    items.forEach((item, index) => {
      const staffId = parseInt(item.querySelector("button")?.onclick?.toString().match(/\d+/)?.[0] || "0");
      if (staffId > 0) {
        priorities.push({ staff_id: staffId, priority: index + 1 });
      }
    });
    
    const response = await fetch("/navic/api/pickup/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: priorities })
    });
    
    if (!response.ok) throw new Error("保存に失敗しました");
    await window.debugRenderPickup();
    alert("保存しました");
  } catch (error) {
    alert("保存エラー: " + error.message);
  }
}


async function renderDashboard(container) {
  try {
    const data = await fetchAPI("/dashboard");
    container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;"><div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:20px;"><div style="color:rgba(255,255,255,0.5);font-size:13px;">本日の予約</div><div style="font-size:28px;font-weight:600;">${data.todayReservations || 0}</div></div><div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:20px;"><div style="color:rgba(255,255,255,0.5);font-size:13px;">本日の通話数</div><div style="font-size:28px;font-weight:600;">${data.todayCalls || 0}</div></div><div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:20px;"><div style="color:rgba(255,255,255,0.5);font-size:13px;">アクティブスタッフ</div><div style="font-size:28px;font-weight:600;">${data.activeStaff || 0}</div></div><div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:20px;"><div style="color:rgba(255,255,255,0.5);font-size:13px;">AI通話中</div><div style="font-size:28px;font-weight:600;">${data.activeCalls || 0}</div></div></div>`;
  } catch (error) {
    container.innerHTML = `<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>${error.message}</p></div>`;
  }
}

const reservationFieldStyle =
  'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e0e0e0;padding:8px 12px;border-radius:6px;width:100%;box-sizing:border-box;';

async function renderReservations(container) {
  try {
    const [reservations, staffList] = await Promise.all([
      fetchAPI('/reservations'),
      fetchAPI('/staff')
    ]);

    let staffOptions = '<option value="">--</option>';
    if (staffList && staffList.length > 0) {
      for (let s of staffList) {
        staffOptions +=
          '<option value="' +
          s.id +
          '">' +
          (s.display_name || s.name) +
          '</option>';
      }
    }

    let html =
      '<div style="margin-bottom:24px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">' +
      '<h3 style="margin:0 0 16px;font-size:16px;">新規予約を追加</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;align-items:end;">' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);">Date<input type="date" id="res-date" style="' +
      reservationFieldStyle +
      '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);">Time<input type="time" id="res-time" style="' +
      reservationFieldStyle +
      '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);">Customer Name<input type="text" id="res-customer" style="' +
      reservationFieldStyle +
      '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);">Staff<select id="res-staff" style="' +
      reservationFieldStyle +
      '">' +
      staffOptions +
      '</select></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);">Location<input type="text" id="res-location" style="' +
      reservationFieldStyle +
      '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);">Course<input type="text" id="res-course" style="' +
      reservationFieldStyle +
      '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);">Option<input type="text" id="res-option" style="' +
      reservationFieldStyle +
      '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);">Status<select id="res-status" style="' +
      reservationFieldStyle +
      '"><option value="pending">pending</option><option value="confirmed">confirmed</option><option value="completed">completed</option></select></label>' +
      '<button type="button" onclick="addReservation()" style="background:#00d4aa;border:none;color:#0a0a0f;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;height:38px;">Add</button>' +
      '</div></div>';

    html +=
      '<table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06);">' +
      '<th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">Date</th>' +
      '<th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">Time</th>' +
      '<th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">Customer</th>' +
      '<th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">Staff</th>' +
      '<th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">Location</th>' +
      '<th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">Course</th>' +
      '<th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">Option</th>' +
      '<th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">Status</th>' +
      '</tr></thead><tbody>';

    if (reservations && reservations.length > 0) {
      for (let r of reservations) {
        html +=
          '<tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">' +
          (r.date || '--') +
          '</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">' +
          (r.time || '--:--') +
          '</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">' +
          (r.customer_name || r.customer || '--') +
          '</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">' +
          (r.staff_name || r.staff || '--') +
          '</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">' +
          (r.location || '--') +
          '</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">' +
          (r.course || r.course_name || '--') +
          '</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">' +
          (r.option || '--') +
          '</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="display:inline-block;padding:2px 12px;border-radius:12px;font-size:12px;background:rgba(0,212,170,0.15);color:#00d4aa;">' +
          getStatusLabel(r.status) +
          '</span></td></tr>';
      }
    } else {
      html +=
        '<tr><td colspan="8" style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);">予約データがありません</td></tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML =
      '<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>' + error.message + '</p></div>';
  }
}

window.addReservation = async function () {
  const date = document.getElementById('res-date')?.value?.trim();
  const time = document.getElementById('res-time')?.value?.trim();
  const customerName = document.getElementById('res-customer')?.value?.trim();
  const staffId = document.getElementById('res-staff')?.value;
  const location = document.getElementById('res-location')?.value?.trim();
  const course = document.getElementById('res-course')?.value?.trim();
  const option = document.getElementById('res-option')?.value?.trim();
  const status = document.getElementById('res-status')?.value || 'pending';

  if (!date || !time || !customerName) {
    alert('日付・時間・顧客名は必須です');
    return;
  }

  const payload = {
    date,
    time,
    customer_name: customerName,
    staff_id: staffId ? parseInt(staffId, 10) : null,
    location: location || '',
    course: course || '',
    option: option || '',
    status
  };

  try {
    const response = await fetch(API_BASE + '/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || '予約の作成に失敗しました');
    }

    alert('予約を追加しました');
    await loadPage('reservations');
  } catch (error) {
    alert('追加エラー: ' + error.message);
  }
};

async function renderStaff(container) {
  try {
    const staff = await fetchAPI('/staff');
    const allTags = await fetchAPI('/tags');
    const staffList = staff || [];
    const tagsList = allTags || [];

    let html = `
      <div style="margin-bottom:16px;">
        <button onclick="showAddStaff()" style="background:#00d4aa;border:none;color:#0a0a0f;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;">+ 新規スタッフ追加</button>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
            <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">名前</th>
            <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">タグ</th>
            <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">操作</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (staffList.length === 0) {
      html +=
        '<tr><td colspan="3" style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);">スタッフデータがありません</td></tr>';
    } else {
      for (let s of staffList) {
        const staffTags = s.tags || [];

        let tagsHtml = '';
        for (let t of staffTags) {
          tagsHtml += `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;background:${t.color}33;color:${t.color};margin:2px;border:1px solid ${t.color}44;">${t.name}</span>`;
        }

        html += `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">${s.display_name || s.name}</td>
          <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">${tagsHtml || '--'}</td>
          <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
            <button onclick="editStaffTags(${s.id})" style="background:rgba(0,212,170,0.15);border:none;color:#00d4aa;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;">✏️ タグ編集</button>
          </td>
        </tr>
      `;
      }
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML =
      '<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>' + error.message + '</p></div>';
  }
}

window.editStaffTags = async function (staffId) {
  try {
    document.querySelectorAll('[data-staff-tag-modal]').forEach(el => el.remove());

    const staff = await fetchAPI('/staff');
    const targetStaff = (staff || []).find(s => s.id === staffId);
    if (!targetStaff) return;

    const allTags = await fetchAPI('/tags');
    const tagsList = allTags || [];
    const staffTags = targetStaff.tags || [];
    const staffTagIds = staffTags.map(t => t.id);

    let html = `
      <div data-staff-tag-modal style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000;" onclick="if(event.target===this)this.remove()">
        <div style="background:#1a1a24;border-radius:12px;padding:32px;max-width:500px;width:100%;border:1px solid rgba(255,255,255,0.06);" onclick="event.stopPropagation()">
          <h3 style="margin-bottom:16px;">${targetStaff.display_name || targetStaff.name} のタグ編集</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
    `;

    for (let t of tagsList) {
      const checked = staffTagIds.includes(t.id);
      html += `
        <span onclick="window.toggleTag(${staffId}, ${t.id})"
             id="tag-${staffId}-${t.id}"
             style="display:inline-block;padding:6px 14px;border-radius:16px;font-size:13px;cursor:pointer;background:${checked ? t.color + '44' : 'rgba(255,255,255,0.06)'};color:${checked ? '#fff' : 'rgba(255,255,255,0.5)'};border:1px solid ${checked ? t.color : 'rgba(255,255,255,0.1)'};">
          ${t.name}
          ${checked ? ' ✓' : ''}
        </span>
      `;
    }

    html += `
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="this.closest('[data-staff-tag-modal]').remove()" style="background:rgba(255,255,255,0.06);border:none;color:#e0e0e0;padding:8px 16px;border-radius:6px;cursor:pointer;">閉じる</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  } catch (error) {
    alert('エラー: ' + error.message);
  }
};

window.toggleTag = async function (staffId, tagId) {
  try {
    const staff = await fetchAPI('/staff');
    const targetStaff = (staff || []).find(s => s.id === staffId);
    if (!targetStaff) return;

    const currentTags = targetStaff.tags || [];
    const tagIds = currentTags.map(t => t.id);

    if (tagIds.includes(tagId)) {
      tagIds.splice(tagIds.indexOf(tagId), 1);
    } else {
      tagIds.push(tagId);
    }

    const response = await fetch(API_BASE + '/tags/staff/' + staffId + '/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds })
    });

    if (!response.ok) {
      throw new Error('タグの保存に失敗しました');
    }

    await window.editStaffTags(staffId);
    await loadPage('staff');
  } catch (error) {
    alert('タグ更新エラー: ' + error.message);
  }
};

window.showAddStaff = function () {
  const name = prompt('スタッフ名を入力してください:');
  if (!name) return;

  fetch(API_BASE + '/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
    .then(res => {
      if (!res.ok) throw new Error('スタッフの追加に失敗しました');
      return res.json();
    })
    .then(() => {
      alert('スタッフを追加しました');
      loadPage('staff');
    })
    .catch(err => alert('エラー: ' + err.message));
};

async function renderCustomers(container) {
  try {
    const data = await fetchAPI("/customers");
    let html = `
      <button onclick="addCustomer()" style="background:#00d4aa;border:none;color:#0a0a0f;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:600;">追加</button>
      <table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
        <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">名前</th>
        <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">電話番号</th>
        <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">来店回数</th>
        <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">操作</th>
      </tr></thead><tbody>
    `;
    if (data && data.length > 0) {
      for (let c of data) {
        html += `
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">${c.name}</td>
            <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">${c.phone}</td>
            <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">${c.visit_count}回</td>
            <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
              <button onclick="editCustomer(${c.id})" style="background:rgba(0,212,170,0.15);border:none;color:#00d4aa;padding:4px 12px;border-radius:4px;cursor:pointer;">編集</button>
              <button onclick="deleteCustomer(${c.id})" style="background:rgba(220,53,69,0.15);border:none;color:#dc3545;padding:4px 12px;border-radius:4px;cursor:pointer;">削除</button>
            </td>
          </tr>
        `;
      }
    } else {
      html += '<tr><td colspan="4" style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);">顧客データがありません</td></tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>' + error.message + '</p></div>';
  }
}

window.addCustomer = async function () {
  const name = prompt("名前を入力してください:");
  if (!name) return;
  const phone = prompt("電話番号を入力してください:");
  if (!phone) return;

  try {
    await fetch("/navic/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone })
    });
    alert("顧客を追加しました");
    loadPage('customers');
  } catch (error) {
    alert("追加エラー: " + error.message);
  }
};

window.editCustomer = async function (id) {
  try {
    const data = await fetchAPI(`/customers/${id}`);
    const name = prompt("名前を編集:", data.name) || "";
    if (!name) return;
    const phone = prompt("電話番号を編集:", data.phone) || "";

    await fetch(`/navic/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone })
    });
    alert("顧客を更新しました");
    loadPage('customers');
  } catch (error) {
    alert("更新エラー: " + error.message);
  }
};

window.deleteCustomer = async function (id) {
  if (!confirm("この顧客を削除してもよろしいですか？")) return;

  try {
    await fetch(`/navic/api/customers/${id}`, { method: "DELETE" });
    alert("顧客を削除しました");
    loadPage('customers');
  } catch (error) {
    alert("削除エラー: " + error.message);
  }
};

async function renderLocations(container) {
  try {
    const data = await fetchAPI("/locations");
    let html = `<table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
          <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">名称</th>
          <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">住所</th>
          <th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">操作</th>
        </tr>
      </thead>
      <tbody>`;
    if (data && data.length > 0) {
      for (let l of data) {
        html += `<tr>
          <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">${l.name}</td>
          <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">${(l.address || '--')}</td>
          <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
            <button onclick="window.editLocation(${l.id})" style="background:rgba(0,212,170,0.15);border:none;color:#00d4aa;padding:4px 12px;border-radius:4px;cursor:pointer;">編集</button>
            <button onclick="window.deleteLocation(${l.id})" style="background:rgba(220,53,69,0.15);border:none;color:#dc3545;padding:4px 12px;border-radius:4px;cursor:pointer;">削除</button>
          </td>
        </tr>`;
      }
    } else {
      html += `<tr><td colspan="3" style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);">場所データがありません</td></tr>`;
    }
    html += `</tbody>
    </table>`;
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>${error.message}</p></div>`;
  }
}
window.editLocation = async function(id) {
  try {
    const data = await fetchAPI(`/locations/${id}`);
    const name = prompt("名前を編集:", data.name) || "";
    if (!name) return;
    const address = prompt("住所を編集:", data.address) || "";
    const phone = prompt("電話番号を編集:", data.phone) || "";

    await fetch(`/navic/api/locations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, phone })
    });
    alert("場所を更新しました");
    loadPage('locations');
  } catch (error) {
    alert("更新エラー: " + error.message);
  }
};
window.deleteLocation = async function(id) {
  if (!confirm("この場所を削除してもよろしいですか？")) return;

  try {
    await fetch(`/navic/api/locations/${id}`, { method: "DELETE" });
    alert("場所を削除しました");
    loadPage('locations');
  } catch (error) {
    alert("削除エラー: " + error.message);
  }
};
window.showAddLocationModal = function() {
  const name = prompt("名前を入力してください:");
  if (!name) return;
  const address = prompt("住所を入力してください:");
  if (!address) return;
  const phone = prompt("電話番号を入力してください:");
  if (!phone) return;

  fetch("/navic/api/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, address, phone })
  })
    .then(res => {
      if (!res.ok) throw new Error('場所の追加に失敗しました');
      return res.json();
    })
    .then(() => {
      alert("場所を追加しました");
      loadPage('locations');
    })
    .catch(err => alert('エラー: ' + err.message));
};

const ATTENDANCE_STATUS_LABEL = {
  working: '勤務中',
  completed: '退勤済',
  scheduled: '予定'
};

const cellStyle = 'padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);';
const btnStyle = 'margin-right:6px;padding:4px 12px;border:none;border-radius:4px;cursor:pointer;color:#fff;';

// 本日の出勤状況（出勤/退勤ボタン付き）
async function renderAttendance(container) {
  try {
    const data = await fetchAPI("/attendance/today");
    let html = '<table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">スタッフ</th><th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">出勤</th><th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">退勤</th><th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">状態</th><th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">操作</th></tr></thead><tbody>';
    if (data && data.length > 0) {
      for (let a of data) {
        const staffId = a.staff_id;
        const checkIn = a.check_in || '';
        const checkOut = a.check_out || '';
        const status = a.status ? (ATTENDANCE_STATUS_LABEL[a.status] || a.status) : '未出勤';

        let actions = '';
        if (!checkIn) {
          actions += '<button onclick="window.checkIn(' + staffId + ')" style="' + btnStyle + 'background:#00d4aa;">出勤</button>';
        }
        if (checkIn && !checkOut) {
          actions += '<button onclick="window.checkOut(' + staffId + ')" style="' + btnStyle + 'background:#ff9f43;">退勤</button>';
        }
        actions += '<button onclick="window.showStaffSchedule(' + staffId + ')" style="' + btnStyle + 'background:rgba(255,255,255,0.12);">スケジュール</button>';

        html += '<tr><td style="' + cellStyle + '">' + (a.staff_name || staffId) + '</td><td style="' + cellStyle + '">' + (checkIn || '--') + '</td><td style="' + cellStyle + '">' + (checkOut || '--') + '</td><td style="' + cellStyle + '">' + status + '</td><td style="' + cellStyle + '">' + actions + '</td></tr>';
      }
    } else {
      html += '<tr><td colspan="5" style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);">出勤データがありません</td></tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>' + error.message + '</p></div>';
  }
}

function attendanceContentArea() {
  return document.getElementById('content-area') || document.querySelector('.content-area');
}

// 出勤打刻
window.checkIn = async function (staffId) {
  try {
    const response = await fetch("/navic/api/attendance/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId })
    });
    if (!response.ok) throw new Error("出勤打刻に失敗しました");
    const container = attendanceContentArea();
    if (container) await renderAttendance(container);
  } catch (error) {
    alert("エラー: " + error.message);
  }
};

// 退勤打刻
window.checkOut = async function (staffId) {
  try {
    const response = await fetch("/navic/api/attendance/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId })
    });
    if (!response.ok) throw new Error("退勤打刻に失敗しました");
    const container = attendanceContentArea();
    if (container) await renderAttendance(container);
  } catch (error) {
    alert("エラー: " + error.message);
  }
};

// 週間カレンダー表示（今日から7日間）
window.showStaffSchedule = async function (staffId) {
  try {
    const response = await fetch("/navic/api/attendance/week/" + staffId);
    if (!response.ok) throw new Error("週間スケジュールの取得に失敗しました");
    const week = await response.json();

    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    let cards = '';
    for (let day of week) {
      const d = new Date(day.date + "T00:00:00");
      const label = (d.getMonth() + 1) + "/" + d.getDate() + " (" + weekdays[d.getDay()] + ")";
      const hasData = day.check_in || day.check_out;
      const status = day.status ? (ATTENDANCE_STATUS_LABEL[day.status] || day.status) : '';
      const inner = hasData
        ? '<div style="margin-top:4px;">' + (day.check_in || '--:--') + ' 〜 ' + (day.check_out || '--:--') + '</div><div style="margin-top:2px;color:rgba(255,255,255,0.4);font-size:12px;">' + status + '</div>'
        : '<div style="margin-top:8px;color:rgba(255,255,255,0.3);font-size:12px;">クリックで追加</div>';
      cards += '<div onclick="window.editDaySchedule(' + staffId + ", '" + day.date + "', '" + (day.check_in || '') + "', '" + (day.check_out || '') + '\')" style="border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px;min-width:120px;cursor:pointer;text-align:center;background:rgba(255,255,255,0.03);"><div style="font-weight:bold;">' + label + '</div>' + inner + '</div>';
    }

    document.querySelector("div[style*='position:fixed']")?.remove();

    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;";
    modal.innerHTML = '<div style="background:#1a1a1a;color:#fff;border-radius:10px;padding:20px;max-width:90%;max-height:90%;overflow:auto;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 style="margin:0;">週間スケジュール</h3><button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:4px 12px;border:none;border-radius:4px;cursor:pointer;">閉じる</button></div><div style="display:flex;gap:10px;flex-wrap:wrap;">' + cards + '</div></div>';
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  } catch (error) {
    alert("エラー: " + error.message);
  }
};

// 日付クリック時の編集（時間変更 / 追加）
window.editDaySchedule = async function (staffId, date, currentIn, currentOut) {
  const checkIn = prompt(date + " の出勤時間 (HH:MM):", currentIn || "09:00");
  if (checkIn === null) return;
  const checkOut = prompt(date + " の退勤時間 (HH:MM):", currentOut || "18:00");
  if (checkOut === null) return;
  try {
    const response = await fetch("/navic/api/attendance/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, date, checkIn, checkOut })
    });
    if (!response.ok) throw new Error("保存に失敗しました");
    await window.showStaffSchedule(staffId);
    const container = attendanceContentArea();
    if (container) renderAttendance(container);
  } catch (error) {
    alert("エラー: " + error.message);
  }
};

// Tag management functionality
async function renderTags(container) {
  try {
    const data = await fetchAPI("/tags");
    let html = `<div style="margin-bottom:16px;"><button onclick="addTag()" style="background:#00d4aa;border:none;color:#0a0a0f;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;">+ 新規タグ追加</button></div><div style="display:flex;flex-wrap:wrap;gap:8px;">`;
    if (data && data.length > 0) {
      for (let tag of data) {
        html += `<div style="display:inline-flex;align-items:center;gap:6px;background:${tag.color}22;color:${tag.color};border:1px solid ${tag.color}44;border-radius:12px;padding:4px 12px;font-size:12px;"><span>${tag.name}</span><span style="font-size:10px;color:rgba(255,255,255,0.3);">${tag.category || ""}</span><button onclick="editTag(${tag.id})" style="background:rgba(0,212,170,0.15);border:none;color:#00d4aa;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:10px;">✏️</button><button onclick="deleteTag(${tag.id})" style="background:rgba(220,53,69,0.15);border:none;color:#dc3545;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:10px;">🗑️</button></div>`;
      }
    } else {
      html += `<div style="color:rgba(255,255,255,0.3);">タグデータがありません</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>${error.message}</p></div>`;
  }
}

async function addTag() {
  const name = prompt("タグ名を入力してください:");
  if (!name) return;
  const category = prompt("カテゴリを入力してください（例: 体格, 雰囲気）:") || "その他";
  const color = prompt("色を入力してください（例: #ff6b6b）:") || "#00d4aa";
  fetch("/navic/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, category, color }) })
    .then(res => res.json())
    .then(() => { alert("タグを追加しました"); loadPage("tags"); })
    .catch(err => alert("エラー: " + err.message));
}

async function editTag(id) {
  fetch(`/navic/api/tags/${id}`)
    .then(res => res.json())
    .then(data => {
      const updatedName = prompt("タグ名を編集:", data.name) || "";
      if (!updatedName) return;
      const updatedCategory = prompt("カテゴリを編集:", data.category || "その他") || "その他";
      const updatedColor = prompt("色を編集:", data.color || "#00d4aa") || "#00d4aa";
      fetch(`/navic/api/tags/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: updatedName, category: updatedCategory, color: updatedColor }) })
        .then(res => res.json())
        .then(() => { alert("タグを更新しました"); loadPage("tags"); })
        .catch(err => alert("エラー: " + err.message));
    })
    .catch(err => alert("エラー: " + err.message));
}

async function deleteTag(id) {
  if (!confirm("このタグを削除してもよろしいですか？")) return;
  fetch(`/navic/api/tags/${id}`, { method: "DELETE" })
    .then(() => { alert("タグを削除しました"); loadPage("tags"); })
    .catch(err => alert("エラー: " + err.message));
}

function addTag() {
  const name = prompt("タグ名を入力してください:");
  if (!name) return;
  const category = prompt("カテゴリを入力してください（例: 体格, 雰囲気）:") || "その他";
  const color = prompt("色を入力してください（例: #ff6b6b）:") || "#00d4aa";
  fetch("/navic/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, category, color }) })
    .then(res => res.json())
    .then(() => { alert("タグを追加しました"); loadPage("tags"); })
    .catch(err => alert("エラー: " + err.message));
}

function editTag(id) {
  fetch(`/navic/api/tags/${id}`)
    .then(res => res.json())
    .then(data => {
      const updatedName = prompt("タグ名を編集:", data.name) || "";
      if (!updatedName) return;
      const updatedCategory = prompt("カテゴリを編集:", data.category || "その他") || "その他";
      const updatedColor = prompt("色を編集:", data.color || "#00d4aa") || "#00d4aa";
      fetch(`/navic/api/tags/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: updatedName, category: updatedCategory, color: updatedColor }) })
        .then(res => res.json())
        .then(() => { alert("タグを更新しました"); loadPage("tags"); })
        .catch(err => alert("エラー: " + err.message));
    })
    .catch(err => alert("エラー: " + err.message));
}

function deleteTag(id) {
  if (!confirm("このタグを削除してもよろしいですか？")) return;
  fetch(`/navic/api/tags/${id}`, { method: "DELETE" })
    .then(() => { alert("タグを削除しました"); loadPage("tags"); })
    .catch(err => alert("エラー: " + err.message));
}

async function renderCalls(container) {
  try {
    const data = await fetchAPI("/calls");
    let html = '<table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">通話ID</th><th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">ステータス</th><th style="text-align:left;padding:12px 16px;color:rgba(255,255,255,0.4);">開始時間</th></tr></thead><tbody>';
    if (data && data.length > 0) {
      for (let c of data) {
        html += '<tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">' + (c.call_id || '--') + '</td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="display:inline-block;padding:2px 12px;border-radius:12px;font-size:12px;background:rgba(0,212,170,0.15);color:#00d4aa;">' + (c.current_state || '--') + '</span></td><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">' + (c.started_at ? new Date(c.started_at).toLocaleString() : '--') + '</td></tr>';
      }
    } else {
      html += '<tr><td colspan="3" style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);">通話データがありません</td></tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>' + error.message + '</p></div>';
  }
}
// おすすめ設定のmovePickup（完全版）

window.setPickupPriority = async function(staffId, priority) {
  try {
    const response = await fetch(`/navic/api/pickup/settings/${staffId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: priority })
    });
    
    if (!response.ok) throw new Error("解除に失敗しました");
    await window.debugRenderPickup();
  } catch (error) {
    alert("解除エラー: " + error.message);
  }
};
// おすすめ設定のmovePickup（完全版）

window.setPickupPriority = async function(staffId, priority) {
  try {
    const response = await fetch(`/navic/api/pickup/settings/${staffId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: priority })
    });
    
    if (!response.ok) throw new Error("解除に失敗しました");
    await window.debugRenderPickup();
  } catch (error) {
    alert("解除エラー: " + error.message);
  }
};
// おすすめ設定のmovePickup（完全版）
window.movePickup = async function(staffId, direction) {
  console.log("movePickup called:", staffId, direction);
  try {
    const settings = await fetchAPI("/pickup/settings");
    let priorities = settings.map(s => ({ staff_id: s.staff_id, priority: s.priority }));
    
    let current = priorities.find(p => p.staff_id === staffId);
    if (!current) {
      current = { staff_id: staffId, priority: 0 };
      priorities.push(current);
    }
    
    const newPriority = current.priority + direction;
    if (newPriority < 0) return;
    
    const target = priorities.find(p => p.priority === newPriority);
    if (target) {
      target.priority = current.priority;
    }
    current.priority = newPriority;
    
    const response = await fetch("/navic/api/pickup/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: priorities })
    });
    
    if (!response.ok) throw new Error("保存に失敗しました");
    await window.debugRenderPickup();
  } catch (error) {
    alert("移動エラー: " + error.message);
  }
};

window.setPickupPriority = async function(staffId, priority) {
  try {
    const response = await fetch(`/navic/api/pickup/settings/${staffId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: priority })
    });
    
    if (!response.ok) throw new Error("解除に失敗しました");
    await window.debugRenderPickup();
  } catch (error) {
    alert("解除エラー: " + error.message);
  }
};
async function renderPickup(container) {
  try {
    const settings = await fetchAPI("/pickup/settings");
    const allStaff = await fetchAPI("/staff");
    
    let html = `<div style="margin-bottom:16px;"><h3>おすすめスタッフ順位設定</h3><p style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px;">指名なしの電話時に提案するスタッフの優先順位を設定します</p></div><div id="pickup-list" style="display:flex;flex-direction:column;gap:8px;max-width:600px;">`;
    
    const priorityMap = {};
    for (let s of settings) {
      priorityMap[s.staff_id] = s.priority;
    }
    
    const sorted = [...allStaff].sort((a, b) => {
      const pa = priorityMap[a.id] || 999;
      const pb = priorityMap[b.id] || 999;
      return pa - pb;
    });
    
    for (let s of sorted) {
      const currentPriority = priorityMap[s.id] || 0;
      const displayPriority = currentPriority > 0 ? "#" + currentPriority : "--";
      html += `<div style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px 16px;" data-staff-id="${s.id}"><span style="font-weight:600;color:#00d4aa;min-width:30px;">${displayPriority}</span><span style="flex:1;">${s.display_name || s.name}</span><div style="display:flex;gap:4px;"><button class="pickup-up" data-id="${s.id}" style="background:rgba(255,255,255,0.06);border:none;color:#e0e0e0;padding:4px 10px;border-radius:4px;cursor:pointer;">↑</button><button class="pickup-down" data-id="${s.id}" style="background:rgba(255,255,255,0.06);border:none;color:#e0e0e0;padding:4px 10px;border-radius:4px;cursor:pointer;">↓</button></div></div>`;
    }
    
    html += `</div><div style="margin-top:16px;display:flex;gap:8px;"><button onclick="savePickupOrder()" style="background:#00d4aa;border:none;color:#0a0a0f;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:600;">順位を保存</button><button onclick="resetPickupOrder()" style="background:rgba(255,255,255,0.06);border:none;color:#e0e0e0;padding:8px 20px;border-radius:6px;cursor:pointer;">リセット</button></div>`;
    
    container.innerHTML = html;
    
    document.querySelectorAll(".pickup-up").forEach(btn => {
      btn.addEventListener("click", function() {
        const id = parseInt(this.dataset.id);
        window.movePickup(id, -1);
      });
    });
    document.querySelectorAll(".pickup-down").forEach(btn => {
      btn.addEventListener("click", function() {
        const id = parseInt(this.dataset.id);
        window.movePickup(id, 1);
      });
    });
    document.querySelectorAll(".pickup-clear").forEach(btn => {
      btn.addEventListener("click", function() {
        const id = parseInt(this.dataset.id);
        window.setPickupPriority(id, 0);
      });
    });
  } catch (error) {
    container.innerHTML = `<div style="padding:20px;color:#ff6b6b;"><h3>エラー</h3><p>${error.message}</p></div>`;
  }
}

// 強制再描画用の関数
window.debugRenderPickup = async function() {
  const container = document.getElementById("content-area");
  if (container) {
    await renderPickup(container);
  }
};

// デバッグ用のrenderPickupラッパー
window.debugRenderPickup = async function() {
  console.log("debugRenderPickup called");
  const container = document.getElementById("content-area");
  console.log("container:", container);
  if (container) {
    try {
      await renderPickup(container);
      console.log("renderPickup completed");
    } catch (e) {
      console.error("renderPickup error:", e);
    }
  }
};

// デバッグ版renderPickup（データを確認）
window.debugRenderPickup = async function() {
  console.log("debugRenderPickup called");
  const container = document.getElementById("content-area");
  console.log("container:", container);
  if (container) {
    try {
      const settings = await fetchAPI("/pickup/settings");
      console.log("settings data:", settings);
      await renderPickup(container);
      console.log("renderPickup completed");
    } catch (e) {
      console.error("renderPickup error:", e);
    }
  }
};

// デバッグ版movePickup
window.debugMovePickup = async function(staffId, direction) {
  console.log("debugMovePickup called:", staffId, direction);
  try {
    const settings = await fetchAPI("/pickup/settings");
    console.log("current settings:", settings);
    let priorities = settings.map(s => ({ staff_id: s.staff_id, priority: s.priority }));
    
    let current = priorities.find(p => p.staff_id === staffId);
    if (!current) {
      current = { staff_id: staffId, priority: 0 };
      priorities.push(current);
    }
    
    const newPriority = current.priority + direction;
    if (newPriority < 0) return;
    
    const target = priorities.find(p => p.priority === newPriority);
    if (target) {
      target.priority = current.priority;
    }
    current.priority = newPriority;
    
    console.log("sending priorities:", priorities);
    const response = await fetch("/navic/api/pickup/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: priorities })
    });
    
    const responseText = await response.text();
    console.log("response status:", response.status);
    console.log("response body:", responseText);
    
    if (!response.ok) throw new Error("保存に失敗しました");
    await window.debugRenderPickup();
  } catch (error) {
    alert("移動エラー: " + error.message);
  }
};
async function resetPickupOrder() {
  if (!confirm("おすすめ順位をリセットしますか？")) return;
  
  try {
    // 全スタッフを取得
    const allStaff = await fetchAPI("/staff");
    // 全スタッフにID順で優先度を付与
    const priorities = allStaff.map((s, index) => ({
      staff_id: s.id,
      priority: index + 1
    }));
    
    const response = await fetch("/navic/api/pickup/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: priorities })
    });
    
    if (!response.ok) throw new Error("リセットに失敗しました");
    await renderPickup(document.getElementById("content-area"));
    alert("リセットしました");
  } catch (error) {
    alert("リセットエラー: " + error.message);
  }
}

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
