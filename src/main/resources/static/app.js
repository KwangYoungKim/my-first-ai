// ====================================================
// 보험설계사 스마트 워크스페이스 - Core Logic (app.js)
// ====================================================

// ----------------------------------------------------
// 1. Data Store / State (로컬 스토리지 연동)
// ----------------------------------------------------


// Initialize State
let clients = [];
let events = [];
let tasks = [];
let diaries = {};

// Save helper function
async function loadDataFromDB() {
    const [c, e, t, d] = await Promise.all([
        fetch("/api/clients").then(r => r.json()),
        fetch("/api/events").then(r => r.json()),
        fetch("/api/tasks").then(r => r.json()),
        fetch("/api/diaries").then(r => r.json())
    ]);
    clients = c; events = e; tasks = t;
    diaries = {};
    d.forEach(diary => diaries[diary.date] = diary.content);

    // Auto-migrate old client types to new types
    let needsMigration = false;
    for (let i = 0; i < clients.length; i++) {
        let client = clients[i];
        let oldType = client.type;
        if (["active", "vip"].includes(oldType) || (oldType === "prospect" && ["c-1", "c-4", "c-7", "c-8", "c-2", "c-5", "c-10"].includes(client.id))) {
            let newType = "prospect";
            if (["c-1", "c-4", "c-7"].includes(client.id)) newType = "managed";
            else if (["c-2", "c-5", "c-10"].includes(client.id)) newType = "potential";
            else if (["c-8"].includes(client.id)) newType = "allocated";
            
            if (client.type !== newType) {
                client.type = newType;
                await fetch("/api/clients/" + client.id, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(client)});
                needsMigration = true;
            }
        }
    }
    if (needsMigration) {
        console.log("Client types auto-migrated.");
    }
}

// ----------------------------------------------------
// 2. DOM Elements & Navigation Setup (교정 완료)
// ----------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
    await loadDataFromDB();
    // Lucide Icons initialization
    lucide.createIcons();

    // Tab Navigation
    const navItems = document.querySelectorAll(".nav-item");
    const tabPanes = document.querySelectorAll(".tab-pane");
    const pageTitle = document.getElementById("page-title");

    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");

            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            tabPanes.forEach(pane => {
                pane.classList.remove("active");
                if (pane.id === `tab-${tabId}`) {
                    pane.classList.add("active");
                }
            });

            const tabNames = {
                dashboard: "종합 대시보드",
                calendar: "캘린더 & 다이어리",
                tasks: "영업 할 일 목록",
                clients: "Marketing 고객 관리",
                subscription: "가입설계/청약"
            };
            pageTitle.textContent = tabNames[tabId];

            if (tabId === "dashboard") {
                updateDashboard();
            } else if (tabId === "calendar") {
                renderCalendar();
            } else if (tabId === "tasks") {
                renderTasks();
            } else if (tabId === "clients") {
                renderClients();
            }
        });
    });

    // Date displays
    updateCurrentDateDisplay();

    // Modals handling
    initModals();

    // Forms handling
    initForms();

    // Diary auto-save feature
    initDiaryAutoSave();

    // Initial Dashboard Populate
    updateDashboard();

    // Populate Client Select Options for Event Form
    populateClientSelects();

    // Navigate to Calendar from Dashboard
    document.getElementById("btn-goto-calendar").addEventListener("click", () => {
        const calNavItem = document.querySelector('[data-tab="calendar"]');
        if (calNavItem) calNavItem.click();
    });

    // Handle Month Navigation buttons
    const prevBtn = document.getElementById("prev-month-btn");
    const nextBtn = document.getElementById("next-month-btn");
    const todayBtn = document.getElementById("today-btn");

    if (prevBtn && nextBtn && todayBtn) {
        prevBtn.addEventListener("click", () => {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar();
        });

        nextBtn.addEventListener("click", () => {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar();
        });

        todayBtn.addEventListener("click", () => {
            const today = new Date();
            currentYear = today.getFullYear();
            currentMonth = today.getMonth();
            selectedDateStr = getTodayDateStr();
            renderCalendar();
        });
    }

    // Search input event for client list
    const clientSearchInput = document.getElementById("client-search-input");
    if (clientSearchInput) {
        clientSearchInput.addEventListener("input", renderClients);
    }

    // Search input keyup event for tasks
    const taskSearchInput = document.getElementById("task-search-input");
    if (taskSearchInput) {
        taskSearchInput.addEventListener("input", renderTasks);
    }
}); // <--- DOMContentLoaded 이벤트 리스너를 여기서 안전하게 닫아 외부 노출 성공!

// Update today's date in top header
function updateCurrentDateDisplay() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const dateStr = today.toLocaleDateString('ko-KR', options);
    document.getElementById("current-date-display").textContent = dateStr;
}

// ----------------------------------------------------
// 3. Modal Functionality
// ----------------------------------------------------

