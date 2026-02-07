/* ==================================================
   KONFIGURASI
   ================================================== */
const API_URL = "https://script.google.com/macros/s/AKfycbxjPFCfjgfkGCZHCIJ6RKoNHQ7g9BdysfBdTKs42iyJikjv6BPr_z4UOVA3SMug4hCE/exec"; // <--- JANGAN LUPA GANTI INI

/* ==================================================
   STATE MANAGEMENT
   ================================================== */
let appData = {
    roadmap: [], tasks: [], logs: [], events: [], files: [], heatmap: {}, profile: {}
};

// Variabel sementara untuk menyimpan Task ID yang sedang dikerjakan
let currentCompletingTask = { id: null, name: null, category: null };

/* ==================================================
   INIT
   ================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Set default date input ke hari ini
    const dateInput = document.getElementById('inp-task-date');
    if(dateInput) dateInput.valueAsDate = new Date();

    loadData();
});

async function loadData() {
    console.log("Fetching data...");
    try {
        const response = await fetch(`${API_URL}?action=getAllData`);
        const result = await response.json();
        if (result.status === 'success') {
            appData = result;
            renderAll();
        }
    } catch (error) {
        console.error("Error loading data", error);
        // alert("Gagal memuat data. Periksa koneksi internet.");
    }
}

function renderAll() {
    renderHome();
    renderTasks();
    renderCalendar();
    renderFiles();
    renderProfile();
    renderRoadmap();
}

/* ==================================================
   RENDER FUNCTIONS
   ================================================== */

function renderHome() {
    // 1. Heatmap
    const container = document.getElementById('heatmap-container');
    if(container) {
        container.innerHTML = '';
        for (let w = 0; w < 20; w++) {
            const weekCol = document.createElement('div');
            weekCol.className = 'grid grid-rows-7 gap-1';
            for (let d = 0; d < 7; d++) {
                const date = new Date();
                date.setDate(date.getDate() - ((19-w)*7 + (6-d)));
                const dateStr = date.toISOString().split('T')[0];
                const count = appData.heatmap[dateStr] || 0;
                
                let color = 'bg-gray-200 dark:bg-gray-800';
                if (count >= 1) color = 'bg-green-200';
                if (count >= 3) color = 'bg-green-400';
                if (count >= 5) color = 'bg-green-600';
                
                const dayBox = document.createElement('div');
                dayBox.className = `w-3 h-3 rounded-sm ${color}`;
                dayBox.title = `${dateStr}: ${count} task`;
                weekCol.appendChild(dayBox);
            }
            container.appendChild(weekCol);
        }
    }

    // 2. History
    const historyList = document.querySelector('#view-home tbody'); 
    if(historyList) {
        historyList.innerHTML = '';
        const recentLogs = appData.logs.slice(-5).reverse(); 
        recentLogs.forEach(log => {
            const html = `
                <tr>
                    <td class="px-4 py-3 text-xs text-gray-500">${log.Tanggal}</td>
                    <td class="px-4 py-3">
                        <div class="font-medium">${log.Aktivitas}</div>
                        <div class="text-xs text-gray-400">${log.Kategori}</div>
                    </td>
                    <td class="px-4 py-3 text-right font-mono text-xs">${log['Durasi (Menit)'] || log.Durasi} m</td>
                </tr>
            `;
            historyList.insertAdjacentHTML('beforeend', html);
        });
    }
}

