/* ==================================================
   CONFIG
   ================================================== */
const API_URL = "https://script.google.com/macros/s/AKfycbxjPFCfjgfkGCZHCIJ6RKoNHQ7g9BdysfBdTKs42iyJikjv6BPr_z4UOVA3SMug4hCE/exec"; 

/* ==================================================
   STATE
   ================================================== */
let appData = { roadmap: [], tasks: [], logs: [], events: [], files: [], heatmap: {}, profile: {} };
let calendarState = { month: new Date().getMonth(), year: new Date().getFullYear() };
let currentTask = null;

/* ==================================================
   INIT
   ================================================== */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('inp-task-date').valueAsDate = new Date();
    loadData();
});

async function loadData() {
    try {
        const res = await fetch(`${API_URL}?action=getAllData`);
        const data = await res.json();
        if (data.status === 'success') {
            appData = data;
            renderAll();
        } else {
            showAlert("Gagal memuat data: " + data.message);
        }
    } catch (e) {
        console.error(e);
        showAlert("Gagal koneksi ke server.");
    }
}

function renderAll() {
    renderProfile();
    renderHome();
    renderRoadmap();
    renderTasks();
    renderCalendar(calendarState.month, calendarState.year);
    renderFiles();
}

/* ==================================================
   RENDER LOGIC
   ================================================== */

function renderProfile() {
    const { name, jurusan, judul, photo } = appData.profile;
    
    // Update Text
    const safeName = name || "Mahasiswa";
    const safeTitle = judul || "Belum ada judul";
    const safeMajor = jurusan || "Universitas Indonesia";

    document.getElementById('sidebar-name').innerText = safeName;
    document.getElementById('sidebar-major').innerText = safeMajor;
    document.getElementById('home-greeting').innerText = `Semangat ${safeName.split(' ')[0]}! 🎓`;
    document.getElementById('home-title').innerText = safeTitle;

    // Form Settings
    document.getElementById('prof-name').value = safeName;
    document.getElementById('prof-major').value = safeMajor;
    document.getElementById('prof-title').value = safeTitle;

    // Photos
    const avatarUrl = photo || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    document.getElementById('sidebar-avatar').src = avatarUrl;
    document.getElementById('settings-avatar').src = avatarUrl;
}

function renderHome() {
    // 1. Progress Stats
    const totalChapters = 5; // Asumsi Bab I - V
    const doneChapters = appData.roadmap.filter(r => r.Status === 'Selesai' && r.Bab.includes('Bab')).length; // Hitung kasar per sub-bab yang selesai? 
    // Logic Roadmap yang lebih baik: Hitung % dari total Sub-Bab di roadmap
    const totalSub = appData.roadmap.length || 1;
    const doneSub = appData.roadmap.filter(r => r.Status === 'Selesai').length;
    const percent = Math.round((doneSub / totalSub) * 100);
    
    document.getElementById('progress-text').innerText = `${percent}%`;
    document.getElementById('progress-bar').style.width = `${percent}%`;

    // 2. Total Hours (Fix Calculation)
    let totalMinutes = 0;
    appData.logs.forEach(log => {
        // Logika aman jika data berupa string atau number
        let dur = parseInt(log['Durasi (Menit)'] || log[4] || 0); 
        if(isNaN(dur)) dur = 0;
        totalMinutes += dur;
    });
    document.getElementById('total-hours').innerHTML = `${(totalMinutes/60).toFixed(1)} <span class="text-sm font-normal text-gray-400">jam</span>`;

    // 3. Heatmap
    const hmContainer = document.getElementById('heatmap-container');
    hmContainer.innerHTML = '';
    for (let w = 0; w < 20; w++) {
        const col = document.createElement('div');
        col.className = 'grid grid-rows-7 gap-1';
        for (let d = 0; d < 7; d++) {
            const date = new Date();
            date.setDate(date.getDate() - ((19-w)*7 + (6-d)));
            const dateStr = date.toISOString().split('T')[0];
            const count = appData.heatmap[dateStr] || 0;
            
            let color = 'bg-gray-200 dark:bg-gray-800';
            if (count >= 1) color = 'bg-green-200';
            if (count >= 3) color = 'bg-green-400';
            
            const box = document.createElement('div');
            box.className = `w-3 h-3 rounded-sm ${color}`;
            box.title = `${dateStr} (${count})`;
            col.appendChild(box);
        }
        hmContainer.appendChild(col);
    }

    // 4. Recent Logs
    const tbody = document.getElementById('recent-logs-body');
    tbody.innerHTML = '';
    appData.logs.slice(-5).reverse().forEach(log => {
        tbody.innerHTML += `
            <tr>
                <td class="px-4 py-3 text-xs text-gray-500">${log.Tanggal}</td>
                <td class="px-4 py-3"><div class="font-medium">${log.Aktivitas}</div><div class="text-xs text-gray-400">${log.Kategori}</div></td>
                <td class="px-4 py-3 text-right font-mono text-xs">${log['Durasi (Menit)'] || 0} m</td>
            </tr>`;
    });
}

function renderRoadmap() {
    const container = document.getElementById('roadmap-container');
    container.innerHTML = '';

    // Grouping
    const grouped = {};
    appData.roadmap.forEach(item => {
        const bab = item.Bab || 'Lainnya';
        if(!grouped[bab]) grouped[bab] = [];
        grouped[bab].push(item);
    });

    Object.keys(grouped).forEach(bab => {
        const items = grouped[bab];
        const isDone = items.every(i => i.Status === 'Selesai');
        
        let subHtml = '';
        items.forEach(sub => {
            const statusIcon = sub.Status === 'Selesai' ? '✅' : '⬜';
            const fileLink = sub['Link File'] ? `<a href="${sub['Link File']}" target="_blank" class="text-xs text-blue-500">File ↗</a>` : '';
            // Upload Dropzone per sub-bab (simplified)
            
            subHtml += `
                <div class="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 text-sm">
                    <span class="truncate pr-2">${statusIcon} ${sub['Sub-Bab']}</span>
                    ${fileLink}
                </div>`;
        });

        const html = `
            <div class="bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg p-4">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="font-bold text-md">📂 ${bab}</h3>
                    <span class="text-xs px-2 py-1 rounded ${isDone ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${isDone ? 'Selesai' : 'Proses'}</span>
                </div>
                <div class="pl-2">${subHtml}</div>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderTasks() {
    const container = document.getElementById('task-list-container');
    container.innerHTML = '';
    
    appData.tasks.filter(t => t.Status !== 'Done').forEach(task => {
        let color = 'bg-gray-100 text-gray-600';
        if(task.Kategori === 'Nulis') color = 'bg-purple-100 text-purple-600';
        if(task.Kategori === 'Bimbingan') color = 'bg-blue-100 text-blue-600';

        const html = `
            <div class="bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg p-3 flex items-center gap-3 shadow-sm">
                <input type="checkbox" class="w-5 h-5 cursor-pointer accent-black" onclick="openCompleteModal('${task.ID}', '${task.Task}', '${task.Kategori}')">
                <div class="flex-1">
                    <div class="font-medium text-sm">${task.Task}</div>
                    <div class="flex gap-2 mt-1">
                         <span class="text-[10px] bg-gray-100 dark:bg-gray-700 px-1 rounded">📅 ${task.Deadline} ${task['Jam Deadline'] || ''}</span>
                         <span class="text-[10px] ${color} px-1 rounded">${task.Kategori}</span>
                    </div>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderCalendar(month, year) {
    const grid = document.getElementById('calendar-grid');
    const list = document.getElementById('calendar-agenda-list');
    
    // Update Title
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    document.getElementById('cal-month-name').innerText = `${monthNames[month]} ${year}`;

    grid.innerHTML = ''; list.innerHTML = '';

    // Logic Hari
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Mapping Data (Events & Tasks)
    const map = {};
    appData.events.forEach(e => {
        if(!map[e.Tanggal]) map[e.Tanggal] = [];
        map[e.Tanggal].push({ title: e.Nama_Event, type: 'Event', color: 'blue', time: 'Full Day' });
    });
    appData.tasks.filter(t => t.Status !== 'Done').forEach(t => {
        if(!map[t.Deadline]) map[t.Deadline] = [];
        map[t.Deadline].push({ title: t.Task, type: 'Deadline', color: 'red', time: t['Jam Deadline'] || '23:59' });
    });

    // Render Blank Slots
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="h-10 md:h-14"></div>`;

    // Render Dates
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const items = map[dateStr] || [];
        const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
        
        const dots = items.map(i => `<div class="w-1.5 h-1.5 rounded-full bg-${i.color}-500"></div>`).join('');
        
        grid.innerHTML += `
            <div class="h-10 md:h-14 p-1 flex flex-col items-center rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${isToday ? 'bg-gray-100 dark:bg-gray-800 font-bold' : ''}" onclick="showAgendaDetail('${dateStr}')">
                <span class="${isToday ? 'bg-black text-white dark:bg-white dark:text-black w-6 h-6 flex items-center justify-center rounded-full' : 'text-sm'}">${d}</span>
                <div class="flex gap-0.5 mt-1">${dots}</div>
            </div>`;
            
        // Render List (Hanya jika ada item)
        items.forEach(item => {
            list.innerHTML += `
                <div class="flex gap-4 items-center p-2 border-b border-gray-50 dark:border-gray-800">
                    <div class="text-center w-10 text-${item.color}-600 font-bold text-lg">${d}</div>
                    <div>
                        <p class="font-medium text-sm">${item.title}</p>
                        <p class="text-xs text-gray-500">${item.type} • ${item.time}</p>
                    </div>
                </div>`;
        });
    }
    
    if(list.innerHTML === '') list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Tidak ada agenda.</p>';
}

function renderFiles() {
    const grid = document.getElementById('files-grid');
    grid.innerHTML = '';
    appData.files.forEach(f => {
        grid.innerHTML += `
            <a href="${f.url}" target="_blank" class="p-4 border border-notion-border dark:border-notion-darkBorder rounded-lg bg-white dark:bg-[#202020] hover:shadow-md block">
                <div class="text-2xl mb-2">📄</div>
                <div class="text-sm font-medium truncate">${f.name}</div>
                <div class="text-xs text-gray-400">${f.size}</div>
            </a>`;
    });
}

/* ==================================================
   ACTIONS
   ================================================== */
function changeMonth(dir) {
    calendarState.month += dir;
    if(calendarState.month > 11) { calendarState.month = 0; calendarState.year++; }
    if(calendarState.month < 0) { calendarState.month = 11; calendarState.year--; }
    renderCalendar(calendarState.month, calendarState.year);
}

function addTask() {
    const name = document.getElementById('inp-task-name').value;
    const date = document.getElementById('inp-task-date').value;
    const time = document.getElementById('inp-task-time').value;
    const cat = document.getElementById('inp-task-cat').value;

    if(!name || !date) return showAlert("Nama dan Tanggal wajib diisi!");

    document.getElementById('inp-task-name').value = ''; // Reset UI
    
    postData({ action: 'addTask', task: name, deadline: date, time: time, category: cat });
}

function openCompleteModal(id, name, cat) {
    currentTask = { id, name, cat };
    document.getElementById('modal-task-name').innerText = name;
    
    // Auto fill time
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    document.getElementById('modal-start-time').value = `${hh}:${mm}`; // Start now
    
    now.setHours(now.getHours()+1);
    const endHh = String(now.getHours()).padStart(2,'0');
    const endMm = String(now.getMinutes()).padStart(2,'0');
    document.getElementById('modal-end-time').value = `${endHh}:${endMm}`; // End +1h
    
    document.getElementById('modal-complete').classList.remove('hidden');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showAlert(msg) { document.getElementById('alert-msg').innerText = msg; document.getElementById('modal-alert').classList.remove('hidden'); }

function submitCompletion() {
    const start = document.getElementById('modal-start-time').value;
    const end = document.getElementById('modal-end-time').value;
    
    closeModal('modal-complete');
    postData({
        action: 'completeTask',
        taskId: currentTask.id,
        taskName: currentTask.name,
        category: currentTask.category,
        date: new Date().toISOString().split('T')[0],
        startTime: start,
        endTime: end
    });
}

function openHistoryModal() {
    const tbody = document.getElementById('full-history-body');
    tbody.innerHTML = '';
    appData.logs.slice().reverse().forEach(log => {
        tbody.innerHTML += `
            <tr>
                <td class="p-3 text-gray-500">${log.Tanggal}</td>
                <td class="p-3"><div>${log.Aktivitas}</div><div class="text-xs text-gray-400">${log.Kategori}</div></td>
                <td class="p-3 font-mono text-xs">${log['Jam Mulai'] || '-'} - ${log['Jam Selesai'] || '-'}</td>
                <td class="p-3 text-right font-bold">${log['Durasi (Menit)'] || 0} m</td>
            </tr>`;
    });
    document.getElementById('modal-history').classList.remove('hidden');
}

/* ==================================================
   UPLOAD ACTIONS (FILES & PHOTO)
   ================================================== */
// Helper File to Base64
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

async function handleFileUpload(files) {
    if(files.length === 0) return;
    const file = files[0];
    if(file.size > 5 * 1024 * 1024) return showAlert("File terlalu besar (Max 5MB)");

    showAlert("Mengupload file...");
    try {
        const b64 = await toBase64(file);
        await postData({
            action: 'uploadFile',
            fileName: file.name,
            mimeType: file.type,
            fileData: b64
        });
    } catch(e) { showAlert("Gagal upload"); }
}

async function uploadProfilePhoto(files) {
    if(files.length === 0) return;
    const file = files[0];
    
    // Update UI Preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('settings-avatar').src = e.target.result;
        document.getElementById('sidebar-avatar').src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Kirim data saat tombol Simpan ditekan (disimpan di global state sementara)
    // Tapi user minta di setting profile ada pengaturan upload. 
    // Kita simpan base64 di variable global untuk dikirim saat saveProfile()
    window.pendingPhoto = await toBase64(file);
}

async function saveProfile() {
    const name = document.getElementById('prof-name').value;
    const major = document.getElementById('prof-major').value;
    const title = document.getElementById('prof-title').value;
    
    const payload = {
        action: 'updateProfile',
        name: name,
        jurusan: major,
        judul: title,
        photoData: window.pendingPhoto || null // Kirim foto jika ada
    };
    
    await postData(payload);
    window.pendingPhoto = null; // Reset
    showAlert("Profil Tersimpan!");
}

async function postData(payload) {
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        loadData(); // Reload all data
    } catch(e) { console.error(e); }
}
