/* CONFIG */
const API_URL = "https://script.google.com/macros/s/AKfycbxjPFCfjgfkGCZHCIJ6RKoNHQ7g9BdysfBdTKs42iyJikjv6BPr_z4UOVA3SMug4hCE/exec"; 

/* STATE */
let appData = { roadmap: [], tasks: [], logs: [], events: [], files: [], heatmap: {}, profile: {} };
let calendarState = { month: new Date().getMonth(), year: new Date().getFullYear() };
let currentCompletingTask = null;
let pendingPhotoData = null;

/* INIT */
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
            showModalInfo("Error: " + data.message);
        }
    } catch (e) { console.error(e); }
}

function renderAll() {
    renderProfile();
    renderHome();
    renderRoadmap();
    renderTasks();
    renderCalendar(calendarState.month, calendarState.year);
    renderFiles();
}

/* RENDERERS */

function renderProfile() {
    const p = appData.profile || {};
    const name = p.name || "Mahasiswa";
    
    // Header & Home
    document.getElementById('sidebar-name').innerText = name;
    document.getElementById('sidebar-major').innerText = p.jurusan || "Universitas Indonesia";
    document.getElementById('home-greeting').innerText = `Semangat ${name.split(' ')[0]}! 🎓`;
    document.getElementById('home-title').innerText = p.judul || "Judul Tesis...";
    
    // Form
    document.getElementById('prof-name').value = name;
    document.getElementById('prof-major').value = p.jurusan || "";
    document.getElementById('prof-title').value = p.judul || "";

    // Avatar
    const url = p.photo || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    document.getElementById('sidebar-avatar').src = url;
    document.getElementById('settings-avatar').src = url;
}

function renderHome() {
    // 1. Progress (Roadmap)
    const items = appData.roadmap || [];
    const done = items.filter(i => i.Status === 'Selesai').length;
    const total = items.length || 1;
    const pct = Math.round((done/total)*100);
    document.getElementById('progress-text').innerText = `${pct}%`;
    document.getElementById('progress-bar').style.width = `${pct}%`;

    // 2. Heatmap
    const hmContainer = document.getElementById('heatmap-container');
    const labelContainer = document.getElementById('heatmap-months');
    hmContainer.innerHTML = ''; 
    labelContainer.innerHTML = '';

    const weeks = 20;
    let lastLabel = "";
    
    for(let w=0; w<weeks; w++) {
        const col = document.createElement('div');
        col.className = 'grid grid-rows-7 gap-1';
        
        // Month Label Logic
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - ((weeks-1-w)*7));
        const mLabel = checkDate.toLocaleString('default', {month:'short'});
        if(mLabel !== lastLabel) {
            lastLabel = mLabel;
            const lbl = document.createElement('div');
            lbl.innerText = mLabel;
            lbl.style.minWidth = '20px';
            labelContainer.appendChild(lbl);
        } else {
             const spc = document.createElement('div');
             spc.style.minWidth = '16px'; 
             labelContainer.appendChild(spc); // Spacer
        }

        for(let d=0; d<7; d++) {
            const date = new Date();
            date.setDate(date.getDate() - ((weeks-1-w)*7 + (6-d)));
            const dateStr = date.toISOString().split('T')[0];
            const stat = appData.heatmap[dateStr];
            let color = 'bg-gray-200 dark:bg-gray-800';
            let title = `${dateStr}: 0`;
            
            if(stat) {
                const count = stat.count || 0;
                title = `${dateStr}: ${count} task, ${stat.minutes}m`;
                if(count>=1) color = 'bg-green-200';
                if(count>=3) color = 'bg-green-400';
                if(count>=5) color = 'bg-green-600';
            }
            
            const box = document.createElement('div');
            box.className = `w-3 h-3 rounded-sm ${color}`;
            box.title = title;
            col.appendChild(box);
        }
        hmContainer.appendChild(col);
    }
    
    // 3. Recent Logs
    const tbody = document.getElementById('recent-logs-body');
    tbody.innerHTML = '';
    appData.logs.slice(-5).reverse().forEach(log => {
        tbody.innerHTML += `<tr><td class="px-4 py-3 text-gray-500 text-xs">${log.Tanggal}</td><td class="px-4 py-3 text-sm font-medium">${log.Aktivitas}</td><td class="px-4 py-3 text-right font-mono text-xs">${log[4]||log['Durasi (Menit)']} m</td></tr>`;
    });
}

function renderRoadmap() {
    const container = document.getElementById('roadmap-container');
    container.innerHTML = '';
    if(!appData.roadmap.length) { container.innerHTML = '<div class="text-center py-10 text-gray-400">Data Roadmap Kosong / Salah Header.</div>'; return; }

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
            const icon = sub.Status === 'Selesai' ? '✅' : '⬜';
            const fileLink = sub['Link File'] ? `<a href="${sub['Link File']}" target="_blank" class="text-blue-500 text-xs">File ↗</a>` : '';
            subHtml += `<div class="flex justify-between py-2 border-b border-gray-50 dark:border-gray-800 text-sm"><span class="truncate pr-2">${icon} ${sub['Sub-Bab']}</span>${fileLink}</div>`;
        });

        container.innerHTML += `
            <div class="bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg p-4">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="font-bold text-md">📂 ${bab}</h3>
                    <span class="text-xs px-2 py-1 rounded ${isDone ? 'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}">${isDone?'Selesai':'Proses'}</span>
                </div>
                <div>${subHtml}</div>
            </div>`;
    });
}

function renderCalendar(month, year) {
    const grid = document.getElementById('calendar-grid');
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    document.getElementById('cal-month-name').innerText = `${months[month]} ${year}`;
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Map items
    const map = {};
    const addToMap = (d, i) => { if(!map[d]) map[d]=[]; map[d].push(i); };
    
    appData.events.forEach(e => addToMap(e.Tanggal, {title:e.Nama_Event, type:'Event', color:'blue', time:'Full Day'}));
    appData.tasks.filter(t=>t.Status!=='Done').forEach(t => addToMap(t.Deadline, {title:t.Task, type:'Task', color:'red', time: t['Jam Deadline']||'23:59'}));

    // Blanks
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="h-10 md:h-14"></div>`;

    // Dates
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const items = map[dateStr] || [];
        const dots = items.map(i=>`<div class="w-1.5 h-1.5 rounded-full bg-${i.color}-500"></div>`).join('');
        
        // Element
        const div = document.createElement('div');
        div.className = "h-10 md:h-14 p-1 flex flex-col items-center rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border border-transparent hover:border-gray-200";
        div.innerHTML = `<span class="text-sm font-medium">${d}</span><div class="flex gap-0.5 mt-1">${dots}</div>`;
        div.onclick = () => {
             const content = document.getElementById('modal-day-content');
             document.getElementById('modal-day-title').innerText = `Agenda ${dateStr}`;
             content.innerHTML = items.length ? '' : '<p class="text-gray-400 text-center text-sm">Kosong</p>';
             items.forEach(i => {
                 content.innerHTML += `
                    <div class="p-2 border rounded border-${i.color}-200 bg-${i.color}-50 dark:bg-opacity-10 mb-2">
                        <p class="font-bold text-sm text-${i.color}-700">${i.title}</p>
                        <p class="text-xs text-gray-500">${i.type} • ${i.time}</p>
                    </div>`;
             });
             document.getElementById('modal-day-detail').classList.remove('hidden');
        };
        grid.appendChild(div);
    }
}

function renderTasks() {
    const list = document.getElementById('task-list-container');
    list.innerHTML = '';
    appData.tasks.filter(t=>t.Status!=='Done').forEach(t => {
        list.innerHTML += `
            <div class="bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg p-3 flex items-center gap-3 shadow-sm">
                <input type="checkbox" class="w-5 h-5 cursor-pointer accent-black" onclick="window.openCompleteModal('${t.ID}','${t.Task}','${t.Kategori}')">
                <div class="flex-1">
                    <div class="font-medium text-sm">${t.Task}</div>
                    <div class="flex gap-2 mt-1">
                        <span class="text-[10px] bg-gray-100 dark:bg-gray-700 px-1 rounded">📅 ${t.Deadline} ${t['Jam Deadline']||''}</span>
                        <span class="text-[10px] bg-blue-50 text-blue-600 px-1 rounded">${t.Kategori}</span>
                    </div>
                </div>
            </div>`;
    });
}

/* ACTIONS */
window.changeMonth = (dir) => {
    calendarState.month += dir;
    if(calendarState.month>11){calendarState.month=0; calendarState.year++}
    if(calendarState.month<0){calendarState.month=11; calendarState.year--}
    renderCalendar(calendarState.month, calendarState.year);
};

window.addTask = async () => {
    const name = document.getElementById('inp-task-name').value;
    const date = document.getElementById('inp-task-date').value;
    const time = document.getElementById('inp-task-time').value;
    const cat = document.getElementById('inp-task-cat').value;
    if(!name || !date) return showModalInfo("Nama & Tanggal wajib!");
    
    document.getElementById('inp-task-name').value = '';
    await fetch(API_URL, {method:'POST', body:JSON.stringify({action:'addTask', task:name, deadline:date, time:time, category:cat})});
    loadData();
};

window.openCompleteModal = (id, name, cat) => {
    currentCompletingTask = {id, name, cat};
    document.getElementById('modal-task-name').innerText = name;
    
    const now = new Date();
    document.getElementById('modal-start-time').value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    now.setHours(now.getHours()+1);
    document.getElementById('modal-end-time').value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    document.getElementById('modal-complete').classList.remove('hidden');
};

window.submitCompletion = async () => {
    const start = document.getElementById('modal-start-time').value;
    const end = document.getElementById('modal-end-time').value;
    document.getElementById('modal-complete').classList.add('hidden');
    await fetch(API_URL, {method:'POST', body:JSON.stringify({
        action:'completeTask', taskId:currentCompletingTask.id, taskName:currentCompletingTask.name, category:currentCompletingTask.cat,
        date: new Date().toISOString().split('T')[0], startTime:start, endTime:end
    })});
    loadData();
};

window.openHistoryModal = () => {
    const tbody = document.getElementById('full-history-body');
    tbody.innerHTML = '';
    appData.logs.slice().reverse().forEach(log => {
        tbody.innerHTML += `<tr><td class="p-3 text-gray-500">${log.Tanggal}</td><td class="p-3"><div>${log.Aktivitas}</div><div class="text-xs text-gray-400">${log.Kategori}</div></td><td class="p-3 font-mono text-xs">${log['Jam Mulai']}-${log['Jam Selesai']}</td><td class="p-3 text-right font-bold">${log[4]} m</td></tr>`;
    });
    document.getElementById('modal-history').classList.remove('hidden');
};

/* FILE UPLOAD */
const toBase64 = file => new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

window.handleFileUpload = async (files) => {
    if(!files.length) return;
    showModalInfo("Uploading...");
    try {
        const b64 = await toBase64(files[0]);
        const res = await fetch(API_URL, {method:'POST', body:JSON.stringify({action:'uploadFile', fileName:files[0].name, mimeType:files[0].type, fileData:b64})});
        const data = await res.json();
        document.getElementById('modal-info').classList.add('hidden');
        if(data.status==='success') { showModalInfo("Upload Berhasil!"); loadData(); }
        else showModalInfo("Gagal: " + data.message);
    } catch(e){ showModalInfo("Error Upload"); }
};

window.uploadProfilePhoto = async (files) => {
    if(!files.length) return;
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('settings-avatar').src = e.target.result; };
    reader.readAsDataURL(files[0]);
    window.pendingPhotoData = await toBase64(files[0]);
};

window.saveProfile = async () => {
    const name = document.getElementById('prof-name').value;
    const major = document.getElementById('prof-major').value;
    const title = document.getElementById('prof-title').value;
    showModalInfo("Menyimpan...");
    await fetch(API_URL, {method:'POST', body:JSON.stringify({action:'updateProfile', name:name, jurusan:major, judul:title, photoData:window.pendingPhotoData})});
    document.getElementById('modal-info').classList.add('hidden');
    window.pendingPhotoData = null;
    loadData();
};

window.showModalInfo = (msg) => {
    document.getElementById('modal-info-msg').innerText = msg;
    document.getElementById('modal-info').classList.remove('hidden');
};