function initModals() {
    const modalButtons = [
        { btnId: "btn-open-event-modal", modalId: "event-modal" },
        { btnId: "btn-open-task-modal", modalId: "task-modal" },
        { btnId: "btn-open-client-modal", modalId: "client-modal" }
    ];

    modalButtons.forEach(config => {
        const btn = document.getElementById(config.btnId);
        const modal = document.getElementById(config.modalId);
        if (btn && modal) {
            btn.addEventListener("click", () => {
                modal.classList.add("active");
                if (config.modalId === "event-modal") {
                    populateClientSelects();
                } else if (config.modalId === "task-modal") {
                    currentEditTaskId = null;
                    document.getElementById("task-form").reset();
                    const h3 = document.querySelector("#task-modal h3");
                    if (h3) h3.textContent = "할 일 추가";
                    const submitBtn = document.querySelector("#task-form button[type='submit']");
                    if (submitBtn) submitBtn.textContent = "추가하기";
                }
            });
        }
    });

    const closeBtns = document.querySelectorAll(".btn-close-modal");
    closeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const openModal = btn.closest(".modal-overlay");
            if (openModal) openModal.classList.remove("active");
        });
    });

    const overlays = document.querySelectorAll(".modal-overlay");
    overlays.forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.classList.remove("active");
            }
        });
    });
}

function populateClientSelects() {
    const select = document.getElementById("event-client-select");
    if (!select) return;
    
    select.innerHTML = '<option value="">고객을 선택해 주세요 (무관할 시 비워둠)</option>';
    clients.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = `${c.name} (${c.phone})`;
        select.appendChild(option);
    });
}

// ----------------------------------------------------
// 4. Forms Submission Handlers
// ----------------------------------------------------
let currentEditTaskId = null;

function initForms() {
    const eventForm = document.getElementById("event-form");
    if (eventForm) {
        eventForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = document.getElementById("event-title").value;
            const time = document.getElementById("event-time").value;
            const type = document.getElementById("event-type").value;
            const clientId = document.getElementById("event-client-select").value;
            
            const newEvent = {
                id: `e-${Date.now()}`,
                date: selectedDateStr,
                time,
                title,
                type,
                clientId
            };

            await fetch("/api/events", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(newEvent)});
            events.push(newEvent);
            eventForm.reset();
            document.getElementById("event-modal").classList.remove("active");
            
            renderCalendar();
            renderSelectedDayDetails(selectedDateStr);
            updateDashboard();
        });
    }

    const taskForm = document.getElementById("task-form");
    if (taskForm) {
        taskForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = document.getElementById("task-title").value;
            const category = document.getElementById("task-category").value;
            const priority = document.getElementById("task-priority").value;
            const dueDate = document.getElementById("task-date").value;

            if (currentEditTaskId) {
                const taskIndex = tasks.findIndex(tk => tk.id === currentEditTaskId);
                if (taskIndex !== -1) {
                    tasks[taskIndex].title = title;
                    tasks[taskIndex].category = category;
                    tasks[taskIndex].priority = priority;
                    tasks[taskIndex].dueDate = dueDate;
                    await fetch("/api/tasks/" + currentEditTaskId, {
                        method: "PUT", 
                        headers: {"Content-Type": "application/json"}, 
                        body: JSON.stringify(tasks[taskIndex])
                    });
                }
                currentEditTaskId = null;
            } else {
                const newTask = {
                    id: `t-${Date.now()}`,
                    title,
                    category,
                    priority,
                    dueDate,
                    completed: false
                };
                await fetch("/api/tasks", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(newTask)});
                tasks.push(newTask);
            }

            taskForm.reset();
            document.getElementById("task-modal").classList.remove("active");

            renderTasks();
            updateDashboard();
        });
    }

    const clientForm = document.getElementById("client-form");
    if (clientForm) {
        clientForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("client-name").value;
            const phone = document.getElementById("client-phone").value;
            const type = document.getElementById("client-type").value;
            const policy = document.getElementById("client-policy").value;
            const notes = document.getElementById("client-notes").value;

            const newClient = {
                id: `c-${Date.now()}`,
                name,
                phone,
                type,
                policy: policy || "기록 없음",
                notes: notes || ""
            };

            await fetch("/api/clients", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(newClient)});
            clients.push(newClient);
            clientForm.reset();
            document.getElementById("client-modal").classList.remove("active");

            renderClients();
            updateDashboard();
        });
    }
}

// ----------------------------------------------------
// 5. Dashboard Tab Engine
// ----------------------------------------------------

