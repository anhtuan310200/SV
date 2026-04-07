import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, onValue, update, remove, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCfrD1iS1yjfjuaPIKvGb-iWcirBg1lXJE",
    authDomain: "appsinhvien-24482.firebaseapp.com",
    databaseURL: "https://appsinhvien-24482-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "appsinhvien-24482"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
let activeQuizId = null;
let quizTimerInterval = null;
let myCurrentPvPRoomId = null;

// ==========================================
// 🔔 HỆ THỐNG CUSTOM ALERT LỘNG LẪY
// ==========================================
window.showResult = (title, message, isWin) => {
    const t = document.getElementById('result-title');
    t.innerText = title;
    t.className = isWin ? 'text-gold glow-pulse' : 'text-red glow-pulse';
    document.getElementById('result-msg').innerHTML = message.replace(/\n/g, '<br><br>');
    document.getElementById('result-modal').style.display = 'flex';
};

function formatDate(dStr) {
    if(!dStr || dStr === 'Không có') return '';
    const parts = dStr.split('-');
    if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
}

window.toggleMusic = () => {
    const audio = document.getElementById('bgMusic'), btn = document.getElementById('music-toggle');
    if (audio.paused) { 
        audio.play().catch(() => alert("Bấm vào bất cứ đâu trên màn hình trước khi bật nhạc!")); 
        btn.innerHTML = '<i class="fas fa-volume-up"></i> [ TẮT NHẠC ]'; 
        btn.style.color = 'var(--neon-gold)'; 
    }
    else { audio.pause(); btn.innerHTML = '<i class="fas fa-music"></i> [ BẬT NHẠC ]'; btn.style.color = ''; }
};

