// URL WEB APP GOOGLE APPS SCRIPT
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyDOUCYVo38JnkgJcbbwb6ergsTDbt-VpRH5e0t3FUWoEfL6ssBPUvce3Z8I9bCmLxw/exec";

let dataPM = [];
let dataPegawai = [];
let dataPerkembangan = [];

let usersDB = {};
let pwdRequests = [];
let currentUser = null;

function initUsersDB() {
    usersDB = {
        'admin': { username: 'admin', password: 'admin123', role: 'admin', pegawaiId: 'PEG_ADMIN' }
    };
    for (let i = 1; i <= 100; i++) {
        const username = `user${i}`;
        usersDB[username] = {
            username: username,
            password: 'pass123',
            role: 'user',
            pegawaiId: null
        };
    }
}

window.onload = function() {
    initUsersDB();
    loadSession();
    loadDataFromCloud();

    setInterval(() => {
        loadDataFromCloud();
    }, 5000);
};

// MODAL PERMINTAAN AKUN (GANTI USERNAME & PASSWORD)
function openResetPasswordModal() {
    document.getElementById('modal-reset-pwd').classList.remove('hidden');
}

function closeResetPasswordModal() {
    document.getElementById('modal-reset-pwd').classList.add('hidden');
}

function submitAccountChangeRequest(e) {
    e.preventDefault();
    const oldUsername = document.getElementById('req-old-username').value.trim();
    const newUsernameInput = document.getElementById('req-new-username');
    const newPasswordInput = document.getElementById('req-new-password');

    if (!usersDB[oldUsername]) {
        alert('Username lama tidak ditemukan dalam sistem!');
        return;
    }

    const req = {
        id: 'REQ_' + Date.now(),
        username: oldUsername,
        newUsername: newUsernameInput ? newUsernameInput.value.trim() : '-',
        newPassword: newPasswordInput ? newPasswordInput.value.trim() : '-',
        status: 'pending',
        time: new Date().toISOString()
    };

    pwdRequests.push(req);
    saveData();
    closeResetPasswordModal();
    alert('Permintaan perubahan akun berhasil dikirim ke Master Admin.');
}

// RENDER TABEL PERMINTAAN PADA PANEL MASTER ADMIN
function renderPwdRequestsTable() {
    const tbody = document.getElementById('pwd-requests-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const pendingReqs = pwdRequests.filter(r => r.status === 'pending');
    const badgeEl = document.getElementById('pwd-req-badge');
    if (badgeEl) {
        badgeEl.innerText = pendingReqs.length;
        if (pendingReqs.length > 0) {
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.classList.add('hidden');
        }
    }

    if (pwdRequests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Belum ada permintaan perubahan akun.</td></tr>`;
        return;
    }

    pwdRequests.forEach(req => {
        // Fallback kompatibilitas data lama agar tidak muncul 'undefined'
        const displayUsername = req.newUsername || req.value || '-';
        const displayPassword = req.newPassword || req.newPwd || '-';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `
            <td class="p-3 font-mono text-xs text-slate-600">${formatDateWithTime(req.time)}</td>
            <td class="p-3 font-semibold text-slate-800">${req.username}</td>
            <td class="p-3 font-mono text-indigo-600 font-bold">${displayUsername}</td>
            <td class="p-3 font-mono text-emerald-600 font-bold">${displayPassword}</td>
            <td class="p-3">
                <span class="px-2 py-1 rounded-md text-xs font-semibold ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' : (req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}">
                    ${req.status.toUpperCase()}
                </span>
            </td>
            <td class="p-3 text-center">
                ${req.status === 'pending' ? `
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="approveAccountRequest('${req.id}')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded shadow transition"><i class="fa-solid fa-check mr-1"></i> Setujui</button>
                        <button onclick="rejectAccountRequest('${req.id}')" class="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded shadow transition"><i class="fa-solid fa-xmark mr-1"></i> Tolak</button>
                    </div>
                ` : '<span class="text-xs text-slate-400 font-medium">-</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function approveAccountRequest(reqId) {
    const req = pwdRequests.find(r => r.id === reqId);
    if (req) {
        req.status = 'approved';
        const oldUser = req.username;
        const newUsername = (req.newUsername && req.newUsername !== '-') ? req.newUsername : (req.value || oldUser);
        const newPassword = (req.newPassword && req.newPassword !== '-') ? req.newPassword : (req.newPwd || (usersDB[oldUser] ? usersDB[oldUser].password : 'pass123'));

        if (usersDB[oldUser]) {
            // Pindahkan data ke username baru (NIP) dan/atau password baru
            usersDB[newUsername] = {
                username: newUsername,
                password: newPassword,
                role: usersDB[oldUser].role,
                pegawaiId: usersDB[oldUser].pegawaiId
            };

            if (oldUser !== newUsername) {
                delete usersDB[oldUser];

                // Migrasi kepemilikan data ke username baru
                dataPM.forEach(pm => { if (pm.createdByAccount === oldUser) pm.createdByAccount = newUsername; });
                dataPegawai.forEach(peg => { if (peg.createdByAccount === oldUser) peg.createdByAccount = newUsername; });
                dataPerkembangan.forEach(perk => { if (perk.createdByAccount === oldUser) perk.createdByAccount = newUsername; });
            }
        }

        saveData();
        renderPwdRequestsTable();
        renderPMTable();
        renderPegawaiTable();
        renderPerkembanganTable();
        showToast('Permintaan akun berhasil disetujui & diperbarui!');
    }
}

function rejectAccountRequest(reqId) {
    const req = pwdRequests.find(r => r.id === reqId);
    if (req) {
        req.status = 'rejected';
        saveData();
        renderPwdRequestsTable();
        showToast('Permintaan perubahan akun ditolak.');
    }
}

function loadSession() {
    const saved = localStorage.getItem('sh_logged_user');
    const btnTambahPegawai = document.getElementById('btn-tambah-pegawai');

    if (saved) {
        currentUser = JSON.parse(saved);
        if (usersDB[currentUser.username]) {
            currentUser = usersDB[currentUser.username];
        }
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('logged-user-label').innerText = `${currentUser.username} (${currentUser.role})`;
        
        if (currentUser.role === 'admin') {
            document.getElementById('tab-admin-btn').classList.remove('hidden');
            if (btnTambahPegawai) btnTambahPegawai.classList.remove('hidden'); // Admin bisa tambah pegawai
        } else {
            document.getElementById('tab-admin-btn').classList.add('hidden');
            if (btnTambahPegawai) btnTambahPegawai.classList.add('hidden'); // User biasa tombol disembunyikan
        }
    } else {
        document.getElementById('welcome-screen').classList.remove('hidden');
        if (btnTambahPegawai) btnTambahPegawai.classList.add('hidden');
    }
}

function goToLogin() {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-box').classList.remove('hidden');
    document.getElementById('pegawai-init-box').classList.add('hidden');
}

function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();

    if (usersDB[u] && usersDB[u].password === p) {
        currentUser = usersDB[u];
        localStorage.setItem('sh_logged_user', JSON.stringify(currentUser));
        
        if (currentUser.role !== 'admin' && !currentUser.pegawaiId) {
            document.getElementById('login-box').classList.add('hidden');
            document.getElementById('pegawai-init-box').classList.remove('hidden');
        } else {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('logged-user-label').innerText = `${currentUser.username} (${currentUser.role})`;
            if (currentUser.role === 'admin') {
                document.getElementById('tab-admin-btn').classList.remove('hidden');
            }
            showToast(`Selamat datang, ${currentUser.username}!`);
            renderPMTable();
            renderPegawaiTable();
            renderPerkembanganTable();
        }
    } else {
        alert('Username atau Password salah!');
    }
}

function saveInitPegawai(e) {
    e.preventDefault();
    const fotoInput = document.getElementById('init-pegawai-foto');
    if (!fotoInput.files || !fotoInput.files[0]) {
        alert('Foto pegawai wajib diunggah!');
        return;
    }

    compressImage(fotoInput.files[0], (fotoBase64) => {
        const newPegId = 'PEG_' + currentUser.username;
        const newPeg = {
            id: newPegId,
            nama: document.getElementById('init-pegawai-nama').value,
            nip: document.getElementById('init-pegawai-nip').value,
            jabatan: document.getElementById('init-pegawai-jabatan').value,
            pokja: document.getElementById('init-pegawai-pokja').value,
            foto: fotoBase64,
            createdByAccount: currentUser.username
        };

        dataPegawai.push(newPeg);
        usersDB[currentUser.username].pegawaiId = newPegId;
        currentUser.pegawaiId = newPegId;
        localStorage.setItem('sh_logged_user', JSON.stringify(currentUser));

        saveData();
        renderPegawaiTable();
        updateDropdownOptions();

        document.getElementById('login-screen').classList.add('hidden');
        showToast('Data pegawai berhasil didaftarkan!');
    });
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('sh_logged_user');
    document.getElementById('welcome-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('tab-admin-btn').classList.add('hidden');
}

async function saveData() {
    const statusEl = document.getElementById('sync-status');
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("GANTI_DENGAN")) {
        showToast('Data disimpan lokal.');
        return;
    }

    try {
        statusEl.className = "text-xs bg-amber-500 text-white px-2.5 py-1 rounded-full font-medium flex items-center gap-1";
        statusEl.innerHTML = `<i class="fa-solid fa-rotate animate-spin"></i> Menyimpan ke Cloud...`;

        const payload = {
            pm: dataPM,
            pegawai: dataPegawai,
            perkembangan: dataPerkembangan,
            usersDB: usersDB,
            pwdRequests: pwdRequests
        };

        await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        statusEl.className = "text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-full font-medium flex items-center gap-1";
        statusEl.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Data Tersinkron ke Cloud`;
        showToast('Berhasil disimpan & disinkronkan ke Google Sheets!');
    } catch (error) {
        console.error("Gagal menyimpan:", error);
        statusEl.className = "text-xs bg-rose-600 text-white px-2.5 py-1 rounded-full font-medium flex items-center gap-1";
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Gagal Menyimpan`;
    }
}

async function loadDataFromCloud() {
    const statusEl = document.getElementById('sync-status');
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("GANTI_DENGAN")) {
        statusEl.className = "text-xs bg-rose-600 text-white px-2.5 py-1 rounded-full font-medium flex items-center gap-1";
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> URL Apps Script Belum Diset`;
        initDefaultData();
        return;
    }

    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const result = await response.json();

        if (result && result.pm) {
            dataPM = result.pm;
            dataPegawai = result.pegawai || [];
            dataPerkembangan = result.perkembangan || [];
            
            if (result.usersDB) usersDB = Object.assign(usersDB, result.usersDB);
            if (result.pwdRequests) pwdRequests = result.pwdRequests;
            
            statusEl.className = "text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-full font-medium flex items-center gap-1";
            statusEl.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Terhubung ke Google Sheets`;
        } else {
            initDefaultData();
        }
    } catch (error) {
        console.error("Gagal memuat data:", error);
        statusEl.className = "text-xs bg-rose-600 text-white px-2.5 py-1 rounded-full font-medium flex items-center gap-1";
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Gagal Sinkronisasi`;
        initDefaultData();
    }

    renderPMTable();
    renderPegawaiTable();
    renderPerkembanganTable();
    renderPwdRequestsTable();
}

function initDefaultData() {
    dataPM = [
        { id: 'PM001', nama: 'Ananda Rizky', ibu: 'Siti Aminah', jk: 'Laki - Laki', kasus: 'Tawuran', status: 'Titipan', peksos: 'Budi Santoso, S.Tr.Sos', masuk: '2024-01-15', terminasi: '2024-07-15', foto: '', createdByAccount: 'user1' }
    ];
    dataPegawai = [
        { id: 'PEG001', nama: 'Budi Santoso, S.Tr.Sos', nip: '198503122010011005', jabatan: 'Pekerja Sosial', pokja: 'Pokja ABH', foto: '', createdByAccount: 'user1' },
        { id: 'PEG003', nama: 'Drs. Ahmad Hidayat, M.Si', nip: '197501011999031001', jabatan: 'Ketua Pokja', pokja: 'Pokja ABH', foto: '', createdByAccount: 'admin' }
    ];
    dataPerkembangan = [
        { id: 'PER001', pmId: 'PM001', tanggal: '2024-01-20', kategori: 'Perilaku & Disiplin', deskripsi: 'PM mulai menyesuaikan diri.', rekomendasi: 'Konseling rutin.', petugas: 'Budi Santoso, S.Tr.Sos', createdByAccount: 'user1' }
    ];
}

function canUserModify(itemOwnerUsername) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return itemOwnerUsername === currentUser.username;
}

function renderPMTable() {
    const tbody = document.getElementById('pm-table-body');
    if(!tbody) return;
    const search = document.getElementById('search-pm').value.toLowerCase();
    tbody.innerHTML = '';

    const filtered = dataPM.filter(pm => 
        (pm.nama && pm.nama.toLowerCase().includes(search)) || 
        (pm.ibu && pm.ibu.toLowerCase().includes(search)) || 
        (pm.kasus && pm.kasus.toLowerCase().includes(search))
    );

    document.getElementById('total-pm-count').innerText = filtered.length;

    filtered.forEach(pm => {
        const isEditable = canUserModify(pm.createdByAccount);
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `
            <td class="p-3">
                ${pm.foto ? `<img src="${pm.foto}" class="w-10 h-10 rounded-full object-cover border">` : `<div class="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 text-xs font-bold">${pm.nama ? pm.nama.charAt(0) : 'P'}</div>`}
            </td>
            <td class="p-3 font-semibold text-slate-800">${pm.nama}</td>
            <td class="p-3 text-slate-600">${pm.ibu}</td>
            <td class="p-3 text-slate-600">${pm.jk}</td>
            <td class="p-3"><span class="px-2 py-1 bg-rose-50 text-rose-700 rounded-md font-medium text-xs">${pm.kasus}</span></td>
            <td class="p-3"><span class="px-2 py-1 ${pm.status === 'Putusan' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'} rounded-md font-medium text-xs">${pm.status}</span></td>
            <td class="p-3 text-slate-600">${pm.peksos}</td>
            <td class="p-3 text-xs font-mono text-slate-500">${pm.createdByAccount || '-'}</td>
            <td class="p-3 text-slate-600">${formatDate(pm.masuk)}</td>
            <td class="p-3 text-slate-600">${pm.terminasi ? formatDate(pm.terminasi) : '-'}</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center space-x-2">
                    ${isEditable ? `
                        <button onclick="editPM('${pm.id}')" class="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deletePM('${pm.id}')" class="p-1.5 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-100" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                    ` : `<span class="text-xs text-slate-300 italic"><i class="fa-solid fa-lock"></i> Locked</span>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPegawaiTable() {
    const tbody = document.getElementById('pegawai-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    // --- HITUNG STATISTIK PEGAWAI ---
    const totalPegawai = dataPegawai.length;
    const jabatanCounts = {};
    const pokjaCounts = {};

    dataPegawai.forEach(peg => {
        const jabatan = peg.jabatan || 'Lainnya';
        const pokja = peg.pokja || 'Umum';
        jabatanCounts[jabatan] = (jabatanCounts[jabatan] || 0) + 1;
        pokjaCounts[pokja] = (pokjaCounts[pokja] || 0) + 1;
    });

    // Render Total Pegawai
    const totalEl = document.getElementById('stat-total-pegawai');
    if (totalEl) totalEl.innerText = totalPegawai;

    // Render Rincian Jabatan
    const jabatanListEl = document.getElementById('stat-jabatan-list');
    if (jabatanListEl) {
        jabatanListEl.innerHTML = Object.keys(jabatanCounts).length > 0 
            ? Object.entries(jabatanCounts).map(([jabatan, count]) => `
                <div class="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0">
                    <span class="text-slate-600 truncate mr-2">${jabatan}</span> 
                    <span class="font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[11px]">${count}</span>
                </div>
            `).join('')
            : '<span class="text-slate-400 italic">Belum ada data jabatan</span>';
    }

    // Render Rincian Pokja
    const pokjaListEl = document.getElementById('stat-pokja-list');
    if (pokjaListEl) {
        pokjaListEl.innerHTML = Object.keys(pokjaCounts).length > 0 
            ? Object.entries(pokjaCounts).map(([pokja, count]) => `
                <div class="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0">
                    <span class="text-slate-600 truncate mr-2">${pokja}</span> 
                    <span class="font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[11px]">${count}</span>
                </div>
            `).join('')
            : '<span class="text-slate-400 italic">Belum ada data pokja</span>';
    }
    // --- AKHIR STATISTIK ---

    dataPegawai.forEach(peg => {
        const isEditable = canUserModify(peg.createdByAccount);
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `
            <td class="p-3">
                ${peg.foto ? `<img src="${peg.foto}" class="w-10 h-10 rounded-full object-cover border">` : `<div class="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">${peg.nama ? peg.nama.charAt(0) : 'P'}</div>`}
            </td>
            <td class="p-3 font-semibold text-slate-800">${peg.nama}</td>
            <td class="p-3 text-slate-600 font-mono text-xs">${peg.nip}</td>
            <td class="p-3"><span class="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium">${peg.jabatan}</span></td>
            <td class="p-3 text-slate-600">${peg.pokja}</td>
            <td class="p-3 text-xs font-mono text-slate-500">${peg.createdByAccount || '-'}</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center space-x-2">
                    ${isEditable ? `
                        <button onclick="editPegawai('${peg.id}')" class="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deletePegawai('${peg.id}')" class="p-1.5 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-100" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                    ` : `<span class="text-xs text-slate-300 italic"><i class="fa-solid fa-lock"></i> Locked</span>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    updateDropdownOptions();
}

function renderPerkembanganTable() {
    const tbody = document.getElementById('perkembangan-table-body');
    if(!tbody) return;
    const filterPM = document.getElementById('filter-perkembangan-pm').value;
    tbody.innerHTML = '';

    const filtered = filterPM ? dataPerkembangan.filter(p => p.pmId === filterPM) : dataPerkembangan;

    filtered.forEach(p => {
        const pm = dataPM.find(item => item.id === p.pmId) || { nama: 'PM Terhapus' };
        const isEditable = canUserModify(p.createdByAccount);
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `
            <td class="p-3 font-mono text-xs text-slate-600">${formatDateWithTime(p.tanggal)}</td>
            <td class="p-3 font-semibold text-slate-800">${pm.nama}</td>
            <td class="p-3"><span class="px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">${p.kategori}</span></td>
            <td class="p-3 text-slate-700 max-w-xs">${p.deskripsi}</td>
            <td class="p-3 text-slate-600 max-w-xs">${p.rekomendasi || '-'}</td>
            <td class="p-3 text-slate-600">${p.petugas}</td>
            <td class="p-3 text-xs font-mono text-slate-500">${p.createdByAccount || '-'}</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center space-x-2">
                    ${isEditable ? `
                        <button onclick="editPerkembangan('${p.id}')" class="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deletePerkembangan('${p.id}')" class="p-1.5 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-100" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                    ` : `<span class="text-xs text-slate-300 italic"><i class="fa-solid fa-lock"></i> Locked</span>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateDropdownOptions() {
    const peksosSelect = document.getElementById('pm-peksos');
    const filterPerkembangan = document.getElementById('filter-perkembangan-pm');
    const perkPMSelect = document.getElementById('perkembangan-pm');
    const perkPetugasSelect = document.getElementById('perkembangan-petugas');

    if(!peksosSelect) return;

    const peksosList = dataPegawai.filter(p => p.jabatan === 'Pekerja Sosial' || p.jabatan === 'Ketua Pokja');
    peksosSelect.innerHTML = peksosList.map(p => `<option value="${p.nama}">${p.nama}</option>`).join('');

    // --- PENGATURAN PILIHAN PETUGAS PENCATAT BERDASARKAN ROLE ---
    if (currentUser) {
        if (currentUser.role === 'admin') {
            // Admin dapat memilih seluruh daftar pegawai yang ada
            perkPetugasSelect.innerHTML = dataPegawai.map(p => `<option value="${p.nama}">${p.nama} (${p.jabatan})</option>`).join('');
            perkPetugasSelect.removeAttribute("disabled"); // Memastikan select tidak terkunci untuk admin
        } else {
            // User biasa dikunci hanya pada data pegawai miliknya sendiri
            const myPegawai = dataPegawai.find(p => p.id === currentUser.pegawaiId || p.createdByAccount === currentUser.username);
            
            if (myPegawai) {
                perkPetugasSelect.innerHTML = `<option value="${myPegawai.nama}" selected>${myPegawai.nama} (${myPegawai.jabatan})</option>`;
                perkPetugasSelect.setAttribute("disabled", "true");
            } else {
                perkPetugasSelect.innerHTML = `<option value="${currentUser.username}">${currentUser.username}</option>`;
                perkPetugasSelect.setAttribute("disabled", "true");
            }
        }
    }

    const pmOptions = dataPM.map(p => `<option value="${p.id}">${p.nama} - (${p.kasus})</option>`).join('');
    filterPerkembangan.innerHTML = `<option value="">-- Semua PM --</option>` + pmOptions;
    perkPMSelect.innerHTML = pmOptions;
}

function savePM(e) {
    e.preventDefault();
    const id = document.getElementById('pm-id').value || 'PM' + String(Date.now()).slice(-4);
    const fotoInput = document.getElementById('pm-foto');

    const handleSave = (fotoBase64) => {
        const existingIndex = dataPM.findIndex(p => p.id === id);
        const owner = existingIndex >= 0 ? dataPM[existingIndex].createdByAccount : (currentUser ? currentUser.username : 'admin');

        const newPM = {
            id: id,
            nama: document.getElementById('pm-nama').value.trim(),
            ibu: document.getElementById('pm-ibu').value.trim(),
            jk: document.getElementById('pm-jk').value,
            kasus: document.getElementById('pm-kasus').value,
            status: document.getElementById('pm-status').value,
            peksos: document.getElementById('pm-peksos').value,
            masuk: document.getElementById('pm-masuk').value,
            terminasi: document.getElementById('pm-terminasi').value,
            foto: fotoBase64 || (existingIndex >= 0 ? dataPM[existingIndex].foto : ''),
            createdByAccount: owner
        };

        if(existingIndex >= 0) {
            dataPM[existingIndex] = newPM;
        } else {
            dataPM.push(newPM);
        }

        saveData();
        renderPMTable();
        updateDropdownOptions();
        closePMModal();
    };

    if (fotoInput.files && fotoInput.files[0]) {
        compressImage(fotoInput.files[0], handleSave);
    } else {
        handleSave(null);
    }
}

function savePegawai(e) {
    e.preventDefault();
    const id = document.getElementById('pegawai-id').value || 'PEG' + String(Date.now()).slice(-4);
    const fotoInput = document.getElementById('pegawai-foto');
    const existingIndex = dataPegawai.findIndex(p => p.id === id);

    if (!fotoInput.files || !fotoInput.files[0]) {
        if (existingIndex < 0 || !dataPegawai[existingIndex].foto) {
            alert('Foto pegawai wajib diunggah!');
            return;
        }
    }

    const handleSave = (fotoBase64) => {
        const owner = existingIndex >= 0 ? dataPegawai[existingIndex].createdByAccount : (currentUser ? currentUser.username : 'admin');

        const newPegawai = {
            id: id,
            nama: document.getElementById('pegawai-nama').value,
            nip: document.getElementById('pegawai-nip').value,
            jabatan: document.getElementById('pegawai-jabatan').value,
            pokja: document.getElementById('pegawai-pokja').value,
            foto: fotoBase64 || (existingIndex >= 0 ? dataPegawai[existingIndex].foto : ''),
            createdByAccount: owner
        };

        if(existingIndex >= 0) {
            dataPegawai[existingIndex] = newPegawai;
        } else {
            dataPegawai.push(newPegawai);
        }

        saveData();
        renderPegawaiTable();
        closePegawaiModal();
    };

    if (fotoInput.files && fotoInput.files[0]) {
        compressImage(fotoInput.files[0], handleSave);
    } else {
        handleSave(null);
    }
}

function savePerkembangan(e) {
    e.preventDefault();
    const id = document.getElementById('perkembangan-id').value || 'PER' + String(Date.now()).slice(-4);
    const fotoInput = document.getElementById('perkembangan-foto');

    const handleSave = (fotoBase64) => {
        const existingIndex = dataPerkembangan.findIndex(p => p.id === id);
        const owner = existingIndex >= 0 ? dataPerkembangan[existingIndex].createdByAccount : (currentUser ? currentUser.username : 'admin');

        const newRecord = {
            id: id,
            pmId: document.getElementById('perkembangan-pm').value,
            tanggal: document.getElementById('perkembangan-tanggal').value,
            kategori: document.getElementById('perkembangan-kategori').value,
            deskripsi: document.getElementById('perkembangan-deskripsi').value,
            rekomendasi: document.getElementById('perkembangan-rekomendasi').value,
            petugas: document.getElementById('perkembangan-petugas').value,
            foto: fotoBase64 || (existingIndex >= 0 ? dataPerkembangan[existingIndex].foto : ''),
            createdByAccount: owner
        };

        if(existingIndex >= 0) {
            dataPerkembangan[existingIndex] = newRecord;
        } else {
            dataPerkembangan.push(newRecord);
        }

        saveData();
        renderPerkembanganTable();
        closePerkembanganModal();
    };

    if (fotoInput.files && fotoInput.files[0]) {
        compressImage(fotoInput.files[0], handleSave);
    } else {
        handleSave(null);
    }
}

function deletePM(id) {
    const item = dataPM.find(p => p.id === id);
    if (!item || !canUserModify(item.createdByAccount)) {
        alert('Anda tidak memiliki hak akses untuk menghapus data ini.');
        return;
    }
    if(confirm('Hapus data PM ini? Semua rekam perkembangan terkait juga akan terhapus.')) {
        dataPM = dataPM.filter(p => p.id !== id);
        dataPerkembangan = dataPerkembangan.filter(p => p.pmId !== id);
        saveData();
        renderPMTable();
        renderPerkembanganTable();
        updateDropdownOptions();
    }
}

function deletePegawai(id) {
    const item = dataPegawai.find(p => p.id === id);
    if (!item || !canUserModify(item.createdByAccount)) {
        alert('Anda tidak memiliki hak akses untuk menghapus data ini.');
        return;
    }
    if(confirm('Hapus pegawai ini?')) {
        dataPegawai = dataPegawai.filter(p => p.id !== id);
        saveData();
        renderPegawaiTable();
    }
}

function deletePerkembangan(id) {
    const item = dataPerkembangan.find(p => p.id === id);
    if (!item || !canUserModify(item.createdByAccount)) {
        alert('Anda tidak memiliki hak akses untuk menghapus data ini.');
        return;
    }
    if(confirm('Hapus catatan perkembangan ini?')) {
        dataPerkembangan = dataPerkembangan.filter(p => p.id !== id);
        saveData();
        renderPerkembanganTable();
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('border-indigo-600', 'text-indigo-600', 'border-amber-600', 'text-amber-600');
        el.classList.add('border-transparent', 'text-slate-500');
    });

    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-${tabName}-btn`);
    activeBtn.classList.remove('border-transparent', 'text-slate-500');

    if (tabName === 'admin') {
        activeBtn.classList.add('border-amber-600', 'text-amber-600');
        renderPwdRequestsTable();
    } else {
        activeBtn.classList.add('border-indigo-600', 'text-indigo-600');
    }

    if(tabName === 'laporan') {
        populateLaporanSelect();
        toggleLaporanType();
    }
}

function openPMModal(editId = null) {
    document.getElementById('form-pm').reset();
    document.getElementById('pm-id').value = '';
    document.getElementById('modal-pm-title').innerText = 'Tambah Data Penerima Manfaat';
    updateDropdownOptions();

    if(editId) {
        const pm = dataPM.find(p => p.id === editId);
        if(pm) {
            document.getElementById('pm-id').value = pm.id;
            document.getElementById('pm-nama').value = pm.nama;
            document.getElementById('pm-ibu').value = pm.ibu;
            document.getElementById('pm-jk').value = pm.jk;
            document.getElementById('pm-kasus').value = pm.kasus;
            document.getElementById('pm-status').value = pm.status;
            document.getElementById('pm-peksos').value = pm.peksos;
            document.getElementById('pm-masuk').value = pm.masuk;
            document.getElementById('pm-terminasi').value = pm.terminasi;
            document.getElementById('modal-pm-title').innerText = 'Edit Data Penerima Manfaat';
        }
    }
    document.getElementById('modal-pm').classList.remove('hidden');
}

function closePMModal() { document.getElementById('modal-pm').classList.add('hidden'); }
function editPM(id) { openPMModal(id); }

function openPegawaiModal(editId = null) {
    document.getElementById('form-pegawai').reset();
    document.getElementById('pegawai-id').value = '';
    document.getElementById('modal-pegawai-title').innerText = 'Tambah Data Pegawai';
    document.getElementById('pegawai-foto').setAttribute('required', 'true');

    if(editId) {
        const peg = dataPegawai.find(p => p.id === editId);
        if(peg) {
            document.getElementById('pegawai-id').value = peg.id;
            document.getElementById('pegawai-nama').value = peg.nama;
            document.getElementById('pegawai-nip').value = peg.nip;
            document.getElementById('pegawai-jabatan').value = peg.jabatan;
            document.getElementById('pegawai-pokja').value = peg.pokja;
            if (peg.foto) {
                document.getElementById('pegawai-foto').removeAttribute('required');
            }
            document.getElementById('modal-pegawai-title').innerText = 'Edit Data Pegawai';
        }
    }
    document.getElementById('modal-pegawai').classList.remove('hidden');
}

function closePegawaiModal() { document.getElementById('modal-pegawai').classList.add('hidden'); }
function editPegawai(id) { openPegawaiModal(id); }

function openPerkembanganModal(editId = null) {
    document.getElementById('form-perkembangan').reset();
    document.getElementById('perkembangan-id').value = '';
    document.getElementById('modal-perkembangan-title').innerText = 'Catat Rekam Perkembangan';

    if(editId) {
        const perk = dataPerkembangan.find(p => p.id === editId);
        if(perk) {
            document.getElementById('perkembangan-id').value = perk.id;
            document.getElementById('perkembangan-pm').value = perk.pmId;
            if (perk.tanggal) {
                const d = new Date(perk.tanggal);
                if (!isNaN(d.getTime())) {
                    const isoLocal = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    document.getElementById('perkembangan-tanggal').value = isoLocal;
                } else {
                    document.getElementById('perkembangan-tanggal').value = perk.tanggal;
                }
            }
            document.getElementById('perkembangan-kategori').value = perk.kategori;
            document.getElementById('perkembangan-deskripsi').value = perk.deskripsi;
            document.getElementById('perkembangan-rekomendasi').value = perk.rekomendasi;
            document.getElementById('perkembangan-petugas').value = perk.petugas;
            document.getElementById('modal-perkembangan-title').innerText = 'Edit Rekam Perkembangan';
        }
    } else {
        const now = new Date();
        const isoLocalNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('perkembangan-tanggal').value = isoLocalNow;
    }
    document.getElementById('modal-perkembangan').classList.remove('hidden');
}

function closePerkembanganModal() { document.getElementById('modal-perkembangan').classList.add('hidden'); }
function editPerkembangan(id) { openPerkembanganModal(id); }

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300;
            const MAX_HEIGHT = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
                if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

function toggleLaporanType() {
    const type = document.getElementById('select-tipe-laporan').value;
    const pmWrapper = document.getElementById('wrapper-select-pm');
    const peksosWrapper = document.getElementById('wrapper-select-peksos');
    const kasusWrapper = document.getElementById('wrapper-select-kasus');
    const secIndividu = document.getElementById('report-section-individu');
    const secRekap = document.getElementById('report-section-rekapitulasi');

    pmWrapper.classList.add('hidden');
    peksosWrapper.classList.add('hidden');
    kasusWrapper.classList.add('hidden');

    if (type === 'individu') {
        pmWrapper.classList.remove('hidden');
        secIndividu.classList.remove('hidden');
        secRekap.classList.add('hidden');
        generateReport();
    } else if (type === 'peksos') {
        peksosWrapper.classList.remove('hidden');
        secIndividu.classList.add('hidden');
        secRekap.classList.remove('hidden');
        generateFilterReport();
    } else if (type === 'kasus') {
        kasusWrapper.classList.remove('hidden');
        secIndividu.classList.add('hidden');
        secRekap.classList.remove('hidden');
        generateFilterReport();
    } else if (type === 'rekapitulasi') {
        secIndividu.classList.add('hidden');
        secRekap.classList.remove('hidden');
        generateRekapitulasiReport();
    }
}

function generateFilterReport() {
    const type = document.getElementById('select-tipe-laporan').value;
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('report-rekap-print-date').innerText = todayStr;
    document.getElementById('report-ttd-date').innerText = todayStr;

    let filteredPM = [];
    const titleEl = document.getElementById('report-rekap-title');
    const subtitleEl = document.getElementById('report-rekap-subtitle');

    if (type === 'peksos') {
        const selectedPeksos = document.getElementById('select-laporan-peksos').value;
        filteredPM = dataPM.filter(pm => pm.peksos === selectedPeksos);
        titleEl.innerText = "LAPORAN REKAPITULASI PM BERDASARKAN PEKSOS PENDAMPING";
        subtitleEl.innerText = `Pekerja Sosial Pendamping: ${selectedPeksos}`;

        const peksosObj = dataPegawai.find(p => p.nama === selectedPeksos);
        document.getElementById('report-ttd-peksos-nama').innerText = selectedPeksos;
        document.getElementById('report-ttd-peksos-nip').innerText = peksosObj ? peksosObj.nip : '-';
    } else if (type === 'kasus') {
        const selectedKasus = document.getElementById('select-laporan-kasus').value;
        filteredPM = dataPM.filter(pm => pm.kasus === selectedKasus);
        titleEl.innerText = "LAPORAN REKAPITULASI PM BERDASARKAN KATEGORI KASUS";
        subtitleEl.innerText = `Kategori Kasus: ${selectedKasus}`;

        document.getElementById('report-ttd-peksos-nama').innerText = "Pekerja Sosial Pendamping";
        document.getElementById('report-ttd-peksos-nip').innerText = "-";
    }

    renderFilteredTable(filteredPM);
}

function generateRekapitulasiReport() {
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('report-rekap-print-date').innerText = todayStr;
    document.getElementById('report-ttd-date').innerText = todayStr;

    document.getElementById('report-rekap-title').innerText = "LAPORAN REKAPITULASI DATABASE & REKAM PERKEMBANGAN PM";
    document.getElementById('report-rekap-subtitle').innerText = "Seluruh Data Penerima Manfaat Sentra Handayani";

    renderFilteredTable(dataPM);
}

function renderFilteredTable(listPM) {
    const tbody = document.getElementById('report-rekapitulasi-body');
    tbody.innerHTML = '';

    if (listPM.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="border border-slate-300 p-4 text-center text-slate-400 italic">Tidak ada data Penerima Manfaat.</td></tr>`;
        return;
    }

    listPM.forEach((pm, index) => {
        const pmPerkembangan = dataPerkembangan
            .filter(p => p.pmId === pm.id)
            .sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

        const lastUpdate = pmPerkembangan.length > 0 ? formatDateWithTime(pmPerkembangan[0].tanggal) : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="border border-slate-300 p-2 text-center font-mono">${index + 1}</td>
            <td class="border border-slate-300 p-2 font-bold">${pm.nama}<br><span class="text-slate-500 text-[10px]">Ibu: ${pm.ibu}</span></td>
            <td class="border border-slate-300 p-2">${pm.kasus}</td>
            <td class="border border-slate-300 p-2">${pm.status}</td>
            <td class="border border-slate-300 p-2">${pm.peksos}</td>
            <td class="border border-slate-300 p-2 text-center font-bold">${pmPerkembangan.length}</td>
            <td class="border border-slate-300 p-2 font-mono text-center">${lastUpdate}</td>
        `;
        tbody.appendChild(tr);
    });

    const KetuaPokjaObj = dataPegawai.find(p => p.jabatan === 'Ketua Pokja');
    if(KetuaPokjaObj) {
        document.getElementById('report-ttd-pokja-nama').innerText = KetuaPokjaObj.nama;
        document.getElementById('report-ttd-pokja-nip').innerText = KetuaPokjaObj.nip;
    } else {
        document.getElementById('report-ttd-pokja-nama').innerText = 'Tuti Nurhayati';
        document.getElementById('report-ttd-pokja-nip').innerText = '198401182010122001';
    }
}

function populateLaporanSelect() {
    const selectPM = document.getElementById('select-laporan-pm');
    selectPM.innerHTML = dataPM.map(pm => `<option value="${pm.id}">${pm.nama} (${pm.kasus})</option>`).join('');

    const selectPeksos = document.getElementById('select-laporan-peksos');
    const peksosList = dataPegawai.filter(p => p.jabatan === 'Pekerja Sosial' || p.jabatan === 'Ketua Pokja');
    selectPeksos.innerHTML = peksosList.map(p => `<option value="${p.nama}">${p.nama}</option>`).join('');
}

function generateReport() {
    const pmId = document.getElementById('select-laporan-pm').value;
    const pm = dataPM.find(p => p.id === pmId);
    if(!pm) return;

    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('report-print-date').innerText = todayStr;
    document.getElementById('report-ttd-date').innerText = todayStr;

    document.getElementById('report-pm-nama').innerText = pm.nama;
    document.getElementById('report-pm-ibu').innerText = pm.ibu;
    document.getElementById('report-pm-jk').innerText = pm.jk;
    document.getElementById('report-pm-kasus').innerText = pm.kasus;
    document.getElementById('report-pm-status').innerText = pm.status;
    document.getElementById('report-pm-peksos').innerText = pm.peksos;
    document.getElementById('report-pm-masuk').innerText = formatDateOnly(pm.masuk);
    document.getElementById('report-pm-terminasi').innerText = pm.terminasi ? formatDateOnly(pm.terminasi) : 'Belum Ditentukan';

    const imgEl = document.getElementById('report-pm-photo');
    const iconEl = document.getElementById('report-pm-photo-icon');
    if(pm.foto) {
        imgEl.src = pm.foto;
        imgEl.classList.remove('hidden');
        iconEl.classList.add('hidden');
    } else {
        imgEl.classList.add('hidden');
        iconEl.classList.remove('hidden');
    }

    const peksosObj = dataPegawai.find(p => p.nama === pm.peksos);
    document.getElementById('report-ttd-peksos-nama').innerText = pm.peksos || 'Pekerja Sosial Pendamping';
    document.getElementById('report-ttd-peksos-nip').innerText = peksosObj ? peksosObj.nip : '-';

    const KetuaPokjaObj = dataPegawai.find(p => p.jabatan === 'Ketua Pokja');
    if(KetuaPokjaObj) {
        document.getElementById('report-ttd-pokja-nama').innerText = KetuaPokjaObj.nama;
        document.getElementById('report-ttd-pokja-nip').innerText = KetuaPokjaObj.nip;
    } else {
        document.getElementById('report-ttd-pokja-nama').innerText = 'Tuti Nurhayati';
        document.getElementById('report-ttd-pokja-nip').innerText = '198401182010122001';
    }

    const pmPerkembangan = dataPerkembangan
        .filter(p => p.pmId === pmId)
        .sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

    const reportTbody = document.getElementById('report-perkembangan-body');
    reportTbody.innerHTML = '';

    if(pmPerkembangan.length === 0) {
        reportTbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Belum ada catatan rekam perkembangan.</td></tr>`;
    } else {
        pmPerkembangan.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="border border-slate-300 p-2 font-mono align-top">${formatDateWithTime(p.tanggal)}</td>
                <td class="border border-slate-300 p-2 font-semibold align-top">${p.kategori}</td>
                <td class="border border-slate-300 p-2 align-top">
                    <p>${p.deskripsi}</p>
                    ${p.rekomendasi ? `<p class="mt-1 text-slate-600 italic"><strong>Rekomendasi:</strong> ${p.rekomendasi}</p>` : ''}
                    ${p.foto ? `<div class="mt-2"><img src="${p.foto}" alt="Foto Perkembangan" class="w-28 h-20 object-cover rounded border shadow-sm"></div>` : ''}
                </td>
                <td class="border border-slate-300 p-2 align-top">${p.petugas}</td>
            `;
            reportTbody.appendChild(tr);
        });
    }
}

function exportRekapitulasiPDF() {
    switchTab('laporan');
    document.getElementById('select-tipe-laporan').value = 'rekapitulasi';
    toggleLaporanType();
    setTimeout(() => { window.print(); }, 300);
}

function exportAllToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "--- DATA PENERIMA MANFAAT ---\n";
    csvContent += "ID,Nama,Nama Ibu Kandung,Jenis Kelamin,Kasus,Status,Peksos,DibuatOleh,Tanggal Masuk,Tanggal Terminasi\n";
    dataPM.forEach(p => {
        csvContent += `"${p.id}","${p.nama}","${p.ibu}","${p.jk}","${p.kasus}","${p.status}","${p.peksos}","${p.createdByAccount || ''}","${p.masuk}","${p.terminasi}"\n`;
    });

    csvContent += "\n--- DATA REKAM PERKEMBANGAN ---\n";
    csvContent += "ID Catatan,ID PM,Tanggal,Kategori,Deskripsi,Rekomendasi,Petugas,DibuatOleh\n";
    dataPerkembangan.forEach(r => {
        csvContent += `"${r.id}","${r.pmId}","${r.tanggal}","${r.kategori}","${r.deskripsi.replace(/"/g, '""')}","${r.rekomendasi.replace(/"/g, '""')}","${r.petugas}","${r.createdByAccount || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekam_Perkembangan_Sentra_Handayani_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Database berhasil diekspor ke CSV!');
}

function formatDate(dateString) { return formatDateOnly(dateString); }

function formatDateOnly(dateString) {
    if (!dateString) return '-';
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return dateString;

    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthNames = [
        '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const month = monthNames[dateObj.getMonth() + 1];
    const year = dateObj.getFullYear();

    return `${day} ${month} ${year}`;
}

function formatDateWithTime(dateString) {
    if (!dateString) return '-';
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return dateString;

    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthNames = [
        '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const month = monthNames[dateObj.getMonth() + 1];
    const year = dateObj.getFullYear();

    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return `${day} ${month} ${year}, ${hours}:${minutes}`;
}