function updateDashboard() {
    const todayStr = getTodayDateStr();

    const todaysEvents = events.filter(e => e.date === todayStr);
    document.getElementById("stat-today-meetings").textContent = `${todaysEvents.length} 건`;

    const pendingReviews = tasks.filter(t => t.category === "review" && !t.completed);
    document.getElementById("stat-pending-reviews").textContent = `${pendingReviews.length} 건`;

    const totalContractTasks = tasks.filter(t => t.category === "contract").length;
    const completedContractTasks = tasks.filter(t => t.category === "contract" && t.completed).length;
    
    let baseGoalPercent = 65;
    if (totalContractTasks > 0) {
        baseGoalPercent = Math.min(100, Math.round(65 + (completedContractTasks / totalContractTasks) * 35));
    }
    
    document.getElementById("goal-progress-fill").style.width = `${baseGoalPercent}%`;
    document.getElementById("goal-progress-text").textContent = `${baseGoalPercent}%`;
    document.getElementById("goal-radial-value").textContent = `${baseGoalPercent}%`;
    
    const radialGauge = document.querySelector(".goal-circular-progress");
    if (radialGauge) {
        const degrees = Math.round(baseGoalPercent * 3.6);
        radialGauge.style.background = `conic-gradient(var(--accent-blue) ${degrees}deg, rgba(255, 255, 255, 0.05) 0deg)`;
    }

    const currentAmount = Math.round(1000 * (baseGoalPercent / 100));
    document.getElementById("goal-current-amount").textContent = `${currentAmount} 만원`;
    document.getElementById("stat-monthly-contracts").textContent = `${Math.round(baseGoalPercent / 10)} 건`;

    const timelineContainer = document.getElementById("dash-timeline");
    timelineContainer.innerHTML = "";

    if (todaysEvents.length === 0) {
        timelineContainer.innerHTML = '<div class="timeline-empty">오늘 등록된 미팅 일정이 없습니다.</div>';
    } else {
        const sortedEvents = [...todaysEvents].sort((a, b) => a.time.localeCompare(b.time));
        sortedEvents.forEach(e => {
            const node = document.createElement("div");
            node.className = `timeline-node type-${e.type}`;

            let clientMarkup = "";
            if (e.clientId) {
                const client = clients.find(c => c.id === e.clientId);
                if (client) {
                    clientMarkup = `<span class="timeline-client"><i data-lucide="user" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;margin-right:2px;"></i> ${client.name} (${client.phone})</span>`;
                }
            }

            node.innerHTML = `
                <div class="timeline-time">${e.time}</div>
                <div class="timeline-content">
                    <div class="timeline-title">${e.title}</div>
                    ${clientMarkup}
                </div>
            `;
            timelineContainer.appendChild(node);
        });
        lucide.createIcons();
    }

    updateDashboardAlerts();
}

function updateDashboardAlerts() {
    const alertList = document.getElementById("dash-alerts");
    if(!alertList) return;
    alertList.innerHTML = "";

    let alerts = [];

    const birthdayClients = clients.filter(c => {
        if (!c.notes || !c.notes.includes('생일')) return false;
        // 완료된 생일 관련 할 일이 있는지 확인하여 있으면 알림 제외
        const hasCompletedTask = tasks.some(t => t.completed && t.title.includes(c.name) && t.title.includes('생일'));
        return !hasCompletedTask;
    });
    birthdayClients.forEach(c => {
        alerts.push({
            type: "info",
            icon: "gift",
            text: `<strong>${c.name} 고객님</strong> 생일 (안부 문자 및 기념품 추천)`
        });
    });

    const highTasks = tasks.filter(t => t.priority === "high" && !t.completed);
    highTasks.forEach(t => {
        alerts.push({
            type: "warn",
            icon: "alert-circle",
            text: `<strong>[긴급 할일]</strong> ${t.title} (기한: ${t.dueDate})`
        });
    });

    alerts.forEach(alert => {
        const li = document.createElement("li");
        li.className = `alert-item ${alert.type}`;
        li.innerHTML = `
            <i data-lucide="${alert.icon}" class="alert-icon"></i>
            <div class="alert-text">${alert.text}</div>
        `;
        alertList.appendChild(li);
    });

    document.getElementById("alert-count").textContent = alerts.length;
    lucide.createIcons();
}

function getTodayDateStr() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// ----------------------------------------------------
// 6. Calendar & Diary Engine (완벽 교정 버전)
// ----------------------------------------------------
const todayDateObj = new Date();

let currentYear = todayDateObj.getFullYear();
let currentMonth = todayDateObj.getMonth();
let selectedDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(todayDateObj.getDate()).padStart(2, "0")}`;

function renderCalendar() {
    const grid = document.getElementById("calendar-days-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const monthYearTitle = document.getElementById("calendar-month-year");
    const monthsName = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    monthYearTitle.textContent = `${currentYear}년 ${monthsName[currentMonth]}`;

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const todayStr = getTodayDateStr();

    // 1. 이전 달 빈칸 채우기
    for (let x = firstDayIndex; x > 0; x--) {
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day-cell outside";
        dayCell.innerHTML = `<span class="day-number">${prevLastDay - x + 1}</span>`;
        grid.appendChild(dayCell);
    }

    // 2. 이번 달 날짜 채우기
    for (let i = 1; i <= lastDay; i++) {
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day-cell";
        
        const dayOfWeek = new Date(currentYear, currentMonth, i).getDay();
        if (dayOfWeek === 0) dayCell.classList.add("sunday");
        if (dayOfWeek === 6) dayCell.classList.add("saturday");

        const mStr = String(currentMonth + 1).padStart(2, "0");
        const dStr = String(i).padStart(2, "0");
        const dateStr = `${currentYear}-${mStr}-${dStr}`;

        if (dateStr === todayStr) dayCell.classList.add("today");
        if (dateStr === selectedDateStr) dayCell.classList.add("selected");

        dayCell.innerHTML = `
            <span class="day-number">${i}</span>
            <div class="day-indicators"></div>
        `;

        const dayIndicators = dayCell.querySelector(".day-indicators");
        const dayEvents = events.filter(e => e.date === dateStr);
        dayEvents.slice(0, 3).forEach(e => {
            const dot = document.createElement("span");
            dot.className = `indicator-dot ${e.type}`;
            dayIndicators.appendChild(dot);
        });

        dayCell.addEventListener("click", () => {
            document.querySelectorAll(".calendar-day-cell").forEach(cell => {
                cell.classList.remove("selected");
            });
            dayCell.classList.add("selected");
            selectedDateStr = dateStr;
            renderSelectedDayDetails(dateStr);
        });

        grid.appendChild(dayCell);
    }

    // 3. 다음 달 빈칸 채우기
    const totalCells = grid.children.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day-cell outside";
        dayCell.innerHTML = `<span class="day-number">${i}</span>`;
        grid.appendChild(dayCell);
    }

    renderSelectedDayDetails(selectedDateStr);
}

function renderSelectedDayDetails(dateStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const options = { month: 'long', day: 'numeric', weekday: 'short' };
    const titleText = dateObj.toLocaleDateString('ko-KR', options);
    
    document.getElementById("selected-date-title").textContent = `${titleText} 일정 & 상담 일지`;

    const dayEventsList = document.getElementById("day-events-list");
    if(!dayEventsList) return;
    dayEventsList.innerHTML = "";

    const dayEvents = events.filter(e => e.date === dateStr);

    if (dayEvents.length === 0) {
        dayEventsList.innerHTML = '<div class="events-empty">등록된 일정이 없습니다.</div>';
    } else {
        const sorted = [...dayEvents].sort((a, b) => a.time.localeCompare(b.time));
        sorted.forEach(e => {
            const item = document.createElement("div");
            item.className = "side-event-item";
            item.innerHTML = `
                <div class="event-info-wrapper">
                    <span class="event-dot-marker ${e.type}"></span>
                    <div>
                        <div class="event-title-text">${e.title}</div>
                        <span class="event-time-badge">${e.time}</span>
                    </div>
                </div>
                <button class="btn-delete-event" data-id="${e.id}">
                    <i data-lucide="trash-2"></i>
                </button>
            `;

            item.querySelector(".btn-delete-event").addEventListener("click", async (evt) => {
                evt.stopPropagation();
                await fetch("/api/events/" + e.id, {method: "DELETE"});
                events = events.filter(ev => ev.id !== e.id);
                renderCalendar();
                updateDashboard();
            });

            dayEventsList.appendChild(item);
        });
        lucide.createIcons();
    }

    const diaryTextarea = document.getElementById("day-diary-textarea");
    if(diaryTextarea) diaryTextarea.value = diaries[dateStr] || "";
}

function initDiaryAutoSave() {
    const diaryTextarea = document.getElementById("day-diary-textarea");
    const saveStatus = document.getElementById("diary-save-status");
    if(!diaryTextarea || !saveStatus) return;
    let timer;

    diaryTextarea.addEventListener("input", () => {
        saveStatus.textContent = "저장 중...";
        saveStatus.style.color = "var(--accent-orange)";

        clearTimeout(timer);
        timer = setTimeout(() => {
            diaries[selectedDateStr] = diaryTextarea.value;
            fetch("/api/diaries", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({date: selectedDateStr, content: diaryTextarea.value})});
            saveStatus.textContent = "자동 저장됨";
            saveStatus.style.color = "var(--accent-green)";
        }, 800);
    });
}

// ----------------------------------------------------
// 7. To Do List Engine
// ----------------------------------------------------
let activeTaskFilter = "all";

function renderTasks() {
    const container = document.getElementById("tasks-list-container");
    if (!container) return;
    container.innerHTML = "";

    const searchInput = document.getElementById("task-search-input").value.toLowerCase();

    let filteredTasks = tasks.filter(t => {
        const matchesCategory = activeTaskFilter === "all" || t.category === activeTaskFilter;
        const matchesSearch = t.title.toLowerCase().includes(searchInput);
        return matchesCategory && matchesSearch;
    });

    const totalTodoProgress = tasks.filter(t => !t.completed).length;
    const totalTodoHigh = tasks.filter(t => t.priority === "high" && !t.completed).length;
    const totalTodoCompleted = tasks.filter(t => t.completed).length;

    document.getElementById("count-todo-progress").textContent = totalTodoProgress;
    document.getElementById("count-todo-high").textContent = totalTodoHigh;
    document.getElementById("count-todo-completed").textContent = totalTodoCompleted;

    if (filteredTasks.length === 0) {
        container.innerHTML = `
            <div class="glass-panel" style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-muted);">
                조건에 맞는 할 일 목록이 없습니다. 신규 일정을 등록하세요!
            </div>
        `;
        return;
    }

    const priorityWeight = { high: 3, medium: 2, low: 1 };
    filteredTasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (priorityWeight[b.priority] !== priorityWeight[a.priority]) return priorityWeight[b.priority] - priorityWeight[a.priority];
        return a.dueDate.localeCompare(b.dueDate);
    });

    filteredTasks.forEach(t => {
        const card = document.createElement("div");
        card.className = `task-card glass-panel cat-${t.category} ${t.completed ? 'completed' : ''}`;

        const categoryNames = { consult: "상담", contract: "계약/청약", review: "심사대응", care: "고객케어" };
        const todayStr = getTodayDateStr();
        const isUrgent = t.dueDate <= todayStr && !t.completed;

        card.innerHTML = `
            <div class="task-card-header">
                <label class="task-checkbox-label">
                    <span class="task-checkbox">
                        <i data-lucide="check"></i>
                    </span>
                    <span>${t.title}</span>
                </label>
                <button class="btn-task-delete" data-id="${t.id}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="task-card-footer">
                <span class="task-badge-category">${categoryNames[t.category]}</span>
                <div class="task-due-date ${isUrgent ? 'urgent' : ''}">
                    <i data-lucide="calendar"></i>
                    <span>${t.dueDate} 마감</span>
                </div>
                <span class="task-priority-indicator priority-${t.priority}">${t.priority === 'high' ? '긴급' : t.priority === 'medium' ? '보통' : '낮음'}</span>
            </div>
        `;

        card.querySelector(".task-checkbox").addEventListener("click", async (evt) => {
            evt.preventDefault();
            t.completed = !t.completed;
            await fetch("/api/tasks/" + t.id, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(t)});
            renderTasks();
            updateDashboard();
        });

        card.querySelector(".btn-task-delete").addEventListener("click", async (evt) => {
            evt.stopPropagation();
            await fetch("/api/tasks/" + t.id, {method: "DELETE"});
            tasks = tasks.filter(tk => tk.id !== t.id);
            renderTasks();
            updateDashboard();
        });

        card.style.cursor = 'pointer';
        card.addEventListener("click", (evt) => {
            if (evt.target.closest('.task-checkbox-label') || evt.target.closest('.btn-task-delete')) return;
            
            currentEditTaskId = t.id;
            const taskModal = document.getElementById("task-modal");
            const h3 = document.querySelector("#task-modal h3");
            if (h3) h3.textContent = "할 일 수정";
            const submitBtn = document.querySelector("#task-form button[type='submit']");
            if (submitBtn) submitBtn.textContent = "확인";
            
            document.getElementById("task-title").value = t.title;
            document.getElementById("task-category").value = t.category;
            document.getElementById("task-priority").value = t.priority;
            document.getElementById("task-date").value = t.dueDate;
            
            taskModal.classList.add("active");
        });

        container.appendChild(card);
    });
    
    lucide.createIcons();
}

const filterButtons = document.querySelectorAll(".btn-filter");
filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeTaskFilter = btn.getAttribute("data-filter");
        renderTasks();
    });
});

// ----------------------------------------------------
// 8. Client Management Engine
// ----------------------------------------------------
let activeClientFilter = "all";

const clientFilterButtons = document.querySelectorAll(".btn-filter-client");
clientFilterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        clientFilterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeClientFilter = btn.getAttribute("data-filter");
        renderClients();
    });
});

function renderClients() {
    const container = document.getElementById("clients-grid-container");
    if (!container) return;
    container.innerHTML = "";

    const searchInput = document.getElementById("client-search-input").value.toLowerCase();

    const filteredClients = clients.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchInput) || c.phone.includes(searchInput);
        const matchesFilter = activeClientFilter === "all" || c.type === activeClientFilter;
        return matchesSearch && matchesFilter;
    });

    if (filteredClients.length === 0) {
        container.innerHTML = `
            <div class="glass-panel" style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-muted);">
                검색 조건에 일치하는 고객이 없습니다. 신규 고객을 등록해보세요!
            </div>
        `;
        return;
    }

    filteredClients.forEach(c => {
        const card = document.createElement("div");
        card.className = "client-card glass-panel";

        const firstLetter = c.name.substring(0, 1);
        const clientTypeNames = { prospect: "가망고객", potential: "잠재고객", allocated: "배분고객", managed: "소관고객" };

        card.innerHTML = `
            <div class="client-card-header">
                <div class="client-avatar-row">
                    <div class="client-letter-avatar">${firstLetter}</div>
                    <div class="client-name-phone">
                        <h3>${c.name}</h3>
                        <p>${c.phone}</p>
                    </div>
                </div>
                <span class="client-type-badge ${c.type}">${clientTypeNames[c.type]}</span>
            </div>
            
            <div class="client-card-body">
                <div class="client-policy-item">
                    <span class="client-policy-label">유지 상품:</span>
                    <span class="client-policy-value">${c.policy}</span>
                </div>
                ${c.notes ? `<p class="client-notes-preview">${c.notes}</p>` : ""}
            </div>

            <div class="client-card-footer">
                <button class="btn-client-action btn-add-client-event" data-id="${c.id}" data-name="${c.name}">
                    <i data-lucide="plus"></i>
                    <span>일정 등록</span>
                </button>
                <button class="btn-delete-client" data-id="${c.id}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;

        card.querySelector(".btn-delete-client").addEventListener("click", (evt) => {
            evt.stopPropagation();
            if (confirm(`${c.name} 고객을 삭제하시겠습니까? 등록된 일정도 함께 점검해주세요.`)) {
                clients = clients.filter(cl => cl.id !== c.id);
                renderClients();
                updateDashboard();
            }
        });

        card.querySelector(".btn-add-client-event").addEventListener("click", () => {
            const eventModal = document.getElementById("event-modal");
            eventModal.classList.add("active");
            populateClientSelects();
            const select = document.getElementById("event-client-select");
            if (select) select.value = c.id;
        });

        container.appendChild(card);
    });

    lucide.createIcons();
}

// 도너츠 메뉴 토글 기능
document.addEventListener('DOMContentLoaded', () => {
    const donutMenuBtn = document.getElementById('donutMenuBtn');
    const donutNavMenu = document.querySelector('.donut-menu-container .nav-menu');

    if (donutMenuBtn && donutNavMenu) {
        // 버튼 클릭 시 메뉴 보여주기/숨기기 토글
        donutMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 부모 윈도우 클릭 이벤트 전파 방지
            donutNavMenu.classList.toggle('show');
        });

        // 메뉴 바깥 화면을 클릭하면 메뉴가 자동으로 닫히도록 설정
        document.addEventListener('click', (e) => {
            if (!donutNavMenu.contains(e.target) && e.target !== donutMenuBtn) {
                donutNavMenu.classList.remove('show');
            }
        });
    }
});

// 알림 모달창 기능
document.addEventListener('DOMContentLoaded', () => {
    const notificationBell = document.querySelector('.notification-bell');
    const alertModal = document.getElementById('alert-list-modal');
    const alertModalCloseBtn = document.getElementById('alert-list-modal-close');
    const alertModalOkBtn = document.getElementById('alert-list-modal-ok');
    const alertModalList = document.getElementById('alert-modal-list');

    if (notificationBell && alertModal) {
        notificationBell.addEventListener('click', () => {
            alertModal.classList.add('active');
            populateAlertModal();
        });

        const closeAlertModal = () => {
            alertModal.classList.remove('active');
        };

        if (alertModalCloseBtn) alertModalCloseBtn.addEventListener('click', closeAlertModal);
        if (alertModalOkBtn) alertModalOkBtn.addEventListener('click', closeAlertModal);
    }
});

function populateAlertModal() {
    const alertModalList = document.getElementById('alert-modal-list');
    if(!alertModalList) return;
    alertModalList.innerHTML = '';

    let alerts = [];

    const birthdayClients = clients.filter(c => {
        if (!c.notes || !c.notes.includes('생일')) return false;
        // 완료된 생일 관련 할 일이 있는지 확인하여 있으면 알림 제외
        const hasCompletedTask = tasks.some(t => t.completed && t.title.includes(c.name) && t.title.includes('생일'));
        return !hasCompletedTask;
    });
    birthdayClients.forEach(c => {
        alerts.push({
            type: 'info',
            icon: 'gift',
            text: `<strong>${c.name} 고객님</strong> 생일 (안부 문자 및 기념품 추천)`
        });
    });

    const highTasks = tasks.filter(t => t.priority === 'high' && !t.completed);
    highTasks.forEach(t => {
        alerts.push({
            type: 'warn',
            icon: 'alert-circle',
            text: `<strong>[긴급 할일]</strong> ${t.title} (기한: ${t.dueDate})`
        });
    });

    alerts.forEach(alert => {
        const li = document.createElement('li');
        li.className = `alert-item ${alert.type}`;
        li.innerHTML = `
            <i data-lucide="${alert.icon}" class="alert-icon"></i>
            <div class="alert-text">${alert.text}</div>
        `;
        alertModalList.appendChild(li);
    });
    
    lucide.createIcons();
}

// ====================================================
// 가입설계/청약 (Subscription) Logic
// ====================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Stepper Navigation (자유로운 이동)
    const nextButtons = document.querySelectorAll('.btn-next-step');
    const prevButtons = document.querySelectorAll('.btn-prev-step');
    const steps = document.querySelectorAll('.stepper-header .step');
    const stepContents = document.querySelectorAll('.step-content');

    function goToStep(targetStepNum) {
        // Update Stepper UI
        steps.forEach(step => {
            const stepNum = parseInt(step.getAttribute('data-step'));
            if (stepNum <= targetStepNum) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        // Update Content Visibility
        stepContents.forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });
        const targetContent = document.getElementById(`step-content-${targetStepNum}`);
        if (targetContent) {
            targetContent.style.display = 'block';
            // Trigger reflow for animation
            setTimeout(() => targetContent.classList.add('active'), 10);
        }

        // Render chart if entering Step 4
        if (targetStepNum === 4) {
            renderRadarChart();
        }
    }

    nextButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextStep = parseInt(btn.getAttribute('data-next'));
            goToStep(nextStep);
        });
    });

    prevButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const prevStep = parseInt(btn.getAttribute('data-prev'));
            goToStep(prevStep);
        });
    });

    steps.forEach(step => {
        step.addEventListener('click', () => {
            const stepNum = parseInt(step.getAttribute('data-step'));
            goToStep(stepNum);
        });
    });

    // 2. Plan Tabs in Step 2 (내 보관함 기능 추가)
    const planTabs = document.querySelectorAll('#step-content-2 .btn-tab');
    const defaultPlansGrid = document.querySelector('#step-content-2 .plans-grid:not(.custom-plans-container)');
    const customPlansContainer = document.querySelector('.custom-plans-container');

    planTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            planTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.textContent.includes('내 보관함')) {
                defaultPlansGrid.style.display = 'none';
                customPlansContainer.style.display = 'grid';
                renderCustomPlans();
            } else {
                defaultPlansGrid.style.display = 'grid';
                customPlansContainer.style.display = 'none';
            }
        });
    });

    // 3. Accordion in Step 3
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const body = item.querySelector('.accordion-body');
            const icon = header.querySelector('.acc-icon');
            
            item.classList.toggle('expanded');
            if (item.classList.contains('expanded')) {
                body.style.display = 'block';
                if(icon) icon.setAttribute('data-lucide', 'chevron-up');
            } else {
                body.style.display = 'none';
                if(icon) icon.setAttribute('data-lucide', 'chevron-down');
            }
            lucide.createIcons();
        });
    });

    // 4. Async Skeleton Loading Simulation (Premium Calculation)
    const cancerSlider = document.getElementById('slider-cancer');
    const valCancer = document.getElementById('val-cancer');
    const premiumCancer = document.getElementById('premium-cancer');
    const totalPremiumVal = document.getElementById('total-premium-val');
    const premiumSkeleton = document.getElementById('premium-skeleton');
    
    let calcTimeout;

    if (cancerSlider) {
        cancerSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            valCancer.textContent = val.toLocaleString();
            
            // Show skeleton loader
            if(premiumSkeleton) premiumSkeleton.style.display = 'flex';
            
            clearTimeout(calcTimeout);
            calcTimeout = setTimeout(() => {
                // Mock calculation: 45000 is base. cancer premium varies
                const cancerCost = Math.round(val * 0.9);
                premiumCancer.textContent = cancerCost.toLocaleString() + '원';
                
                const baseOtherCosts = 40500;
                const total = baseOtherCosts + cancerCost;
                totalPremiumVal.textContent = total.toLocaleString() + ' 원';
                
                // Hide skeleton loader
                if(premiumSkeleton) premiumSkeleton.style.display = 'none';
            }, 800); // 0.8s fake async delay
        });
    }

    // 5. Save Custom Plan
    const btnSaveCustom = document.getElementById('btn-save-custom-plan');
    if (btnSaveCustom) {
        btnSaveCustom.addEventListener('click', () => {
            const currentTotalStr = totalPremiumVal ? totalPremiumVal.textContent.replace(/[^0-9]/g, '') : '45000';
            const cancerValStr = valCancer ? valCancer.textContent.replace(/[^0-9]/g, '') : '5000';
            
            const newPlan = {
                id: 'plan-' + Date.now(),
                name: `맞춤형 설계 플랜 (${new Date().toLocaleDateString('ko-KR')})`,
                price: parseInt(currentTotalStr),
                cancer: parseInt(cancerValStr)
            };
            
            let savedPlans = JSON.parse(localStorage.getItem('customPlans') || '[]');
            savedPlans.push(newPlan);
            localStorage.setItem('customPlans', JSON.stringify(savedPlans));
            
            alert('나만의 플랜이 성공적으로 저장되었습니다!');
            goToStep(2); // 플랜 선택 단계로 이동
            
            // 내 보관함 탭 활성화
            planTabs.forEach(t => t.classList.remove('active'));
            const customTab = Array.from(planTabs).find(t => t.textContent.includes('내 보관함'));
            if (customTab) {
                customTab.classList.add('active');
                if (defaultPlansGrid) defaultPlansGrid.style.display = 'none';
                if (customPlansContainer) {
                    customPlansContainer.style.display = 'grid';
                    renderCustomPlans();
                }
            }
        });
    }

    function renderCustomPlans() {
        if (!customPlansContainer) return;
        const savedPlans = JSON.parse(localStorage.getItem('customPlans') || '[]');
        customPlansContainer.innerHTML = '';
        
        if (savedPlans.length === 0) {
            customPlansContainer.innerHTML = `
                <div class="glass-panel" style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-muted);">
                    저장된 커스텀 플랜이 없습니다. 설계 완료 후 '나만의 플랜으로 저장'을 이용해보세요.
                </div>
            `;
            return;
        }

        savedPlans.forEach(plan => {
            const card = document.createElement('div');
            card.className = 'plan-card glass-panel';
            card.innerHTML = `
                <h4 style="margin-bottom:10px;">${plan.name}</h4>
                <p class="plan-desc text-secondary" style="font-size:0.9rem; margin-bottom:15px;">내가 수정한 보장 세팅</p>
                <ul class="plan-features" style="list-style:none; padding:0; margin-bottom:20px; font-size:0.95rem;">
                    <li style="margin-bottom:8px;"><i data-lucide="check" style="width:16px; color:var(--accent-blue); margin-right:5px; vertical-align:middle;"></i> 암진단비 ${plan.cancer.toLocaleString()}만</li>
                    <li style="margin-bottom:8px;"><i data-lucide="check" style="width:16px; color:var(--accent-blue); margin-right:5px; vertical-align:middle;"></i> 뇌/허혈성 기본 유지</li>
                </ul>
                <div class="plan-footer" style="border-top:1px solid rgba(255,255,255,0.1); padding-top:15px; margin-top:auto;">
                    <span class="plan-price" style="display:block; font-size:1.1rem; font-weight:700; margin-bottom:10px;">월 예상 ${plan.price.toLocaleString()}원~</span>
                    <button class="btn-primary btn-next-step-custom w-full">이 플랜으로 다시 설계</button>
                    <button class="btn-outline btn-delete-plan w-full mt-sm" style="margin-top:5px; border-color:var(--accent-red); color:var(--accent-red);">삭제</button>
                </div>
            `;

            const startBtn = card.querySelector('.btn-next-step-custom');
            startBtn.addEventListener('click', () => goToStep(3));

            const delBtn = card.querySelector('.btn-delete-plan');
            delBtn.addEventListener('click', () => {
                let currentPlans = JSON.parse(localStorage.getItem('customPlans') || '[]');
                currentPlans = currentPlans.filter(p => p.id !== plan.id);
                localStorage.setItem('customPlans', JSON.stringify(currentPlans));
                renderCustomPlans();
            });

            customPlansContainer.appendChild(card);
        });
        lucide.createIcons();
    }
});