function renderTasks() {
    const container = document.getElementById('task-list-container');
    if(!container) return;
    
    container.innerHTML = ''; // Clear old

    const activeTasks = appData.tasks.filter(t => t.Status !== 'Done');
    
    activeTasks.forEach(task => {
        let chipColor = 'bg-gray-100 text-gray-600';
        if(task.Kategori == 'Bimbingan') chipColor = 'bg-blue-100 text-blue-600';
        if(task.Kategori == 'Nulis') chipColor = 'bg-purple-100 text-purple-600';
        if(task.Kategori == 'Revisi') chipColor = 'bg-red-100 text-red-600';

        const html = `
            <div class="bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg p-3 flex items-center gap-3 shadow-sm group hover:border-gray-400 transition">
                <input type="checkbox" class="w-5 h-5 rounded border-gray-300 cursor-pointer accent-black dark:accent-white" 
                       onclick="openCompleteModal('${task.ID}', '${task.Task}', '${task.Kategori}')">
                
                <div class="flex-1">
                    <span class="text-sm font-medium block text-gray-800 dark:text-gray-200">${task.Task}</span>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                            📅 ${task.Deadline}
                        </span>
                        <span class="text-[10px] ${chipColor} px-1.5 py-0.5 rounded">${task.Kategori}</span>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });

    if(activeTasks.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 text-sm py-8">Tidak ada tugas aktif 🎉</div>';
    }
}

function renderCalendar() {
    const container = document.getElementById('calendar-list');
    if(!container) return;
    
    container.innerHTML = '';
    let allItems = [];
    
    // Events
    appData.events.forEach(e => allItems.push({date: e.Tanggal, title: e.Nama_Event, type: 'Event', color: 'blue'}));
    // Tasks
    appData.tasks.filter(t => t.Status !== 'Done').forEach(t => allItems.push({date: t.Deadline, title: t.Task, type: 'Deadline', color: 'red'}));

    allItems.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group by Month (Optional, but simple list for now)
    if(allItems.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-4">Belum ada agenda</div>';
        return;
    }

    allItems.forEach(item => {
        const dateObj = new Date(item.date);
        const dateNum = dateObj.getDate();
        const month = dateObj.toLocaleString('default', { month: 'short' });
        const colorClass = item.color === 'blue' ? 'text-blue-800 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20' : 'text-red-800 bg-red-50 dark:text-red-300 dark:bg-red-900/20';

        const html = `
            <div class="flex gap-4 items-center">
                <div class="text-center w-12 ${colorClass} rounded p-1 shrink-0">
                    <div class="text-[10px] uppercase font-bold opacity-70">${month}</div>
                    <div class="text-xl font-bold leading-none">${dateNum}</div>
                </div>
                <div class="min-w-0">
                    <p class="font-medium text-sm truncate">${item.title}</p>
                    <p class="text-xs text-gray-500">${item.type}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderFiles() {
    const container = document.getElementById('files-grid');
    if(!container) return;
    container.innerHTML = ''; 
    
    appData.files.forEach(file => {
        const html = `
            <a href="${file.url}" target="_blank" class="p-4 border border-notion-border dark:border-notion-darkBorder rounded-lg bg-white dark:bg-[#202020] block hover:shadow-md transition">
                <div class="text-3xl mb-3">📄</div>
                <p class="text-sm font-medium truncate">${file.name}</p>
                <p class="text-xs text-gray-400 mt-1">${file.size}</p>
            </a>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderRoadmap() {
    const container = document.getElementById('roadmap-container');
    if(!container) return;
    container.innerHTML = '';

    // Group by Bab
    const grouped = {};
    appData.roadmap.forEach(item => {
        const key = item.Bab || 'Lainnya';
        if(!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    Object.keys(grouped).forEach(bab => {
        const items = grouped[bab];
        const isDone = items.every(i => i.Status === 'Selesai');
        const badgeColor = isDone ? 'bg-notion-green text-notion-greenText' : 'bg-yellow-100 text-yellow-700';
        
        // Generate Sub Items
        let subItemsHtml = '';
        items.forEach(sub => {
            const linkHtml = sub['Link File'] ? `<a href="${sub['Link File']}" target="_blank" class="text-xs text-blue-500 hover:underline">File ↗</a>` : '<span class="text-xs text-gray-300">No File</span>';
            const statusIcon = sub.Status === 'Selesai' ? '✅' : (sub.Status === 'Sedang Dikerjakan' ? '🚧' : '⬜');
            
            subItemsHtml += `
                <div class="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <span class="flex items-center gap-2 truncate pr-2">${statusIcon} ${sub['Sub-Bab']}</span>
                    ${linkHtml}
                </div>
            `;
        });

        const html = `
            <div class="mb-4">
                <details class="group bg-white dark:bg-[#202020] border border-notion-border dark:border-notion-darkBorder rounded-lg overflow-hidden">
                    <summary class="flex items-center justify-between p-3 cursor-pointer list-none hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                        <span class="font-medium flex items-center gap-2">📂 ${bab}</span>
                        <span class="text-xs ${badgeColor} px-2 py-1 rounded">${isDone ? 'Selesai' : 'On-going'}</span>
                    </summary>
                    <div class="px-4 py-2 bg-gray-50 dark:bg-[#252525]">
                        ${subItemsHtml}
                    </div>
                </details>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderProfile() {
    if(appData.profile.name) {
        document.getElementById('prof-name').value = appData.profile.name;
        document.getElementById('prof-major').value = appData.profile.jurusan;
        document.getElementById('prof-title').value = appData.profile.judul;
    }
}

/* ==================================================
   ACTIONS (ADD TASK)
   ================================================== */

async function addTask() {
    const nameInput = document.getElementById('inp-task-name');
    const dateInput = document.getElementById('inp-task-date');
    const catInput = document.getElementById('inp-task-cat');

    if(!nameInput.value || !dateInput.value) {
        alert("Mohon isi nama tugas dan tanggal deadline!");
        return;
    }

    const payload = {
        action: 'addTask',
        task: nameInput.value,
        deadline: dateInput.value,
        category: catInput.value
    };
    
    // UI Cleanup
    nameInput.value = '';
    
    // Optimistic UI (Optional: Add to list immediately)
    // Here we just reload
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    loadData();
}

/* ==================================================
   ACTIONS (COMPLETE TASK - MODAL LOGIC)
   ================================================== */

// 1. Buka Modal saat Checkbox diklik
window.openCompleteModal = function(id, name, cat) {
    // Simpan context task yang sedang diklik
    currentCompletingTask = { id, name, cat };
    
    // Set UI Modal
    document.getElementById('modal-task-name').innerText = name;
    
    // Set Default Time (Start = Now, End = Now + 1 Hour)
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('modal-start-time').value = `${hh}:${mm}`;
    
    now.setHours(now.getHours() + 1);
    const endHh = String(now.getHours()).padStart(2, '0');
    const endMm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('modal-end-time').value = `${endHh}:${endMm}`;

    // Tampilkan Modal
    const modal = document.getElementById('modal-complete');
    modal.classList.remove('hidden');
    // Animasi masuk
    setTimeout(() => {
        document.getElementById('modal-content').classList.remove('scale-95');
        document.getElementById('modal-content').classList.add('scale-100');
    }, 10);
};

// 2. Tutup Modal
window.closeModal = function() {
    const modal = document.getElementById('modal-complete');
    document.getElementById('modal-content').classList.remove('scale-100');
    document.getElementById('modal-content').classList.add('scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        // Uncheck checkbox di list (karena batal)
        loadData(); // Reload UI state
    }, 200);
    
    currentCompletingTask = { id: null, name: null, category: null };
};

// 3. Submit Data ke Backend
window.submitCompletion = async function() {
    const startTime = document.getElementById('modal-start-time').value;
    const endTime = document.getElementById('modal-end-time').value;

    if(!startTime || !endTime) {
        alert("Mohon isi jam mulai dan selesai!");
        return;
    }

    const payload = {
        action: 'completeTask',
        taskId: currentCompletingTask.id,
        taskName: currentCompletingTask.name,
        category: currentCompletingTask.category,
        date: new Date().toISOString().split('T')[0],
        startTime: startTime,
        endTime: endTime
    };

    // Close Modal UI first for UX
    closeModal();

    // Send Data
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    loadData();
};

async function saveProfile() {
    const payload = {
        action: 'updateProfile',
        name: document.getElementById('prof-name').value,
        jurusan: document.getElementById('prof-major').value,
        judul: document.getElementById('prof-title').value
    };
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    alert("Profil tersimpan!");
}