window.switchTab = (tab) => {
    document.getElementById('nav-academic').classList.remove('active');
    document.getElementById('nav-casino').classList.remove('active');
    document.getElementById('tab-academic').style.display = 'none';
    document.getElementById('tab-casino').style.display = 'none';
    document.getElementById(`nav-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).style.display = 'grid';
};

window.login = async () => {
    const u = document.getElementById('username').value.trim(), p = document.getElementById('password').value.trim();
    const snap = await get(ref(db, `users/${u}`));
    if (snap.exists() && snap.val().pass === p) {
        if(snap.val().locked) return window.showResult("LỖI", "ACCOUNT BỊ KHÓA!", false);
        localStorage.setItem('uid', u); location.reload();
    } else window.showResult("LỖI", "SAI UID HOẶC PASS!", false);
};
window.logout = () => { localStorage.removeItem('uid'); location.reload(); };

function genClassOptions(sel, all = false) {
    let o = all ? '<option value="ALL">TẤT CẢ LỚP</option>' : '';
    for(let y=1; y<=4; y++) ['A','B','C','D'].forEach(b => { const v=`Y${y}_${b}`; o+=`<option value="${v}" ${v===sel?'selected':''}>Lớp ${y}-${b}</option>`; });
    return o;
}

const uid = localStorage.getItem('uid');
if (uid) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    if(document.getElementById('add-class-select')) {
        document.getElementById('add-class-select').innerHTML = genClassOptions('Y1_A');
        document.getElementById('filter-class-select').innerHTML = genClassOptions('ALL', true);
    }
    loadSystem();
}

function loadSystem() {
    onValue(ref(db, `users/${uid}`), snap => {
        const u = snap.val(); if(!u) return;
        document.getElementById('avatar-container').innerHTML = u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : `<i class="fas fa-user-ninja"></i>`;
        document.getElementById('display-name').innerHTML = u.role === 'TEACHER' ? `${u.name} <i class="fas fa-pen" onclick="changeTeacherName()" style="font-size:10px;cursor:pointer;"></i>` : u.name;
        document.getElementById('role-badge').innerText = u.role === 'TEACHER' ? 'FACULTY' : `LỚP ${u.class}`;
        
        if(document.getElementById('pvp-p1-avatar')) {
            document.getElementById('pvp-p1-avatar').src = u.avatar || 'https://i.pravatar.cc/150?u=my';
            document.getElementById('pvp-p1-name').innerText = u.name;
        }

        if(u.role === 'TEACHER') { 
            document.getElementById('teacher-view').style.display = 'block'; 
            document.getElementById('nav-academic').style.display = 'none';
            document.getElementById('nav-casino').style.display = 'none';
            loadAdmin(); 
        } else { 
            document.getElementById('student-view').style.display = 'block'; 
            document.getElementById('nav-academic').style.display = 'flex';
            document.getElementById('nav-casino').style.display = 'flex';
            loadStudent(u); 
        }
    });

    onValue(ref(db, 'classes'), snap => {
        const clss = snap.val() || {}; let data = Object.keys(clss).map(k => ({id:k, ...clss[k]})).sort((a,b) => b.cp - a.cp);
        let hS = "", hA = "";
        data.forEach((c, i) => { hS += `<tr><td>#${i+1}</td><td>Lớp ${c.name}</td><td class="text-gold">${c.cp}</td></tr>`; hA += `<tr><td class="text-blue">Lớp ${c.name}</td><td><input type="number" value="${c.cp}" onchange="window.upCP('${c.id}',this.value)" class="cyber-input" style="width:70px;padding:2px;text-align:center;"></td></tr>`; });
        if(document.getElementById('student-class-rank')) document.getElementById('student-class-rank').innerHTML = hS;
        if(document.getElementById('admin-class-control')) document.getElementById('admin-class-control').innerHTML = hA;
    });

    onValue(ref(db, 'users'), snap => {
        const us = snap.val() || {}; let arr = [];
        for(let id in us) if(us[id].role === 'STUDENT') arr.push({id, ...us[id]});
        arr.sort((a,b) => (Number(b.pp)||0) - (Number(a.pp)||0));
        let h = ""; arr.slice(0, 50).forEach((s, i) => h += `<tr><td>${s.id}</td><td>${s.name}</td><td class="text-gold" style="font-weight:bold; font-size:15px;">${(Number(s.pp)||0).toLocaleString()}</td></tr>`);
        if(document.getElementById('top-50-students')) document.getElementById('top-50-students').innerHTML = h;
    });

    // ==========================================
    // LẮNG NGHE TỰ ĐỘNG PVP ROOMS (LIVE FEED)
    // ==========================================
    onValue(ref(db, 'pvp_rooms'), snap => {
        const rooms = snap.val() || {};
        let liveHtml = "";
        let modalHtml = "";
        let amIPlaying = false;

        for(let k in rooms) {
            const r = rooms[k];
            const isMe = (r.creator === uid || r.joiner === uid);

            if(r.status === 'WAITING') {
                liveHtml += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding: 8px 0;">
                                <span style="font-size:12px;"><i class="fas fa-fire text-red"></i> <strong class="text-blue">${r.creatorName}</strong> gạ kèo <strong class="text-gold">${r.bet.toLocaleString()} PP</strong>!</span>
                                ${r.creator === uid ? `<span style="color:#888;font-size:11px;">[Phòng Của Bạn]</span>` : `<button onclick="pvpJoin('${k}')" class="btn-mini add" style="padding:6px 12px;">CHIẾN</button>`}
                             </div>`;

                if(r.creator === uid) {
                    modalHtml += `<div class="room-item" style="border-color:var(--neon-green);">
                                    <div><strong class="text-green">PHÒNG CỦA BẠN</strong><br><small>Đang chờ đối thủ...</small></div>
                                    <h3 class="text-gold" style="margin:0;">${r.bet.toLocaleString()} PP</h3>
                                    <button onclick="pvpCancel('${k}', ${r.bet})" class="btn-mini del" style="padding:10px;">HỦY PHÒNG</button>
                                 </div>`;
                } else {
                    modalHtml += `<div class="room-item">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <img src="${r.creatorAvatar || 'https://i.pravatar.cc/150?u=enemy'}" style="width:40px; height:40px; border-radius:50%; border:1px solid #fff;">
                                        <div><strong class="text-blue">${r.creatorName}</strong><br><small>Sẵn sàng chiến</small></div>
                                    </div>
                                    <h3 class="text-gold" style="margin:0;">${r.bet.toLocaleString()} PP</h3>
                                    <button onclick="pvpJoin('${k}')" class="btn-cyber" style="padding:10px 20px; font-size:12px;">CHIẾN</button>
                                 </div>`;
                }
            } 
            else if (r.status === 'PLAYING' && isMe) {
                amIPlaying = true;
                myCurrentPvPRoomId = k;
                const isCreator = (uid === r.creator);
                
                document.getElementById('pvp-action-area').style.display = 'none';
                document.getElementById('pvp-battle-area').style.display = 'block';
                document.getElementById('pvp-pot').innerText = `TỔNG: ${(r.bet * 2).toLocaleString()} PP`;
                document.getElementById('pvp-log-box').innerHTML = r.log || "Trận đấu bắt đầu!";
                document.getElementById('pvp-log-box').scrollTop = document.getElementById('pvp-log-box').scrollHeight;

                document.getElementById('pvp-p1-avatar').src = isCreator ? r.creatorAvatar : r.joinerAvatar;
                document.getElementById('pvp-p1-name').innerText = isCreator ? r.creatorName : r.joinerName;
                document.getElementById('pvp-p1-hp').style.width = (isCreator ? r.p1_hp : r.p2_hp) + '%';

                document.getElementById('pvp-p2-avatar').src = isCreator ? r.joinerAvatar : r.creatorAvatar;
                document.getElementById('pvp-p2-name').innerText = isCreator ? r.joinerName : r.creatorName;
                document.getElementById('pvp-p2-hp').style.width = (isCreator ? r.p2_hp : r.p1_hp) + '%';

                if(r.turn === uid) {
                    document.getElementById('pvp-controls').style.display = 'flex';
                    document.getElementById('pvp-wait-msg').style.display = 'none';
                } else {
                    document.getElementById('pvp-controls').style.display = 'none';
                    document.getElementById('pvp-wait-msg').style.display = 'block';
                }
            }
            else if (r.status === 'ENDED' && isMe) {
                amIPlaying = true;
                document.getElementById('pvp-log-box').innerHTML = r.log;
                document.getElementById('pvp-controls').style.display = 'none';
                
                if(r.winner === uid) {
                    document.getElementById('pvp-wait-msg').style.display = 'block';
                    document.getElementById('pvp-wait-msg').innerHTML = `<button onclick="pvpClaimReward('${k}', ${r.bet*2})" class="btn-cyber w-100" style="padding:15px; border-color:var(--neon-gold); color:var(--neon-gold);">🏆 [ NHẬN ${(r.bet*2).toLocaleString()} PP & ĐÓNG ] 🏆</button>`;
                } else {
                    document.getElementById('pvp-wait-msg').style.display = 'block';
                    document.getElementById('pvp-wait-msg').innerHTML = `<h3 class="text-red">BẠN ĐÃ TỬ TRẬN! MẤT SẠCH TIỀN CƯỢC.</h3><button onclick="window.closePvPModal()" class="btn-cyber w-100" style="padding:10px;">[ RỜI ĐI ]</button>`;
                }
            }
        }
        
        const liveFeedEl = document.getElementById('live-pvp-feed');
        if (liveFeedEl) liveFeedEl.innerHTML = liveHtml || `<span style="color:#555; font-size:12px; font-style:italic;">Hiện chưa có đại gia nào lên sàn...</span>`;

        if (!amIPlaying) {
            const pvpActionArea = document.getElementById('pvp-action-area');
            const pvpBattleArea = document.getElementById('pvp-battle-area');
            if(pvpActionArea) pvpActionArea.style.display = 'block';
            if(pvpBattleArea) pvpBattleArea.style.display = 'none';
            const pvpListEl = document.getElementById('pvp-list');
            if (pvpListEl) pvpListEl.innerHTML = modalHtml || `<p style="color:#888; text-align:center; margin-top:20px;">Võ đài đang trống. Hãy tạo phòng cược ngay!</p>`;
        }
    });
}

function loadStudent(u) {
    document.getElementById('display-pp').innerText = (u.pp || 0).toLocaleString();
    const tb = document.getElementById('student-grades'); tb.innerHTML = '';
    if(u.academic) {
        Object.keys(u.academic).sort().forEach(tk => {
            tb.innerHTML += `<tr class="term-group-header"><td colspan="6">${tk}</td></tr>`;
            for(let sk in u.academic[tk]) { const s = u.academic[tk][sk]; tb.innerHTML += `<tr><td>${s.name}</td><td>${s.bth}</td><td>${s.gk}</td><td>${s.ck}</td><td>${s.final}</td><td class="text-gold">${s.grade}</td></tr>`; }
        });
    }
}

// ==========================================
// 🛠️ ADMIN TOOLS & FIX LỖI TẠO QUIZ HOÀN TOÀN
// ==========================================
function loadAdmin() {
    const filter = document.getElementById('filter-class-select').value;
    // 1. Load users
    onValue(ref(db, 'users'), s => {
        let h = ""; const us = s.val() || {}; let count = 0; let arr = [];
        for(let id in us) { if(us[id].role === 'STUDENT') { if(filter !== 'ALL' && us[id].classKey !== filter) continue; arr.push({id, ...us[id]}); } }
        arr.sort((a, b) => { const classA = a.classKey || ""; const classB = b.classKey || ""; if (classA === classB) return (Number(b.pp) || 0) - (Number(a.pp) || 0); return classA.localeCompare(classB); });
        arr.forEach(u => {
            count++;
            h += `<tr><td>${u.id}</td><td><input type="text" value="${u.name}" onchange="window.upU('${u.id}','name',this.value)" class="cyber-input" style="width:70px;"></td><td><input type="text" value="${u.pass}" onchange="window.upU('${u.id}','pass',this.value)" class="cyber-input" style="width:40px;"></td><td>Y:${u.year} S:${u.sem}</td><td><select onchange="window.upC('${u.id}',this.value)" class="cyber-input">${genClassOptions(u.classKey)}</select></td><td>${(Number(u.pp)||0).toLocaleString()}</td><td><button onclick="window.addPP('${u.id}')" class="btn-mini add">+PP</button><button onclick="window.subPP('${u.id}')" class="btn-mini sub">-PP</button><button onclick="window.openGrades('${u.id}','${u.name}')" class="btn-mini add">XEM</button><button onclick="window.delU('${u.id}')" class="btn-mini del">X</button></td></tr>`;
        });
        const adminUsersElem = document.getElementById('admin-users');
        if (adminUsersElem) adminUsersElem.innerHTML = h;
        const studentCountElem = document.getElementById('student-count');
        if (studentCountElem) studentCountElem.innerText = count;
    });

    // 2. Load Quests (Hàm bị thiếu dẫn tới không hiện)
    onValue(ref(db, 'quests'), s => {
        let h = ""; const qs = s.val() || {};
        for(let id in qs) {
            const dLine = qs[id].deadline && qs[id].deadline !== 'Không có' ? ` - Hạn: ${formatDate(qs[id].deadline)}` : '';
            h += `<div style="display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid #333;"><span>${qs[id].title} <small style="color:#ff003c">${dLine}</small></span><button onclick="window.delQ('${id}')" class="btn-mini del">X</button></div>`;
        }
        const adminQuestList = document.getElementById('admin-quest-list');
        if (adminQuestList) adminQuestList.innerHTML = h;
    });

    // 3. Load Messages
    onValue(ref(db, 'messages'), s => {
        let h = ""; const ms = s.val() || {};
        for(let id in ms) {
            if(ms[id].status === 'PENDING') {
                h += `<tr><td>${ms[id].senderName}</td><td>${ms[id].targetUid}</td><td>${ms[id].reason}</td><td><button onclick="window.replyM('${id}','APPROVED')" class="btn-mini add">V</button><button onclick="window.replyM('${id}','REJECTED')" class="btn-mini del">X</button></td></tr>`;
            }
        }
        const adminMessages = document.getElementById('admin-messages');
        if (adminMessages) adminMessages.innerHTML = h;
    });
}

window.adminCreateQuest = async () => {
    const t = document.getElementById('q-title').value, q = document.getElementById('q-question').value;
    const a = document.getElementById('q-optA').value, b = document.getElementById('q-optB').value, c = document.getElementById('q-correct').value;
    
    const pp = parseInt(document.getElementById('q-pp').value) || 0;
    const pn = parseInt(document.getElementById('q-penalty').value) || 0;
    const l = parseInt(document.getElementById('q-limit').value) || 999;
    const m = parseInt(document.getElementById('q-max-attempts').value) || 1;
    const tm = parseInt(document.getElementById('q-time').value) || 0;
    const dl = document.getElementById('q-deadline').value || 'Không có';
    
    if(!t || !q || !a || !b) return window.showResult("LỖI!", "Vui lòng điền ĐẦY ĐỦ Tên, Câu hỏi, và Đáp án!", false);
    
    await set(ref(db, `quests/Q_${Date.now()}`), { 
        title:t, question:q, optA:a, optB:b, correctOpt:c, rewardPP:pp, penaltyPP:pn, 
        limit:l, maxAttempts:m, timeLimit:tm, deadline:dl, joined:0, status:'OPEN' 
    }); 
    
    window.showResult("THÀNH CÔNG", "ĐÃ ĐĂNG QUIZ MỚI LÊN HỆ THỐNG!", true);
};

window.forceInitClasses = async () => { const ups = {}; for(let y=1;y<=4;y++) ['A','B','C','D'].forEach(b => { const id=`Y${y}_${b}`; ups[`classes/${id}`] = { year:y, name:`${y}-${b}`, cp:1000 }; }); await update(ref(db, '/'), ups); window.showResult("THÀNH CÔNG", "ĐÃ RESET CHUẨN HÓA 16 LỚP!", true); };
window.addPP = async (id) => { const amt = prompt("CỘNG PP:"); if(amt && !isNaN(amt)) { const s = await get(ref(db, `users/${id}`)); await update(ref(db, `users/${id}`), { pp: (Number(s.val().pp) || 0) + parseInt(amt) }); } };
window.subPP = async (id) => { const amt = prompt("TRỪ PP:"); if(amt && !isNaN(amt)) { const s = await get(ref(db, `users/${id}`)); await update(ref(db, `users/${id}`), { pp: Math.max(0, (Number(s.val().pp) || 0) - parseInt(amt)) }); } };
window.upU = (id, k, v) => update(ref(db, `users/${id}`), { [k]: v });
window.delU = id => { if(confirm("Xóa?")) remove(ref(db, `users/${id}`)); };
window.upCP = (id, v) => update(ref(db, `classes/${id}`), { cp: parseInt(v) });
window.delQ = id => { if(confirm("Xác nhận xóa bài Quiz này?")) remove(ref(db, `quests/${id}`)); };
window.upC = async (id, ck) => { const y = parseInt(ck[1]), block = ck.split('_')[1], name = `${y}-${block}`; await update(ref(db, `users/${id}`), { classKey: ck, class: name, year: y }); };
window.changeAvatar = () => { const url = prompt("Link ảnh (URL):"); if(url) update(ref(db, `users/${uid}`), { avatar: url }); };
window.changeTeacherName = () => { const n = prompt("Tên mới:"); if(n) update(ref(db, `users/${uid}`), { name: n }); };
window.closeQuizModal = () => { if(quizTimerInterval) clearInterval(quizTimerInterval); document.getElementById('quiz-modal').style.display = 'none'; };
window.closeViewGradesModal = () => document.getElementById('view-grades-modal').style.display = 'none';
window.sendExpelRequest = async () => { const t = document.getElementById('expel-uid').value, r = document.getElementById('expel-reason').value; await set(ref(db, `messages/msg_${Date.now()}`), { senderUid: uid, senderName: (await get(ref(db, `users/${uid}`))).val().name, targetUid: t, reason: r, status: 'PENDING', adminReply: '' }); window.showResult("ĐÃ GỬI", "Gửi tố cáo thành công!", true); };
window.replyM = async (id, st) => { const r = prompt("Lý do:"); if(r!==null) await update(ref(db, `messages/${id}`), { status: st, adminReply: r }); };

window.openQuiz = async id => {
    const s = await get(ref(db, `quests/${id}`)); const q = s.val();
    if(q.deadline && q.deadline !== 'Không có' && new Date() > new Date(q.deadline + "T23:59:59")) return window.showResult("QUÁ HẠN", "BÀI NÀY ĐÃ HẾT HẠN LÀM!", false);
    const maxAtt = q.maxAttempts || 1; const att = q.attempts?.[uid] || 0; 
    if(att >= maxAtt) return window.showResult("HẾT LƯỢT", "BẠN KHÔNG CÒN LƯỢT LÀM BÀI NÀY!", false);
    
    activeQuizId = id; document.getElementById('quiz-title').innerText = q.title; document.getElementById('quiz-question').innerText = q.question;
    document.getElementById('quiz-optA').innerText = q.optA; document.getElementById('quiz-optB').innerText = q.optB;
    document.getElementById('quiz-info').innerText = `Phạt: ${q.penaltyPP} PP | Lượt: ${att}/${maxAtt}`;
    
    const tl = q.timeLimit || 0;
    if(tl > 0) { let timeLeft = tl; document.getElementById('quiz-timer').innerText = `🕒 ${timeLeft}s`; if(quizTimerInterval) clearInterval(quizTimerInterval);
        quizTimerInterval = setInterval(() => { timeLeft--; document.getElementById('quiz-timer').innerText = `🕒 ${timeLeft}s`; if(timeLeft <= 0) { clearInterval(quizTimerInterval); window.submitQuiz('TIMEOUT'); } }, 1000);
    } else { document.getElementById('quiz-timer').innerText = ''; }
    document.getElementById('quiz-modal').style.display = 'flex';
};

window.submitQuiz = async opt => {
    if(quizTimerInterval) clearInterval(quizTimerInterval);
    const qS = await get(ref(db, `quests/${activeQuizId}`)); const q = qS.val();
    const att = q.attempts?.[uid] || 0; 
    await update(ref(db, `quests/${activeQuizId}`), { [`attempts/${uid}`]: att + 1 });
    
    const uS = await get(ref(db, `users/${uid}`)); const u = uS.val(); const currentPP = Number(u.pp) || 0;
    if (opt === 'TIMEOUT') { await update(ref(db, `users/${uid}`), { pp: Math.max(0, currentPP - q.penaltyPP) }); window.showResult("HẾT GIỜ!", `Bạn bị phạt ${q.penaltyPP} PP!`, false); } 
    else if(opt === q.correctOpt) { await update(ref(db, `users/${uid}`), { pp: currentPP + q.rewardPP }); window.showResult("CHÍNH XÁC!", `Bạn được cộng ${q.rewardPP} PP!`, true); } 
    else { await update(ref(db, `users/${uid}`), { pp: Math.max(0, currentPP - q.penaltyPP) }); window.showResult("SAI RỒI!", `Bạn bị phạt ${q.penaltyPP} PP!`, false); }
    window.closeQuizModal();
};

window.openGrades = async (id, n) => {
    document.getElementById('view-grades-student-name').innerText = n; const s = await get(ref(db, `users/${id}/academic`)); const tb = document.getElementById('admin-view-grades-body'); tb.innerHTML = '';
    if(s.exists()) { Object.keys(s.val()).forEach(tk => { for(let sk in s.val()[tk]) { const m = s.val()[tk][sk]; tb.innerHTML += `<tr><td>${tk}</td><td>${m.name}</td><td><input type="number" id="b_${sk}" value="${m.bth}" style="width:35px;"></td><td><input type="number" id="g_${sk}" value="${m.gk}" style="width:35px;"></td><td><input type="number" id="c_${sk}" value="${m.ck}" style="width:35px;"></td><td>${m.final}</td><td><button onclick="window.saveG('${id}','${tk}','${sk}')" class="btn-mini add">OK</button></td></tr>`; } }); }
    document.getElementById('view-grades-modal').style.display = 'flex';
};
window.saveG = async (u, tk, sk) => { const b = parseFloat(document.getElementById(`b_${sk}`).value)||0, g = parseFloat(document.getElementById(`g_${sk}`).value)||0, c = parseFloat(document.getElementById(`c_${sk}`).value)||0; const f = Math.round(((b*1+g*2+c*3)/6)*10)/10, gr = f>=8.5?'A':f>=7?'B':f>=5.5?'C':f>=4?'D':'F'; await update(ref(db, `users/${u}/academic/${tk}/${sk}`), { bth:b, gk:g, ck:c, final:f, grade:gr }); alert("LƯU!"); };

// ==========================================
// ⚔️ NEON ARENA (PvP REALTIME ĐỐI MẶT)
// ==========================================
window.openPvPModal = () => { document.getElementById('pvp-modal').style.display = 'flex'; };
window.closePvPModal = () => { document.getElementById('pvp-modal').style.display = 'none'; myCurrentPvPRoomId = null; };

window.pvpCreate = async () => {
    let bet = prompt("Nhập số PP bạn muốn đem vào Võ Đài:");
    if(!bet) return; bet = parseInt(bet);
    if(isNaN(bet) || bet <= 0) return window.showResult("LỖI", "Số cược không hợp lệ!", false);

    const snap = await get(ref(db, `users/${uid}`)); const u = snap.val();
    if((Number(u.pp)||0) < bet) return window.showResult("NGHÈO", "Bạn không đủ PP để tạo phòng này!", false);

    await update(ref(db, `users/${uid}`), { pp: (Number(u.pp)||0) - bet });
    const roomId = `PVP_${Date.now()}`;
    await set(ref(db, `pvp_rooms/${roomId}`), { 
        creator: uid, creatorName: u.name, creatorAvatar: u.avatar || 'https://i.pravatar.cc/150',
        bet: bet, status: 'WAITING', timestamp: Date.now() 
    });
};

window.pvpCancel = async (roomId, bet) => {
    const snap = await get(ref(db, `users/${uid}`));
    await update(ref(db, `users/${uid}`), { pp: (Number(snap.val().pp)||0) + bet });
    await remove(ref(db, `pvp_rooms/${roomId}`));
    window.showResult("ĐÃ HỦY", `Gỡ phòng thành công. Đã hoàn trả ${bet.toLocaleString()} PP.`, true);
};

window.pvpJoin = async (roomId) => {
    const rSnap = await get(ref(db, `pvp_rooms/${roomId}`)); const room = rSnap.val();
    if(!room || room.status !== 'WAITING') return window.showResult("LỖI", "Phòng đã bị hủy hoặc đang chiến!", false);
    
    const snap = await get(ref(db, `users/${uid}`)); const u = snap.val();
    if((Number(u.pp)||0) < room.bet) return window.showResult("NGHÈO", `Bạn cần ${room.bet.toLocaleString()} PP để tham gia!`, false);

    await update(ref(db, `users/${uid}`), { pp: (Number(u.pp)||0) - room.bet });
    await update(ref(db, `pvp_rooms/${roomId}`), {
        status: 'PLAYING',
        joiner: uid, joinerName: u.name, joinerAvatar: u.avatar || 'https://i.pravatar.cc/150',
        p1_hp: 100, p2_hp: 100, turn: room.creator,
        log: `<br>💥 Trận đấu sinh tử bắt đầu!\nLượt đầu tiên thuộc về: ${room.creatorName}.`
    });
};

window.pvpAction = async (type) => {
    if(!myCurrentPvPRoomId) return;
    const rSnap = await get(ref(db, `pvp_rooms/${myCurrentPvPRoomId}`));
    const room = rSnap.val();
    if(!room || room.status !== 'PLAYING' || room.turn !== uid) return;

    const isCreator = (uid === room.creator);
    let myHp = isCreator ? room.p1_hp : room.p2_hp;
    let enemyHp = isCreator ? room.p2_hp : room.p1_hp;
    const enemyUid = isCreator ? room.joiner : room.creator;
    const myName = isCreator ? room.creatorName : room.joinerName;
    const enemyName = isCreator ? room.joinerName : room.creatorName;

    let logAdd = "";
    if (type === 'ATTACK') {
        const dmg = Math.floor(Math.random()*11) + 15; // 15 - 25
        enemyHp -= dmg;
        logAdd = `<br>🗡️ <b>${myName}</b> chém thường, gây <b style="color:#ff4500;">${dmg}</b> sát thương!`;
    } else if (type === 'HEAVY') {
        if(Math.random() < 0.5) {
            logAdd = `<br>💨 <b>${myName}</b> tung Chí Mạng... nhưng bị TRƯỢT!`;
        } else {
            const dmg = Math.floor(Math.random()*16) + 30; // 30 - 45
            enemyHp -= dmg;
            logAdd = `<br>⚡ <b>${myName}</b> tung CHÍ MẠNG, gây <b style="color:var(--neon-pink);">${dmg}</b> sát thương!`;
        }
    } else if (type === 'HEAL') {
        const heal = Math.floor(Math.random()*16) + 20; // 20 - 35
        myHp = Math.min(100, myHp + heal);
        logAdd = `<br>🛡️ <b>${myName}</b> lùi lại uống thuốc, hồi <b style="color:var(--neon-green);">${heal}</b> máu!`;
    }

    if (enemyHp <= 0) {
        enemyHp = 0;
        logAdd += `<br><br>☠️ <b>${enemyName}</b> ĐÃ GỤC NGÃ!\n🏆 <b>${myName}</b> CHIẾN THẮNG ÁP ĐẢO!`;
        await update(ref(db, `pvp_rooms/${myCurrentPvPRoomId}`), {
            p1_hp: isCreator ? myHp : enemyHp, p2_hp: isCreator ? enemyHp : myHp,
            log: room.log + logAdd, status: 'ENDED', winner: uid
        });
    } else {
        await update(ref(db, `pvp_rooms/${myCurrentPvPRoomId}`), {
            p1_hp: isCreator ? myHp : enemyHp, p2_hp: isCreator ? enemyHp : myHp,
            log: room.log + logAdd, turn: enemyUid
        });
    }
};

window.pvpClaimReward = async (roomId, reward) => {
    const snap = await get(ref(db, `users/${uid}`));
    await update(ref(db, `users/${uid}`), { pp: (Number(snap.val().pp)||0) + reward });
    await remove(ref(db, `pvp_rooms/${roomId}`));
    window.closePvPModal();
    window.showResult("ĐẠI GIA LÊN SÀN", `Hốt trọn ${reward.toLocaleString()} PP từ kẻ thua cuộc!`, true);
};

// ==========================================
// 🎲 LAS VEGAS ZONE (CORE ENGINE & 40 GAMES)
// ==========================================
async function executeBet(gameName, logicCallback) {
    let bet = prompt(`[ ${gameName} ]\nNhập số PP bạn muốn đặt cược:`);
    if(!bet) return; bet = parseInt(bet);
    if(isNaN(bet) || bet <= 0) return window.showResult("LỖI", "Số cược không hợp lệ!", false);

    const snap = await get(ref(db, `users/${uid}`));
    const u = snap.val(); const currentPP = Number(u.pp) || 0;
    
    if(currentPP < bet) return window.showResult("NGHÈO", `Bạn chỉ có ${currentPP.toLocaleString()} PP. Không đủ cược!`, false);

    const res = await logicCallback(bet, currentPP);
    if(res === null) return; 

    const { payout, message, title, isWin } = res;
    const freshSnap = await get(ref(db, `users/${uid}`));
    const freshPP = Number(freshSnap.val().pp) || 0;

    await update(ref(db, `users/${uid}`), { pp: freshPP + payout });
    window.showResult(title, `${message}\n\n=> PP HIỆN TẠI: ${(freshPP + payout).toLocaleString()}`, isWin);
}

// 5 GAME ĐẶC BIỆT TƯƠNG TÁC
window.playCrypto = () => executeBet("ĐẦU TƯ CRYPTO", async (bet) => {
    let currentVal = bet, month = 1, crashed = false;
    while(month <= 5) {
        const multiplier = (Math.random() * 2.5 + 0.1).toFixed(2);
        currentVal = Math.floor(currentVal * multiplier);
        if (currentVal < bet * 0.15) { crashed = true; break; }
        const choice = confirm(`📊 THÁNG ${month}/5:\nGiá trị tài sản: ${currentVal.toLocaleString()} PP (Hệ số x${multiplier})\n\n[OK] = GỒNG LÃI (Qua tháng sau)\n[CANCEL] = CHỐT LỜI NGAY!`);
        if (!choice) { const profit = currentVal - bet; return { payout: profit, message: `Bạn đã chốt lời ở Tháng ${month}!\nThu về: ${currentVal.toLocaleString()} PP.`, title: profit >= 0 ? "CHỐT LỜI" : "CẮT LỖ", isWin: profit >= 0 }; }
        month++;
    }
    if (crashed) return { payout: -bet, message: `Thị trường SỤP ĐỔ ở tháng ${month}!\nTài sản bay màu. Bạn mất sạch ${bet.toLocaleString()} PP!`, title: "CHÁY TÀI KHOẢN", isWin: false };
    const profit = currentVal - bet; return { payout: profit, message: `CHÚC MỪNG DIAMOND HANDS! 💎🙌\nĐã gồng qua 5 tháng. Thu về: ${currentVal.toLocaleString()} PP!`, title: "THÀNH TỶ PHÚ", isWin: true };
});

window.playSquidGame = () => executeBet("CẦU KÍNH SQUID GAME", async (bet) => {
    let step = 1;
    while(step <= 5) {
        let choice = prompt(`🌉 BƯỚC ${step}/5:\nCó 2 tấm kính. Nhập T (Trái) hoặc P (Phải):`);
        if(!choice) return { payout: -bet, message: `Bạn đã bỏ cuộc giữa chừng và rơi xuống vực.\nMất sạch ${bet.toLocaleString()} PP!`, title: "CHẾT NHÁT", isWin: false };
        choice = choice.toUpperCase(); if(choice !== 'T' && choice !== 'P') { alert("Chỉ nhập T hoặc P."); continue; }
        const isSafe = Math.random() < 0.40; 
        if (isSafe) { alert(`Bước ${step} AN TOÀN! Tấm kính không vỡ.`); step++; } 
        else return { payout: -bet, message: `RẮC... XOẢNG!!! 🩸\nTấm kính vỡ ở bước ${step}.\nMất ${bet.toLocaleString()} PP!`, title: "RƠI XUỐNG VỰC", isWin: false };
    }
    return { payout: bet * 20, message: `VƯỢT QUA CẦU KÍNH THÀNH CÔNG!!!\nBạn đã sống sót. Thắng ${(bet*20).toLocaleString()} PP!`, title: "NGƯỜI CHIẾN THẮNG", isWin: true };
});

window.playBossRaid = () => executeBet("SĂN BOSS VỰC", async (bet) => {
    let playerHp = bet * 3, bossHp = bet * 5;
    alert(`🗡️ BẠN MUA VŨ KHÍ GIÁ ${bet.toLocaleString()} PP!\nBước vào Vực sâu đối đầu Ma Vương!`);
    while (playerHp > 0 && bossHp > 0) {
        const action = confirm(`🔥 MÁU BOSS: ${bossHp.toLocaleString()}\n🛡️ MÁU BẠN: ${playerHp.toLocaleString()}\n\n[OK] = CHÉM TIẾP!\n[CANCEL] = BỎ CHẠY (Giữ lại nửa tiền)`);
        if (!action) return { payout: -Math.floor(bet/2), message: `Bạn đã hèn nhát bỏ chạy.\nBảo toàn mạng sống, mất ${(Math.floor(bet/2)).toLocaleString()} PP.`, title: "BỎ CHẠY", isWin: false };
        const pDmg = Math.floor(bet * (Math.random() + 0.4)), bDmg = Math.floor(bet * (Math.random() + 0.7)); 
        bossHp -= pDmg; if(bossHp <= 0) break;
        playerHp -= bDmg; alert(`💥 Bạn chém Boss mất ${pDmg.toLocaleString()} HP!\n🩸 Boss tát lại bạn mất ${bDmg.toLocaleString()} HP!`);
    }
    if (playerHp <= 0) return { payout: -bet, message: `WAASTED... BẠN ĐÃ TỬ TRẬN!\nMa Vương quá mạnh. Mất ${bet.toLocaleString()} PP.`, title: "TỬ TRẬN", isWin: false };
    return { payout: bet * 3, message: `BOSS ĐÃ BỊ TIÊU DIỆT!!! 🏆\nRớt rương báu, nhận ${(bet*3).toLocaleString()} PP!`, title: "DIỆT MA VƯƠNG", isWin: true };
});

window.playMinesweeper = () => executeBet("MÁY DÒ MÌN", async (bet) => {
    let guess = prompt(`Nhập 3 ô số (từ 1 đến 10) AN TOÀN.\nVí dụ nhập: 2, 5, 9`);
    if(!guess) return null;
    let pCells = guess.split(',').map(s => parseInt(s.trim()));
    if(pCells.length !== 3 || pCells.some(n => isNaN(n) || n<1 || n>10)) { alert("Lỗi định dạng!"); return null; }
    let mines = []; while(mines.length < 4) { let m = Math.floor(Math.random()*10)+1; if(!mines.includes(m)) mines.push(m); } 
    let hitMines = pCells.filter(c => mines.includes(c));
    if (hitMines.length > 0) return { payout: -bet, message: `BÙMMM!!! 💥\nBãi mìn ở ô: [ ${mines.join(', ')} ]\nBạn đạp trúng ô ${hitMines[0]}! Mất ${bet.toLocaleString()} PP!`, title: "ĐẠP MÌN", isWin: false };
    return { payout: bet * 5, message: `AN TOÀN!!!\nBãi mìn ở ô: [ ${mines.join(', ')} ]\nCả 3 ô của bạn đều trống. Nhận ${(bet*5).toLocaleString()} PP!`, title: "CHUYÊN GIA", isWin: true };
});

window.playAuction = () => executeBet("ĐẤU GIÁ RƯƠNG", async (bet) => {
    const realValue = Math.floor(Math.random() * 99000) + 1000;
    const botThreshold = Math.floor(realValue * (Math.random() * 0.9 + 0.4)); 
    let bid = prompt(`Hệ thống đang sở hữu 1 RƯƠNG BÍ ẨN.\nCó thể chứa từ 1k đến 100k PP.\n\nBạn muốn đấu giá mua rương này bao nhiêu PP?`);
    if(!bid) return null; bid = parseInt(bid); if(isNaN(bid) || bid <= 0) return null;
    if (bid < botThreshold) return { payout: 0, message: `Mức giá của bạn là ${bid.toLocaleString()} PP.\nHệ Thống chê rẻ không bán!\n(Tiết lộ: Rương chứa ${realValue.toLocaleString()} PP).`, title: "KHÔNG KHỚP LỆNH", isWin: true };
    const netProfit = realValue - bid;
    if (netProfit >= 0) return { payout: netProfit, message: `BÚA GÕ! ĐÃ BÁN! 🔨\nBạn mua giá ${bid.toLocaleString()} PP.\nMở ra: ${realValue.toLocaleString()} PP!\nBạn LỜI ${netProfit.toLocaleString()} PP!`, title: "ĐỒ CỔ THẬT", isWin: true };
    return { payout: netProfit, message: `BÚA GÕ! ĐÃ BÁN! 🔨\nBạn mua giá ${bid.toLocaleString()} PP.\nMở ra: ${realValue.toLocaleString()} PP!\nBạn BỊ HỚ mất ${(netProfit * -1).toLocaleString()} PP!`, title: "BỊ LỪA", isWin: false };
});


// CÁC GAME ĐÃ NERF NHƯ SÒNG BÀI THẬT
window.rollGacha = async () => { const snap = await get(ref(db, `users/${uid}`)); const c = Number(snap.val().pp) || 0; if(c < 5000) return window.showResult("NGHÈO", "Bạn không đủ 5,000 PP!", false); const r = Math.random()*100; let n = c - 5000, m = "Trắng tay... Bạn mất 5,000 PP 💀", t = "BAY MÀU", win = false; if(r > 98) { n += 50000; m = "Trúng 50,000 PP 🎉"; t = "JACKPOT!!!"; win = true; } else if(r > 88) { n += 10000; m = "Lời 10,000 PP 💵"; t = "X2 TÀI SẢN"; win = true; } await update(ref(db, `users/${uid}`), { pp: n }); window.showResult(t, m, win); };
window.playSlot = () => executeBet("SLOT", (b) => { const s=['🍒','🍋','🔔','💎','🍉','💀','💩','🎱']; const r1=s[Math.floor(Math.random()*8)], r2=s[Math.floor(Math.random()*8)], r3=s[Math.floor(Math.random()*8)], res=`[ ${r1} | ${r2} | ${r3} ]`; if(r1===r2&&r2===r3) return {payout:b*10, message:`${res}\nNỔ HŨ X10! Trúng ${(b*10).toLocaleString()} PP!`, title:"JACKPOT", isWin:true}; if(r1===r2||r2===r3||r1===r3) return {payout:b, message:`${res}\nTRÚNG CẶP! X2 Tài sản!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`${res}\nTRẬT LẤT! Mất ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playCocktail = () => executeBet("COCKTAIL ĐỘC", (b) => { const p = Math.floor(Math.random()*6); if(p===0 || p===1) return {payout:-b, message:`LY CÓ ĐỘC! (Tỉ lệ chết 33%)\nMất sạch ${b.toLocaleString()} PP!`, title:"TỬ VONG", isWin:false}; return {payout:Math.floor(b*0.2), message:`An toàn! Lời ${(Math.floor(b*0.2)).toLocaleString()} PP!`, title:"NGON MIỆNG", isWin:true}; });
window.playDarts = () => executeBet("PHI TIÊU", (b) => { const s = Math.floor(Math.random()*100)+1; if(s>96) return {payout:b*4, message:`Hồng tâm (${s}đ)! Trúng ${(b*4).toLocaleString()} PP!`, title:"XUẤT THẦN", isWin:true}; if(s>60) return {payout:b, message:`Trúng bảng (${s}đ)! X2 tiền!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Phóng trượt (${s}đ)! Mất ${b.toLocaleString()} PP!`, title:"TRƯỢT", isWin:false}; });
window.playRussianRoulette = () => executeBet("CÒ QUAY NGA", (b) => { if(Math.random()<0.25) return {payout:-b, message:`ĐÙNG!!! Súng nổ (25% chết)!\nMất sạch ${b.toLocaleString()} PP.`, title:"CHẾT RỒI", isWin:false}; return {payout:b*4, message:`Súng không nổ! Sống sót nhận ${(b*4).toLocaleString()} PP!`, title:"BẢN LĨNH", isWin:true}; });
window.playXocDia = (c) => executeBet("XÓC ĐĨA", (b) => { if(Math.random()<0.1) return {payout:-b, message:`Nhà cái giở trò bịp bợm bẻ kèo!\nBạn mất trắng ${b.toLocaleString()} PP!`, title:"BỊ BỊP", isWin:false}; const rC=Array(4).fill().filter(()=>Math.random()>0.5).length, res=(rC%2===0)?'CHAN':'LE'; if(c===res) return {payout:b, message:`Mở bát: ${rC} ĐỎ (${res==='CHAN'?'CHẴN':'LẺ'}).\nThắng ${b.toLocaleString()} PP!`, title:"HÚP TIỀN", isWin:true}; return {payout:-b, message:`Mở bát: ${rC} ĐỎ.\nThua ${b.toLocaleString()} PP!`, title:"THUA SẠCH", isWin:false}; });
window.playBaccarat = (c) => executeBet("BACCARAT", (b) => { const p=Math.floor(Math.random()*10), k=Math.floor(Math.random()*10), win=p>k?'PLAYER':(k>p?'BANKER':'TIE'); if(win==='TIE') return {payout:-(Math.floor(b*0.1)), message:`Con: ${p} | Cái: ${k}\nHÒA NHAU! Nhà cái thu 10% phế.`, title:"HÒA", isWin:false}; if(c===win) return {payout:b, message:`Con: ${p} | Cái: ${k}\nĐOÁN ĐÚNG! Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Con: ${p} | Cái: ${k}\nĐOÁN SAI! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playBlackjack = () => executeBet("BLACKJACK 21", (b) => { const gS=()=>Math.random()<0.35?22:Math.floor(Math.random()*6)+16, pS=gS(), dS=gS(); if(pS>21) return {payout:-b, message:`Bạn 22 điểm (Dễ Quắc)!\nMất ${b.toLocaleString()} PP.`, title:"QUẮC", isWin:false}; if(dS>21) return {payout:b, message:`Bạn: ${pS} | Nhà cái: Quắc!\nThắng ${b.toLocaleString()} PP.`, title:"NHÀ CÁI QUẮC", isWin:true}; if(pS===dS) return {payout:0, message:`Cùng ${pS} điểm. Hòa tiền.`, title:"HÒA", isWin:true}; if(pS>dS) return {payout:b, message:`Bạn: ${pS} | Nhà cái: ${dS}\nThắng ${b.toLocaleString()} PP!`, title:"THẮNG 21", isWin:true}; return {payout:-b, message:`Bạn: ${pS} | Nhà cái: ${dS}\nThua ${b.toLocaleString()} PP!`, title:"THUA RỒI", isWin:false}; });
window.playBilliards = () => executeBet("BIDA", (b) => { if(Math.random()<0.25) return {payout:Math.floor(b*1.5), message:`Bi vào lỗ (Chỉ 25% trúng)!\nThắng ${(Math.floor(b*1.5)).toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Bi văng ra ngoài.\nThua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playSafe = () => executeBet("MỞ KÉT SẮT", (b) => { let g=prompt("Mã két (000-999):"); if(!g||g.length!==3) return null; const s=Math.floor(Math.random()*1000).toString().padStart(3,'0'); if(g===s) return {payout:b*20, message:`Mã: ${s}\nMỞ THÀNH CÔNG! Trúng ${(b*20).toLocaleString()} PP!`, title:"TRỘM KÉT", isWin:true}; return {payout:-b, message:`Mã: ${s}\nCòi báo động! Mất ${b.toLocaleString()} PP!`, title:"BỊ BẮT", isWin:false}; });
window.playFish = async () => { const snap = await get(ref(db, `users/${uid}`)); const c = Number(snap.val().pp)||0; if(c<10000) return window.showResult("NGHÈO", "Bạn không đủ 10k PP đạn!", false); const r=Math.random(); let n=c-10000, m="Bắn trượt! Mất 10,000 PP 💀", t="TRƯỢT", win=false; if(r<0.005) {n+=500000; m="HẠ CÁ MẬP VÀNG (+500k PP) 🦈"; t="BÙM CHÍU"; win=true;} else if(r<0.05) {n+=100000; m="TRÚNG RÙA THẦN (+100k PP) 🐢"; t="TRÚNG LỚN"; win=true;} else if(r<0.2) {n+=30000; m="Đàn cá nhỏ (+30k PP) 🐟"; t="CÓ LÃI"; win=true;} await update(ref(db, `users/${uid}`), { pp: n }); window.showResult(t, m, win); };
window.playBomb = () => executeBet("BOM HẸN GIỜ", (b) => { const c=prompt("Cắt: ĐỎ, XANH, VÀNG?"); if(!c||!['ĐỎ','XANH','VÀNG'].includes(c.toUpperCase()))return null; const bm=['ĐỎ','XANH','VÀNG'][Math.floor(Math.random()*3)]; if(c.toUpperCase()===bm) return {payout:-b, message:`CẮT NHẦM DÂY!\nMất sạch ${b.toLocaleString()} PP!`, title:"BÙMMM!!!", isWin:false}; return {payout:Math.floor(b*0.5), message:`Bom đã tắt (Dây nổ là ${bm}).\nĐược thưởng ${(Math.floor(b*0.5)).toLocaleString()} PP!`, title:"SỐNG SÓT", isWin:true}; });
window.playRace = () => executeBet("ĐUA XE", (b) => { let c=parseInt(prompt("Chọn xe Vàng (1), Đỏ (2), Xanh (3):")); if(isNaN(c)||c<1||c>3)return null; let w=Math.floor(Math.random()*3)+1; if(Math.random()<0.2 && c===w) { w=(w%3)+1; } if(c===w) return {payout:b*2, message:`Xe số ${w} về nhất!\nThắng ${(b*2).toLocaleString()} PP!`, title:"VÔ ĐỊCH", isWin:true}; return {payout:-b, message:`Xe ${w} về nhất! Xe bạn đâm cột điện.\nThua ${b.toLocaleString()} PP!`, title:"TẠI NẠN", isWin:false}; });
window.coinFlip = (c) => executeBet("ĐỒNG XU", (b) => { const isWin = Math.random() < 0.40; return isWin ? {payout:b, message:`Trời độ bạn! Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true} : {payout:-b, message:`Đồng xu lật ngược phút cuối! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playTaiXiu = (c) => executeBet("TÀI XỈU", (b) => { if(Math.random()<0.08) return {payout:-b, message:`Nhà cái lật lọng thu hết bàn!\nMất ${b.toLocaleString()} PP!`, title:"NHÀ CÁI HÚP", isWin:false}; const s = Math.floor(Math.random()*6)+Math.floor(Math.random()*6)+Math.floor(Math.random()*6)+3, r=(s>=11&&s<=17)?'TAI':'XIU'; if(s===3||s===18) return {payout:-b, message:`BÃO (${s})! Nhà cái thu hết.\nMất ${b.toLocaleString()} PP!`, title:"BÃO!", isWin:false}; if(c===r) return {payout:b, message:`Tổng ${s} (${r==='TAI'?'TÀI':'XỈU'}). Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Tổng ${s} (${r==='TAI'?'TÀI':'XỈU'}). Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playChanLe = (c) => executeBet("CHẴN LẺ", (b) => { if(Math.random()<0.08) return {payout:-b, message:`Cái giở trò bịp. Thua ${b.toLocaleString()} PP!`, title:"BỊP", isWin:false}; const d = Math.floor(Math.random()*6)+1, r=d%2===0?'CHAN':'LE'; return c===r ? {payout:b, message:`Ra số ${d}! Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true} : {payout:-b, message:`Ra số ${d}! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playRoulette = (c) => executeBet("ROULETTE", (b) => { const r = Math.random(); let rs='BLACK', m=2, n="ĐEN"; if(r<0.02){rs='GREEN';m=14;n="XANH LÁ";}else if(r<0.42){rs='RED';m=2;n="ĐỎ";} return c===rs ? {payout:b*(m-1), message:`Bóng rơi vào ô ${n}!\nThắng ${(b*(m-1)).toLocaleString()} PP!`, title:"THẮNG LỚN", isWin:true} : {payout:-b, message:`Bóng rơi vào ô ${n}! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playTerminal = () => executeBet("HACK TERMINAL", (b) => { let n=parseInt(prompt("Mã (1-10):")); if(isNaN(n))return null; const s=Math.floor(Math.random()*12)+1; return n===s ? {payout:b*8, message:`Mã là ${s}! Trúng ${(b*8).toLocaleString()} PP!`, title:"HACKER ĐỈNH", isWin:true} : {payout:-b, message:`Mã là ${s}! Bị phát hiện. Mất ${b.toLocaleString()} PP!`, title:"THẤT BẠI", isWin:false}; });
window.playWheel = () => executeBet("NÓN KỲ DIỆU", (b) => { const m=[0, 0, 0, 0.5, 1.5, 2][Math.floor(Math.random()*6)], df=Math.floor(b*m)-b; if(df>0) return {payout:df, message:`Vào ô x${m}! Lời ${df.toLocaleString()} PP!`, title:"LỜI RỒI", isWin:true}; if(df===0) return {payout:0, message:`Vào ô x1! Hòa vốn.`, title:"HÒA", isWin:true}; return {payout:df, message:`Vào ô x${m}! Lỗ ${(df*-1).toLocaleString()} PP!`, title:"LỖ", isWin:false}; });
window.playHighLow = (c) => executeBet("BÀI LỚN NHỎ", (b) => { const p=Math.floor(Math.random()*13)+1, s=Math.floor(Math.random()*13)+1; if(p===s) return {payout:Math.floor(-b*0.5), message:`Bạn: ${p} | Máy: ${s}. Hòa bài nhưng nhà cái thu phế nửa tiền!`, title:"HÒA LỖ", isWin:false}; if((c==='HIGH'&&p>s)||(c==='LOW'&&p<s)) return {payout:b, message:`Bạn: ${p} | Máy: ${s}. Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Bạn: ${p} | Máy: ${s}. Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playHorse = (c) => executeBet("ĐUA NGỰA", (b) => { let w=Math.floor(Math.random()*3)+1; if(Math.random()<0.15 && c===w) w=(w%3)+1; return c===w ? {payout:b*2, message:`Ngựa ${w} Về Nhất! Thắng ${(b*2).toLocaleString()} PP!`, title:"THẮNG", isWin:true} : {payout:-b, message:`Ngựa ${w} Về Nhất! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playBauCua = () => executeBet("BẦU CUA", (b) => { const c=document.getElementById('baucua-choice').value, r=['BAU','CUA','TOM','CA','GA','NAI'][Math.floor(Math.random()*7)===6?Math.floor(Math.random()*6):Math.floor(Math.random()*5)]; return c===r ? {payout:b*4, message:`Mở ra ${r}! Thắng ${(b*4).toLocaleString()} PP!`, title:"THẮNG x5", isWin:true} : {payout:-b, message:`Mở ra ${r}! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playSpaceBauCua = () => executeBet("BẦU CUA VŨ TRỤ", (b) => { const c=document.getElementById('baucua-choice').value, i=['BAU','CUA','TOM','CA','GA','NAI'], d1=i[Math.floor(Math.random()*6)], d2=i[Math.floor(Math.random()*6)], d3=i[Math.floor(Math.random()*6)]; let k=0; if(d1===c)k++; if(d2===c)k++; if(d3===c)k++; if(k>0) return {payout:b*(k*2), message:`Ra: ${d1}, ${d2}, ${d3}.\nTrúng ${k} con! Thắng ${(b*(k*2)).toLocaleString()} PP!`, title:"ĂN ĐẬM", isWin:true}; return {payout:-b, message:`Ra: ${d1}, ${d2}, ${d3}. Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playChest = (c) => executeBet("RƯƠNG TỬ THẦN", (b) => { const bm=Math.floor(Math.random()*3)+1; return c===bm ? {payout:-b, message:`Rương ${bm} là Bom! Mất sạch ${b.toLocaleString()} PP!`, title:"NỔ TUNG", isWin:false} : {payout:Math.floor(b*0.5), message:`An toàn! Rương ${bm} là bom. Nhận ${(Math.floor(b*0.5)).toLocaleString()} PP!`, title:"SỐNG SÓT", isWin:true}; });
window.playLottery = () => executeBet("XỔ SỐ", (b) => { const n=parseInt(prompt("Vé (00-99):")); if(isNaN(n))return null; const s=Math.floor(Math.random()*110); return n===s ? {payout:b*70, message:`Kết quả: ${s}!\nTRÚNG ${(b*70).toLocaleString()} PP!`, title:"ĐỘC ĐẮC", isWin:true} : {payout:-b, message:`Kết quả: ${s}. Trật lất! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playKeno = () => executeBet("KENO", (b) => { let g=parseInt(prompt("Bi (1-20):")); if(isNaN(g)||g<1||g>20) return null; const s=Math.floor(Math.random()*22)+1; if(g===s) return {payout:b*10, message:`Bi rớt vào ${s}! Thắng ${(b*10).toLocaleString()} PP!`, title:"TIÊN TRI", isWin:true}; return {payout:-b, message:`Bi rớt vào ${s}. Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playMine = () => executeBet("ĐÀO ĐÁ QUÝ", (b) => { if(Math.random()<0.40) return {payout:-b, message:`Cuốc trúng Bom! Mất ${b.toLocaleString()} PP!`, title:"NỔ BANH XÁC", isWin:false}; return {payout:Math.floor(b*0.2), message:`Đào được Thạch Anh. Lời ${(Math.floor(b*0.2)).toLocaleString()} PP!`, title:"THỢ MỎ", isWin:true}; });
window.rpsGame = (c) => executeBet("KÉO BÚA BAO", (b) => { if(Math.random()<0.25) return {payout:-b, message:`Máy nhìn trộm và ra đòn khắc chế! Bạn thua ${b.toLocaleString()} PP!`, title:"BỊP BỢM", isWin:false}; const s=['KEO','BUA','BAO'][Math.floor(Math.random()*3)]; if(c===s) return {payout:0, message:`Máy ra ${s}. HÒA!`, title:"HÒA", isWin:true}; if((c==='KEO'&&s==='BAO')||(c==='BUA'&&s==='KEO')||(c==='BAO'&&s==='BUA')) return {payout:b, message:`Máy ra ${s}. Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Máy ra ${s}. Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playZodiac = () => executeBet("HOÀNG ĐẠO", (b) => { const s=Math.floor(Math.random()*14)+1; let g=parseInt(prompt("Cung (1-12):")); if(isNaN(g)||g<1||g>12) return null; if(g===s) return {payout:b*9, message:`Kim vào cung ${s}! Thắng ${(b*9).toLocaleString()} PP!`, title:"CHIÊM TINH", isWin:true}; return {payout:-b, message:`Kim vào cung ${s}. Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playCockfight = (c) => executeBet("ĐÁ GÀ", (b) => { const w = Math.random()>0.6? (c==='RED'?'BLUE':'RED') : c; if(c===w) return {payout:b, message:`Gà của bạn tung cú đá hiểm hóc thắng!\nĂn ${b.toLocaleString()} PP!`, title:"THẮNG LỚN", isWin:true}; return {payout:-b, message:`Gà của bạn gãy giò bị hạ gục. Mất ${b.toLocaleString()} PP!`, title:"THUA SẠCH", isWin:false}; });
window.playPenalty = (c) => executeBet("SÚT PENALTY", (b) => { if(Math.random()<0.7) return {payout:-b, message:`Thủ môn bắt dính bóng!\nThua ${b.toLocaleString()} PP!`, title:"HỎNG ĂN", isWin:false}; return {payout:b*2, message:`VÀOOOO! Lưới rung lên! Thắng ${(b*2).toLocaleString()} PP!`, title:"SIÊU PHẨM", isWin:true}; });
window.playThreeCards = () => executeBet("BÀI CÀO 3 LÁ", (b) => { const pScore=(Math.floor(Math.random()*10)+Math.floor(Math.random()*10)+Math.floor(Math.random()*10))%10, dScore=(Math.floor(Math.random()*10)+Math.floor(Math.random()*10)+Math.floor(Math.random()*10))%10; if(pScore>dScore && Math.random()>0.1) return {payout:b, message:`Bạn: ${pScore} Nút | Cái: ${dScore} Nút\nThắng ${b.toLocaleString()} PP!`, title:"THẮNG ĐẬM", isWin:true}; if(pScore===dScore) return {payout:-Math.floor(b*0.2), message:`Hòa bài, cái cắn tiền xâu 20%.`, title:"HÒA LỖ", isWin:false}; return {payout:-b, message:`Bạn: ${pScore} Nút | Cái: ${dScore} Nút\nThua ${b.toLocaleString()} PP!`, title:"THUA BÀI", isWin:false}; });
window.playCupid = () => executeBet("MŨI TÊN TÌNH YÊU", (b) => { const m=(Math.random()*3).toFixed(1), df=Math.floor(b*m)-b; if(df>0) return {payout:df, message:`Mũi tên găm vào hệ số x${m}!\nLời ${df.toLocaleString()} PP.`, title:"TRÚNG TIẾNG SÉT", isWin:true}; if(df===0) return {payout:0, message:`Trúng x1.0! Hòa vốn.`, title:"HÒA", isWin:true}; return {payout:df, message:`Mũi tên găm vào x${m}!\nLỗ ${(df*-1).toLocaleString()} PP.`, title:"LỆCH NHỊP", isWin:false}; });
window.playShield = () => executeBet("ĐỠ ĐẠN", (b) => { if(Math.random()<0.4) return {payout:Math.floor(b*0.3), message:`Giương khiên thành công!\nLời ${(Math.floor(b*0.3)).toLocaleString()} PP!`, title:"AN TOÀN", isWin:true}; return {payout:-b, message:`Khiên vỡ! Trúng đạn.\nMất sạch ${b.toLocaleString()} PP!`, title:"THƯƠNG VONG", isWin:false}; });
window.playPirate = (c) => executeBet("KHO BÁU", (b) => { const w=Math.floor(Math.random()*4)+1; if(c===w) return {payout:b*2, message:`Đảo chứa kho báu khổng lồ!\nThắng ${(b*2).toLocaleString()} PP!`, title:"TÌM THẤY VÀNG", isWin:true}; return {payout:-b, message:`Bạn gặp cướp biển!\nMất ${b.toLocaleString()} PP!`, title:"BỊ CƯỚP", isWin:false}; });
window.playEgg = () => executeBet("ĐẬP TRỨNG", (b) => { if(Math.random()<0.7) return {payout:Math.floor(b*0.1), message:`Trứng nở ra vàng!\nLời ${(Math.floor(b*0.1)).toLocaleString()} PP.`, title:"THU HOẠCH", isWin:true}; return {payout:-b, message:`Trứng ung! Thối hoắc.\nMất ${b.toLocaleString()} PP!`, title:"THÚI QUẮC", isWin:false}; });
window.playExactDice = () => executeBet("ĐOÁN XÚC XẮC", (b) => { let c=parseInt(prompt("Mặt (1-6):")); if(isNaN(c)||c<1||c>6) return null; const r=Math.floor(Math.random()*7)+1; if(c===r) return {payout:b*5, message:`Đổ ra mặt ${r}!\nĂn trọn ${(b*5).toLocaleString()} PP!`, title:"THẦN BÀI", isWin:true}; return {payout:-b, message:`Đổ ra mặt ${r}!\nTrượt rồi, mất ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playCrash = () => executeBet("CRASH TÀU BAY", (b) => { let c=parseFloat(prompt("Hệ số chốt lời (VD: 1.5, 2.5):")); if(isNaN(c)||c<=1) return null; const crash=(Math.random()<0.5 ? (1+Math.random()*0.3) : (1+Math.random()*5)).toFixed(2); if(crash>=c) return {payout:Math.floor((c-1)*b), message:`Tàu nổ ở x${crash}!\nChốt lời an toàn tại x${c}. Thắng ${(Math.floor((c-1)*b)).toLocaleString()} PP!`, title:"CHỐT LỜI", isWin:true}; return {payout:-b, message:`Tàu nổ tung sớm ở x${crash}!\nChưa kịp chốt lời. Mất ${b.toLocaleString()} PP!`, title:"NỔ TÀU", isWin:false}; });
window.playDragonTiger = (c) => executeBet("RỒNG HỔ", (b) => { const d=Math.floor(Math.random()*13)+1, t=Math.floor(Math.random()*13)+1; if(d===t) return {payout:-Math.floor(b*0.5), message:`Rồng ${d} - Hổ ${t}\nHòa nhau, nhà cái thu nửa tiền!`, title:"HÒA LỖ", isWin:false}; const w=d>t?'DRAGON':'TIGER'; if(c===w) return {payout:b, message:`Rồng ${d} - Hổ ${t}\nĐoán chuẩn! Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Rồng ${d} - Hổ ${t}\nĐoán sai! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });