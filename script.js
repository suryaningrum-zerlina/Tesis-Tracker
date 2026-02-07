/* ==================================================
   KONFIGURASI
   ================================================== */
// GANTI DENGAN URL DEPLOYMENT TERBARU ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbxjPFCfjgfkGCZHCIJ6RKoNHQ7g9BdysfBdTKs42iyJikjv6BPr_z4UOVA3SMug4hCE/exec"; 

/* ==================================================
   STATE MANAGEMENT
   ================================================== */
let appData = {
    roadmap: [], tasks: [], logs: [], events: [], files: [], heatmap: {}, profile: {}
};

/* ==================================================
   INIT
   ================================================== */
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Enter key listener for Task Input
    const taskInput = document.querySelector('#view-tasks input[type="text"]');
    if(taskInput) {
        taskInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') addTask();
        });
    }
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
    // 1. Stats Progress
    const completedChapters = appData.roadmap.filter(r => r.Status === 'Selesai').length;
    const totalChapters = appData.roadmap.length || 1;
    const percent = Math.round((completedChapters / totalChapters) * 100);
    // (Opsional: Update elemen UI persen di sini jika ada ID-nya)

    // 2. Heatmap
    const container = document.getElementById('heatmap-container');
    if(container) {
        container.innerHTML = '';
        for (let w = 0; w < 20; w++) {
            const weekCol = document.createElement('div');
            weekCol.className = 'grid grid-rows-7 gap-1';
            for (let d = 0; d < 7; d++) {
                // Logika tanggal mundur sederhana
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

    // 3. History Logs
    const historyList = document.querySelector('#view-home tbody'); 
    if(historyList) {
        historyList.innerHTML = '';
        // Ambil 5 log terakhir (Activity_Logs)
        const recentLogs = appData.logs.slice(-5).reverse(); 
        recentLogs.forEach(log => {
            // Mapping nama kolom sesuai Sheet Activity_Logs
            // Kolom: Tanggal, Aktivitas, Durasi
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
    const container = document.querySelector('#view-tasks .bg-white');
    // Bersihkan task lama (elemen dengan class group)
    const taskItems = container.querySelectorAll('.group');
    taskItems.forEach(el => el.remove());

    const activeTasks = appData.tasks.filter(t => t.Status !== 'Done');
    
    activeTasks.forEach(task => {
        let chipColor = 'bg-gray-100 text-gray-600';
        if(task.Kategori == 'Bimbingan') chipColor = 'bg-blue-100 text-blue-600';
        if(task.Kategori == 'Nulis') chipColor = 'bg-purple-100 text-purple-600';

        // Perhatikan onclick memanggil completeTask dengan ID
        const html = `
            <div class="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800 group">
                <input type="checkbox" class="w-4 h-4 rounded border-gray-300 cursor-pointer" 
                       onclick="completeTask('${task.ID}', '${task.Task}', '${task.Kategori}')">
                <div class="flex-1">
                    <span class="text-sm block">${task.Task}</span>
                    <span class="text-[10px] text-gray-400 md:hidden">📅 ${task.Deadline}</span>
                </div>
                <span class="text-[10px] ${chipColor} px-2 py-0.5 rounded">${task.Kategori}</span>
                <span class="hidden md:flex text-[10px] text-gray-500 items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded ml-2">
                    📅 ${task.Deadline}
                </span>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderCalendar() {
    const container = document.querySelector('#view-calendar .space-y-4');
    if(container) {
        container.innerHTML = '';
        let allItems = [];
        
        // Event
        appData.events.forEach(e => {
            allItems.push({date: e.Tanggal, title: e.Nama_Event, type: 'Event', color: 'blue'});
        });
        // Task Deadlines
        appData.tasks.filter(t => t.Status !== 'Done').forEach(t => {
            allItems.push({date: t.Deadline, title: t.Task, type: 'Deadline', color: 'red'});
        });

        allItems.sort((a, b) => new Date(a.date) - new Date(b.date));

        allItems.forEach(item => {
            const dateObj = new Date(item.date);
            const dateNum = dateObj.getDate();
            const month = dateObj.toLocaleString('default', { month: 'short' });
            const colorClass = item.color === 'blue' ? 'text-blue-800 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20' : 'text-red-800 bg-red-50 dark:text-red-300 dark:bg-red-900/20';

            const html = `
                <div class="flex gap-4 items-start">
                    <div class="text-center w-12 ${colorClass} rounded p-1">
                        <div class="text-[10px] uppercase font-bold opacity-70">${month}</div>
                        <div class="text-lg font-bold">${dateNum}</div>
                    </div>
                    <div>
                        <p class="font-medium text-sm">${item.title}</p>
                        <p class="text-xs text-gray-500">${item.type}</p>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    }
}

function renderFiles() {
    // Sederhana: Render list file dari Drive
    const container = document.querySelector('#view-files .grid');
    if(container) {
        // Hapus elemen file lama, tapi sisakan tombol upload (biasanya elemen pertama)
        // Kita overwrite semua agar simpel, nanti tombol upload dimasukkan ulang via HTML static
        // Di sini kita append ke container yang sudah ada isinya
        
        // Hapus elemen 'a' (file link) saja
        const oldFiles = container.querySelectorAll('a');
        oldFiles.forEach(el => el.remove());

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
}

function renderRoadmap() {
    // Logika render roadmap dinamis bisa ditambahkan disini
    // Untuk saat ini masih menggunakan static HTML di index.html
}

function renderProfile() {
    if(appData.profile.name) {
        const inputs = document.querySelectorAll('#view-settings input, #view-settings textarea');
        if(inputs.length >= 3) {
            inputs[0].value = appData.profile.name;
            inputs[1].value = appData.profile.jurusan;
            inputs[2].value = appData.profile.judul;
        }
    }
}

/* ==================================================
   ACTIONS (POST)
   ================================================== */

async function addTask() {
    const input = document.querySelector('#view-tasks input[type="text"]');
    const taskName = input.value;
    if(!taskName) return;

    // UI Feedback: Kosongkan input
    input.value = ''; 

    const payload = {
        action: 'addTask',
        task: taskName,
        deadline: new Date().toISOString().split('T')[0], // Default hari ini
        category: 'General'
    };
    
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    
    loadData(); // Reload data
}

// UPDATE: Fungsi Selesaikan Task dengan Input Jam Manual
async function completeTask(id, name, cat) {
    // 1. Konfirmasi
    if(!confirm(`Selesaikan tugas "${name}"?`)) return;

    // 2. Minta Input Jam Mulai
    let startTime = prompt("Jam Mulai (Format HH:mm):", "09:00");
    if(!startTime) return; // Batal jika kosong

    // 3. Minta Input Jam Selesai
    let endTime = prompt("Jam Selesai (Format HH:mm):", "10:00");
    if(!endTime) return; // Batal jika kosong

    // 4. Kirim Data
    const payload = {
        action: 'completeTask',
        taskId: id,
        taskName: name,
        category: cat,
        date: new Date().toISOString().split('T')[0],
        startTime: startTime,
        endTime: endTime
    };

    // Feedback visual (opsional: tampilkan loading)
    
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    
    loadData(); // Reload untuk update log & hapus dari list
}
