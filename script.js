/* CONFIG */
const API_URL = "https://script.google.com/macros/s/AKfycbxjPFCfjgfkGCZHCIJ6RKoNHQ7g9BdysfBdTKs42iyJikjv6BPr_z4UOVA3SMug4hCE/exec"; 

/* STATE */
let appData = { roadmap: [], tasks: [], logs: [], events: [], files: [], heatmap: {}, profile: {} };
let calendarState = { month: new Date().getMonth(), year: new Date().getFullYear() };
let currentCompletingTask = null;
let currentRoadmapItem = null;
let pendingPhotoData = null;

/* INIT */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('inp-task-date').valueAsDate = new Date();
    loadData();
});
//
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

/* --- RENDERERS --- */

function renderProfile() {
    const p = appData.profile || {};
    const name = p.name || "Mahasiswa";
    
    // Sidebar & Settings
    document.getElementById('sidebar-name').innerText = name;
    document.getElementById('sidebar-major').innerText = p.jurusan || "Universitas Indonesia";
    document.getElementById('home-name').innerText = name.split(' ')[0];
    document.getElementById('home-title').innerText = p.judul || "Judul Tesis...";
    
    // Mobile Header
    document.getElementById('header-subtitle').innerText = name + " | " + (p.judul || "Tesis");

    // Inputs
    document.getElementById('prof-name').value = name;
    document.getElementById('prof-major').value = p.jurusan || "";
    document.getElementById('prof-title').value = p.judul || "";

    // Photo
    const url = p.photo || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    document.getElementById('sidebar-avatar').src = url;
    document.getElementById('settings-avatar').src = url;
}

function formatDuration(minutes) {
    const m = parseInt(minutes) || 0;
    if (m === 0) return '-';
    
    const h = Math.floor(m / 60);
    const min = m % 60;
    
    if (h > 0) {
        return `${h}h${min > 0 ? ' ' + min + 'm' : ''}`;
    }
    return `${min}m`;
}

function renderHome() {
    // 1. Progress from Roadmap Checklist
    const items = appData.roadmap || [];
    const done = items.filter(i => i.Status === 'Selesai' || i.Status === true).length;
    const total = items.length || 1;
    const pct = Math.round((done/total)*100);
    document.getElementById('progress-text').innerText = `${pct}%`;
    document.getElementById('progress-bar').style.width = `${pct}%`;

    // 2. Total Hours
    let totalMinutes = 0;
    appData.logs.forEach(l => {
        let d = parseInt(l[4] || l['Durasi (Menit)']); 
        if (!isNaN(d)) totalMinutes += d;
    });
    const hours = (totalMinutes / 60).toFixed(1);
    document.getElementById('total-hours').innerHTML = `${hours} <span class="text-sm font-normal text-gray-400">jam</span>`;

    // 3. Heatmap (GitHub Style: 7 Rows x 20 Cols)
    const container = document.getElementById('heatmap-container');
    const monthContainer = document.getElementById('heatmap-months');
    container.innerHTML = '';
    monthContainer.innerHTML = '';

    const weeks = 20;
    const today = new Date();
    // Cari hari Minggu terdekat di masa lalu dari (weeks) minggu lalu
    const startDate = new Date();
    startDate.setDate(today.getDate() - (weeks * 7) - today.getDay()); 

    let lastMonth = "";

    // Render 20 Kolom (Minggu)
    for(let w=0; w<weeks; w++) {
        const col = document.createElement('div');
        col.className = 'grid grid-rows-7 gap-1';
        
        // Cek tanggal hari pertama minggu ini untuk label bulan
        const weekDate = new Date(startDate);
        weekDate.setDate(startDate.getDate() + (w * 7));
        const mLabel = weekDate.toLocaleString('default', {month:'short'});
        
        if (mLabel !== lastMonth) {
            lastMonth = mLabel;
            const lbl = document.createElement('div');
            lbl.innerText = mLabel;
            lbl.style.width = '16px'; // Lebar per kolom
            monthContainer.appendChild(lbl);
        } else {
             const spc = document.createElement('div');
             spc.style.width = '16px'; 
             monthContainer.appendChild(spc); 
        }

        // Render 7 Hari (Senin-Minggu)
        for(let d=0; d<7; d++) {
            const currentDay = new Date(weekDate);
            currentDay.setDate(weekDate.getDate() + d);
            
            // Skip jika lewat hari ini
            if (currentDay > today) {
                 const empty = document.createElement('div');
                 empty.className = 'w-3 h-3';
                 col.appendChild(empty);
                 continue;
            }

            const dateStr = currentDay.toISOString().split('T')[0];
            const stat = appData.heatmap[dateStr];
            let color = 'bg-gray-100 dark:bg-gray-800';
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
        container.appendChild(col);
    }

    // 4. Recent Logs
    const tbody = document.getElementById('recent-logs-body');
    if(tbody) {
        tbody.innerHTML = '';
        const recentLogs = appData.logs.slice(-5).reverse(); 
        
        if (recentLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-xs text-gray-400">Belum ada aktivitas.</td></tr>';
        }

        recentLogs.forEach(log => {
            const date = log['Tanggal'] || '-';
            const act = log['Aktivitas'] || '-';
            const durRaw = log['Durasi (Menit)'] || 0;
            const durFormatted = formatDuration(durRaw); // Pakai Helper Baru
            const cat = log['Kategori'] || '';

            tbody.innerHTML += `
                <tr>
                    <td class="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">${date}</td>
                    <td class="px-4 py-3">
                        <div class="font-medium text-sm truncate max-w-[150px]">${act}</div>
                        <div class="text-[10px] text-gray-400">${cat}</div>
                    </td>
                    <td class="px-4 py-3 text-right font-mono text-xs">${durFormatted}</td>
                </tr>`;
        });
    }
}

function renderRoadmap() {
    const container = document.getElementById('roadmap-container');
    container.innerHTML = '';
    if(!appData.roadmap.length) { container.innerHTML = '<div class="text-center py-10 text-gray-400">Roadmap Kosong.</div>'; return; }

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
            const subName = sub['Sub-Bab'] || 'Item';
            const status = sub.Status;
            const link = sub['Link File'];
            
            // Interactive Checkbox
            const checkIcon = status === 'Selesai' ? '✅' : '⬜';
            const nextStatus = status === 'Selesai' ? 'Belum Mulai' : 'Selesai';
            
            // Interactive Link
            const linkColor = link ? 'text-blue-500' : 'text-gray-300';
            const linkLabel = link ? 'Link ↗' : 'Add Link +';

            subHtml += `
                <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800 text-sm last:border-0">
                    <div class="flex items-center gap-3 cursor-pointer hover:opacity-70 truncate pr-2" onclick="toggleRoadmapStatus('${bab}', '${subName}', '${nextStatus}')">
                        <span class="text-lg">${checkIcon}</span>
                        <span>${subName}</span>
                    </div>
                    <div class="flex items-center gap-2">
                         ${link ? `<a href="${link}" target="_blank" class="p-1 rounded bg-blue-50 text-blue-600 text-xs">Buka</a>` : ''}
                         <button onclick="openLinkModal('${bab}', '${subName}')" class="text-xs ${linkColor} hover:text-black">🔗</button>
                    </div>
                </div>`;
        });

        container.innerHTML += `
            <div class="bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg overflow-hidden">
                <details open class="group">
                    <summary class="flex justify-between items-center p-4 bg-gray-50 dark:bg-[#252525] cursor-pointer list-none">
                        <h3 class="font-bold text-md">📂 ${bab}</h3>
                        <span class="text-xs px-2 py-1 rounded ${isDone ? 'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}">${isDone?'Selesai':'Proses'}</span>
                    </summary>
                    <div class="px-4 pb-2">${subHtml}</div>
                </details>
            </div>`;
    });
}

function renderTasks() {
    const list = document.getElementById('task-list-container');
    list.innerHTML = '';
    appData.tasks.filter(t=>t.Status!=='Done').forEach(t => {
        list.innerHTML += `
            <div class="bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg p-3 flex items-center gap-3 shadow-sm hover:border-gray-400 transition">
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

function renderCalendar(month, year) {
    const grid = document.getElementById('calendar-grid');
    const agendaList = document.getElementById('calendar-agenda-list');
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    document.getElementById('cal-month-name').innerText = `${months[month]} ${year}`;
    grid.innerHTML = '';
    agendaList.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Map Events & Tasks
    const map = {};
    const addToMap = (d, i) => { if(!map[d]) map[d]=[]; map[d].push(i); };
    
    appData.events.forEach(e => addToMap(e.Tanggal, {title:e.Nama_Event, type:'Event', color:'blue', time: e.Jam || 'Full Day'}));
    appData.tasks.filter(t=>t.Status!=='Done').forEach(t => addToMap(t.Deadline, {title:t.Task, type:'Deadline', color:'red', time: t['Jam Deadline']||'23:59'}));

    // Blanks
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="h-10 md:h-14"></div>`;

    let monthHasAgenda = false;

    // Dates
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const items = map[dateStr] || [];
        const dots = items.map(i=>`<div class="w-1.5 h-1.5 rounded-full bg-${i.color}-500"></div>`).join('');
        
        // Grid Item
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

        // Populate List Below
        if(items.length > 0) {
            monthHasAgenda = true;
            items.forEach(item => {
                const colorClass = item.color === 'blue' ? 'text-blue-600 bg-blue-50' : 'text-red-600 bg-red-50';
                agendaList.innerHTML += `
                    <div class="flex gap-3 items-center p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div class="w-10 text-center rounded p-1 ${colorClass}">
                            <div class="text-xs uppercase font-bold opacity-70">${months[month].substring(0,3)}</div>
                            <div class="text-lg font-bold leading-none">${d}</div>
                        </div>
                        <div>
                            <p class="font-medium text-sm">${item.title}</p>
                            <p class="text-xs text-gray-500">${item.type} • ${item.time}</p>
                        </div>
                    </div>`;
            });
        }
    }
    
    if(!monthHasAgenda) agendaList.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Tidak ada agenda bulan ini.</p>';
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

window.toggleRoadmapStatus = async (bab, sub, val) => {
    // Optimistic Update
    const item = appData.roadmap.find(r => r.Bab == bab && (r['Sub-Bab'] == sub || r.Item == sub));
    if(item) item.Status = val;
    renderRoadmap();
    renderHome(); // Update progress
    
    await fetch(API_URL, {method:'POST', body:JSON.stringify({
        action:'updateRoadmap', type:'status', bab:bab, subBab:sub, value:val
    })});
    loadData(); // Re-sync
};

window.openLinkModal = (bab, sub) => {
    currentRoadmapItem = { bab, sub };
    document.getElementById('modal-link-input').classList.remove('hidden');
};

window.saveRoadmapLink = async () => {
    const val = document.getElementById('inp-roadmap-link').value;
    if(!val) return;
    document.getElementById('modal-link-input').classList.add('hidden');
    document.getElementById('inp-roadmap-link').value = '';
    
    await fetch(API_URL, {method:'POST', body:JSON.stringify({
        action:'updateRoadmap', type:'link', bab:currentRoadmapItem.bab, subBab:currentRoadmapItem.sub, value:val
    })});
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
    const container = document.getElementById('full-history-body'); // Ini sekarang kita ganti jadi Div container, bukan Tbody
    if(!container) return;
    
    // KITA BUTUH UBAH STRUKTUR HTML DI INDEX HTML SEDIKIT
    // Tapi untuk script ini, kita akan inject HTML accordion ke dalam container tersebut.
    
    container.innerHTML = ''; // Reset
    
    // 1. Sort Data (Terbaru di atas)
    const logs = appData.logs.slice().sort((a,b) => new Date(b.Tanggal) - new Date(a.Tanggal));
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="p-10 text-center text-gray-400">Belum ada riwayat pengerjaan.</div>';
        document.getElementById('modal-history').classList.remove('hidden');
        return;
    }

    // 2. Grouping Logic (Bulan & Pekan)
    const groups = {};
    
    logs.forEach(log => {
        const dateStr = log['Tanggal'];
        if(!dateStr) return;

        const dateParts = dateStr.split('-'); // YYYY-MM-DD
        const dateObj = new Date(dateParts[0], dateParts[1]-1, dateParts[2]);
        
        // Nama Bulan & Tahun (e.g. Februari 2026)
        const monthYear = dateObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        
        // Hitung Pekan ke-berapa (Simple calculation: Tanggal bagi 7)
        const weekNum = Math.ceil(dateObj.getDate() / 7);
        
        const groupKey = `${monthYear} - Pekan ${weekNum}`;
        
        if(!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(log);
    });

    // 3. Render Accordion
    Object.keys(groups).forEach((key, index) => {
        const items = groups[key];
        const isOpen = index === 0 ? 'open' : ''; // Hanya pekan terbaru yang terbuka otomatis
        
        // Hitung total jam pekan ini (Opsional, untuk info di header accordion)
        let weekMinutes = 0;
        items.forEach(i => weekMinutes += parseInt(i['Durasi (Menit)']||0));
        const weekDuration = formatDuration(weekMinutes);

        // Generate Rows HTML
        let rowsHtml = '';
        items.forEach(log => {
            const start = log['Jam Mulai'] || '-';
            const end = log['Jam Selesai'] || '-';
            const timeRange = (start !== '-' && end !== '-') ? `${start} - ${end}` : '-';
            const dur = formatDuration(log['Durasi (Menit)'] || 0);

            rowsHtml += `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-[#2C2C2C] transition">
                    <div class="flex-1 mb-2 sm:mb-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">${log['Tanggal']}</span>
                            <span class="text-[10px] uppercase tracking-wider font-bold text-blue-500">${log['Kategori']}</span>
                        </div>
                        <div class="font-medium text-sm text-gray-800 dark:text-gray-200">${log['Aktivitas']}</div>
                    </div>
                    <div class="text-right flex items-center justify-end gap-4 text-xs">
                        <div class="font-mono text-gray-400">${timeRange}</div>
                        <div class="font-bold min-w-[60px] text-right bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded">${dur}</div>
                    </div>
                </div>
            `;
        });

        // Accordion HTML
        const accordionHtml = `
            <div class="mb-4 border border-notion-border dark:border-notion-darkBorder rounded-lg overflow-hidden bg-white dark:bg-[#202020]">
                <details ${isOpen} class="group">
                    <summary class="flex items-center justify-between p-4 cursor-pointer bg-gray-50 dark:bg-[#252525] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition list-none">
                        <div class="flex items-center gap-2 font-bold text-gray-700 dark:text-gray-300">
                            <span class="transform group-open:rotate-90 transition-transform">▶</span>
                            ${key}
                        </div>
                        <div class="text-xs font-mono text-gray-500 bg-white dark:bg-black px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                            Total: ${weekDuration}
                        </div>
                    </summary>
                    <div class="divide-y divide-gray-100 dark:divide-gray-800">
                        ${rowsHtml}
                    </div>
                </details>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', accordionHtml);
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