// Radar Chart Rendering
let radarChartInstance = null;
function renderRadarChart() {
    const ctx = document.getElementById('coverageRadarChart');
    if (!ctx) return;
    
    // Destroy previous instance if it exists
    if (radarChartInstance) {
        radarChartInstance.destroy();
    }

    const data = {
        labels: ['암 진단비', '뇌혈관 진단비', '허혈성 진단비', '수술비', '입원일당', '후유장해'],
        datasets: [{
            label: '현재 설계 플랜',
            data: [65, 90, 80, 100, 70, 85],
            backgroundColor: 'rgba(59, 130, 246, 0.4)', // accent-blue with opacity
            borderColor: 'rgba(59, 130, 246, 1)',
            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        }, {
            label: '동일 연령대 평균',
            data: [90, 75, 75, 80, 60, 70],
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'rgba(255, 255, 255, 0.5)',
            borderDash: [5, 5],
            pointBackgroundColor: 'rgba(255, 255, 255, 0.5)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(255, 255, 255, 0.5)'
        }]
    };

    const config = {
        type: 'radar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 12, family: 'Inter' } },
                    ticks: { display: false, min: 0, max: 100 }
                }
            },
            plugins: {
                legend: { labels: { color: 'rgba(255,255,255,0.8)', font: { family: 'Inter' } } }
            }
        }
    };

    radarChartInstance = new Chart(ctx, config);
}
