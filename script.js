/* ================= CONFIG ================= */
const API_URL = "https://script.google.com/macros/s/AKfycbxjPFCfjgfkGCZHCIJ6RKoNHQ7g9BdysfBdTKs42iyJikjv6BPr_z4UOVA3SMug4hCE/exec"; 

/* ================= STATE ================= */
let appData = { roadmap: [], tasks: [], logs: [], events: [], files: [], heatmap: {}, profile: {} };
let calendarState = { month: new Date().getMonth(), year: new Date().getFullYear() };
let currentCompletingTask = null;
let pendingPhotoData = null;

/* ================= INIT ================= */
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
            showModalInfo("Gagal memuat data: " + data.message);
        }
    } catch (e) {
        console.error(e);
        // Silent fail or retry logic
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

/* ================= RENDERERS ================= */

function renderProfile() {
    const p = appData.profile;
    const name = p.name || "Mahasiswa";
    
    // Update Header Sidebar & Home
    document.getElementById('sidebar-name').innerText = name;
    document.getElementById('sidebar-major').innerText = p.jurusan || "Universitas Indonesia";
    document.getElementById('home-greeting').innerText = `Semangat ${name.split(' ')[0]}! 🎓`;
    document.getElementById('home-title').innerText = p.judul || "Judul Tesis...";
    
    // Update Form Inputs
    document.getElementById('prof-name').value = name;
    document.getElementById('prof-major').value = p.jurusan || "";
    document.getElementById('prof-title').value = p.judul || "";

    // Update Avatar
    if (p.photo) {
        document.getElementById('sidebar-avatar').src = p.photo;
        document.getElementById('settings-avatar').src = p.photo;
    }
}

function renderHome() {
    // 1. Stats Progress (Roadmap)
    const items = appData.roadmap || [];
    const doneCount = items.filter(i => i.Status === 'Selesai').length;
    const totalCount = items.length || 1;
    const percent = Math.round((doneCount / totalCount) * 100);
    document.getElementById('progress-text').innerText = `${percent}%`;
    document.getElementById('progress-bar').style.width = `${percent}%`;

    // 2. Stats Total Hours (Logs)
    let totalMinutes = 0;
    appData.logs.forEach(l => {
        let d = parseInt(l[4] || l['Durasi (Menit)']); // Cek index 4 atau key name
        if (!isNaN(d)) totalMinutes += d;
    });
    const hours = (totalMinutes / 60).toFixed(1);
    document.getElementById('total-hours').innerHTML = `${hours} <span class="text-sm font-normal text-gray-400">jam</span>`;

    // 3. Heatmap (Labels + Grid)
    const hmContainer = document.getElementById('heatmap-container');
    const monthContainer = document.getElementById('heatmap-months');
    hmContainer.innerHTML = '';
    monthContainer.innerHTML = '';
    
    const weeksToShow = 20;
    let currentMonthLabel = "";
    
    for (let w = 0; w < weeksToShow; w++) {
        const col = document.createElement('div');
        col.className = 'grid grid-rows-7 gap-1';
        
        // Cek tanggal hari pertama di kolom minggu ini untuk label bulan
        const weekDate = new Date();
        weekDate.setDate(weekDate.getDate() - ((weeksToShow - 1 - w) * 7));
        const mLabel = weekDate.toLocaleString('default', { month: 'short' });
        
        if (mLabel !== currentMonthLabel) {
            currentMonthLabel = mLabel;
            const labelEl = document.createElement('div');
            labelEl.innerText = mLabel;
            labelEl.style.width = '20px'; // Approx width of a column
            monthContainer.appendChild(labelEl);
        } else {
             // Spacer
             const spacer = document.createElement('div');
             spacer.style.width = '16px'; // Grid gap + item size
             monthContainer.appendChild(spacer);
        }

        for (let d = 0; d < 7; d++) {
            const date = new Date();
            // Hitung mundur: Hari ini - (Minggu ke belakang * 7 + Hari ke belakang)
            date.setDate(date.getDate() - ((weeksToShow - 1 - w) * 7 + (6 - d)));
            const dateStr = date.toISOString().split('T')[0];
            const stat = appData.heatmap[dateStr];
            
            let color = 'bg-gray-200 dark:bg-gray-800';
            let title = `${dateStr}: Tidak ada aktivitas`;
            
            if (stat) {
                // Stat bisa object {count, minutes} atau number
                const count = stat.count || stat || 0;
                const mins = stat.minutes || 0;
                title = `${dateStr}: ${count} task, ${mins} menit`;
                
                if (count >= 1) color = 'bg-green-200';
                if (count >= 3) color = 'bg-green-400';
                if (count >= 5) color = 'bg-green-600';
            }
            
            const box = document.createElement('div');
            box.className = `w-3 h-3 rounded-sm ${color}`;
            box.title = title;
            col.appendChild(box);
        }
        hmContainer.appendChild(col);
    }

    // 4. Recent Logs
    const tbody = document.getElementById('recent-logs-body');
    tbody.innerHTML = '';
    appData.logs.slice(-5).reverse().forEach(log => {
        // Handle array format vs object format safely
        const date = log.Tanggal || log[1];
        const act = log.Aktivitas || log[6] || log.Task;
        const dur = log['Durasi (Menit)'] || log[4];
        
        tbody.innerHTML += `
            <tr>
                <td class="px-4 py-3 text-xs text-gray-500">${date}</td>
                <td class="px-4 py-3 font-medium">${act}</td>
                <td class="px-4 py-3 text-right font-mono text-xs">${dur} m</td>
            </tr>`;
    });
}

function renderRoadmap() {
    const container = document.getElementById('roadmap-container');
    container.innerHTML = '';

    if (!appData.roadmap || appData.roadmap.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-400">Belum ada data roadmap.</div>';
        return;
    }

    // Grouping logic
    const grouped = {};
    appData.roadmap.forEach(item => {
        // Fallback keys if JSON casing differs
        const bab = item.Bab || item['Bab'] || 'Lainnya';
        if (!grouped[bab]) grouped[bab] = [];
        grouped[bab].push(item);
    });

    Object.keys(grouped).forEach(bab => {
        const items = grouped[bab];
        const isDone = items.every(i => i.Status === 'Selesai');
        const badgeColor = isDone ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
        
        let subItemsHtml = '';
        items.forEach(sub => {
            const subName = sub['Sub-Bab'] || sub['Item'] || 'Detail';
            const status = sub.Status || 'Belum Mulai';
            const link = sub['Link File'];
            
            const icon = status === 'Selesai' ? '✅' : '⬜';
            const linkHtml = link ? `<a href="${link}" target="_blank" class="text-xs text-blue-500 hover:underline">File ↗</a>` : '';

            subItemsHtml += `
                <div class="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 text-sm">
                    <span class="truncate pr-2">${icon} ${subName}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-gray-400">${status}</span>
                        ${linkHtml}
                    </div>
                </div>`;
        });

        container.innerHTML += `
            <div class="bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg overflow-hidden">
                <div class="flex justify-between items-center p-4 bg-gray-50 dark:bg-[#252525]">
                    <h3 class="font-bold text-md">📂 ${bab}</h3>
                    <span class="text-xs px-2 py-1 rounded ${badgeColor}">${isDone ? 'Selesai' : 'On-going'}</span>
                </div>
                <div class="px-4 pb-2">${subItemsHtml}</div>
            </div>`;
    });
}

function renderTasks() {
    const container = document.getElementById('task-list-container');
    container.innerHTML = '';
    
    appData.tasks.filter(t => t.Status !== 'Done').forEach(task => {
        const deadlineInfo = task['Jam Deadline'] ? `${task.Deadline} @ ${task['Jam Deadline']}` : task.Deadline;
        
        container.innerHTML += `
            <div class="bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg p-3 flex items-center gap-3 shadow-sm">
                <input type="checkbox" class="w-5 h-5 cursor-pointer accent-black" 
                       onclick="window.openCompleteModal('${task.ID}', '${task.Task}', '${task.Kategori}')">
                <div class="flex-1">
                    <div class="font-medium text-sm">${task.Task}</div>
                    <div class="flex gap-2 mt-1">
                         <span class="text-[10px] bg-gray-100 dark:bg-gray-700 px-1 rounded">📅 ${deadlineInfo}</span>
                         <span class="text-[10px] bg-blue-50 text-blue-600 px-1 rounded">${task.Kategori}</span>
                    </div>
                </div>
            </div>`;
    });
}

function renderCalendar(month, year) {
    const grid = document.getElementById('calendar-grid');
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    document.getElementById('cal-month-name').innerText = `${monthNames[month]} ${year}`;
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Map Events & Tasks
    const map = {};
    const addToMap = (date, item) => {
        if(!map[date]) map[date] = [];
        map[date].push(item);
    };

    appData.events.forEach(e => addToMap(e.Tanggal, { title: e.Nama_Event, type: 'Event', color: 'blue', time: 'Full Day' }));
    appData.tasks.filter(t => t.Status !== 'Done').forEach(t => addToMap(t.Deadline, { title: t.Task, type: 'Task', color: 'red', time: t['Jam Deadline'] || '23:59' }));

    // Blank slots
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="h-10 md:h-14"></div>`;

    // Date slots
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const items = map[dateStr] || [];
        const dots = items.map(i => `<div class="w-1.5 h-1.5 rounded-full bg-${i.color}-500"></div>`).join('');
        
        // Element HTML
        const el = document.createElement('div');
        el.className = "h-10 md:h-14 p-1 flex flex-col items-center rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border border-transparent hover:border-gray-200";
        el.innerHTML = `<span class="text-sm font-medium">${d}</span><div class="flex gap-0.5 mt-1">${dots}</div>`;
        
        // Modal Click
        el.onclick = () => {
            const modalBody = document.getElementById('modal-day-content');
            document.getElementById('modal-day-title').innerText = `Agenda ${dateStr}`;
            modalBody.innerHTML = '';
            
            if(items.length === 0) modalBody.innerHTML = '<p class="text-gray-400 text-center">Kosong</p>';
            
            items.forEach(i => {
                modalBody.innerHTML += `
                    <div class="p-2 border rounded border-${i.color}-200 bg-${i.color}-50 dark:bg-opacity-10">
                        <p class="font-bold text-sm">${i.title}</p>
                        <p class="text-xs text-gray-500">${i.type} • ${i.time}</p>
                    </div>`;
            });
            document.getElementById('modal-day-detail').classList.remove('hidden');
        };
        grid.appendChild(el);
    }
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

/* ================= ACTIONS ================= */

// Define globally
window.changeMonth = (dir) => {
    calendarState.month += dir;
    if(calendarState.month > 11) { calendarState.month = 0; calendarState.year++; }
    if(calendarState.month < 0) { calendarState.month = 11; calendarState.year--; }
    renderCalendar(calendarState.month, calendarState.year);
};

window.addTask = async () => {
    const name = document.getElementById('inp-task-name').value;
    const date = document.getElementById('inp-task-date').value;
    const time = document.getElementById('inp-task-time').value;
    const cat = document.getElementById('inp-task-cat').value;

    if(!name || !date) return showModalInfo("Isi nama dan tanggal!");
    
    // UI Feedback Immediate
    document.getElementById('inp-task-name').value = ''; 
    
    await fetch(API_URL, {
        method: 'POST', 
        body: JSON.stringify({ action: 'addTask', task: name, deadline: date, time: time, category: cat })
    });
    loadData();
};

window.openCompleteModal = (id, name, cat) => {
    currentCompletingTask = { id, name, cat };
    document.getElementById('modal-task-name').innerText = name;
    
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    document.getElementById('modal-start-time').value = `${hh}:${mm}`;
    
    // Default 1 jam pengerjaan
    now.setHours(now.getHours() + 1);
    const hh2 = String(now.getHours()).padStart(2,'0');
    const mm2 = String(now.getMinutes()).padStart(2,'0');
    document.getElementById('modal-end-time').value = `${hh2}:${mm2}`;
    
    document.getElementById('modal-complete').classList.remove('hidden');
};

window.submitCompletion = async () => {
    const start = document.getElementById('modal-start-time').value;
    const end = document.getElementById('modal-end-time').value;
    
    document.getElementById('modal-complete').classList.add('hidden');
    
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'completeTask',
            taskId: currentCompletingTask.id,
            taskName: currentCompletingTask.name,
            category: currentCompletingTask.cat,
            date: new Date().toISOString().split('T')[0],
            startTime: start,
            endTime: end
        })
    });
    loadData();
};

window.openHistoryModal = () => {
    const tbody = document.getElementById('full-history-body');
    tbody.innerHTML = '';
    
    // Sort log terbaru di atas
    const logs = appData.logs.slice().sort((a,b) => new Date(b.Tanggal) - new Date(a.Tanggal));
    
    logs.forEach(log => {
        const start = log['Jam Mulai'] || log[2] || '-';
        const end = log['Jam Selesai'] || log[3] || '-';
        const dur = log['Durasi (Menit)'] || log[4] || 0;
        const act = log.Aktivitas || log[6];
        const date = log.Tanggal || log[1];

        tbody.innerHTML += `
            <tr>
                <td class="p-3 text-gray-500">${date}</td>
                <td class="p-3"><div>${act}</div><div class="text-xs text-gray-400">${log.Kategori || log[5]}</div></td>
                <td class="p-3 font-mono text-xs">${start} - ${end}</td>
                <td class="p-3 text-right font-bold">${dur} m</td>
            </tr>`;
    });
    document.getElementById('modal-history').classList.remove('hidden');
};

/* ================= UPLOAD LOGIC ================= */

// Helper: File to Base64
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

// EXPOSED GLOBAL FUNCTION FOR HTML ONCHANGE
window.handleFileUpload = async (files) => {
    if(files.length === 0) return;
    const file = files[0];
    
    showModalInfo("Sedang mengupload...");
    try {
        const b64 = await toBase64(file);
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'uploadFile', fileName: file.name, mimeType: file.type, fileData: b64 })
        });
        const data = await res.json();
        
        document.getElementById('modal-info').classList.add('hidden'); // Close loading
        if(data.status === 'success') {
            showModalInfo("File berhasil diupload!");
            loadData();
        } else {
            showModalInfo("Gagal: " + data.message);
        }
    } catch(e) {
        showModalInfo("Error Upload");
    }
};

window.uploadProfilePhoto = async (files) => {
    if(files.length === 0) return;
    const file = files[0];
    
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('settings-avatar').src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Prepare for save
    window.pendingPhotoData = await toBase64(file);
};

window.saveProfile = async () => {
    const name = document.getElementById('prof-name').value;
    const major = document.getElementById('prof-major').value;
    const title = document.getElementById('prof-title').value;
    
    showModalInfo("Menyimpan Profil...");
    
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateProfile',
            name: name, jurusan: major, judul: title,
            photoData: window.pendingPhotoData || null
        })
    });
    
    document.getElementById('modal-info').classList.add('hidden');
    window.pendingPhotoData = null;
    loadData(); // Refresh UI with new name/photo
};

window.showModalInfo = (msg) => {
    document.getElementById('modal-info-msg').innerText = msg;
    document.getElementById('modal-info').classList.remove('hidden');
};
