const SCRIPT_URL = (typeof LOCAL_SCRIPT_URL !== 'undefined') 
    ? LOCAL_SCRIPT_URL 
    : "VITE_REPLACE_URL";
if (SCRIPT_URL === "VITE_REPLACE_URL" && window.location.hostname === 'localhost') {
    console.error("ERRORE: config.js non trovato o LOCAL_SCRIPT_URL non definito!");
}
let db = { utenti: [], prodotti: [], ordini: [] };
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let quantities = {};
let activeCat = 'tutti';

// ── INIZIALIZZAZIONE ──
async function init() {
    await loadData();
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        initApp();
    } else {
        showAuth('login');
    }
}

async function loadData() {
    const grid = document.getElementById('products-grid');
    const history = document.getElementById('history-list');

    // Mostriamo il caricamento se i contenitori esistono
    const loaderHtml = `<div class="loader"><div class="spinner"></div><p>Sincronizzazione...</p></div>`;
    if (grid) grid.innerHTML = loaderHtml;
    if (history) history.innerHTML = loaderHtml;

    try {
        const resp = await fetch(SCRIPT_URL);
        db = await resp.json();
        
        // Una volta arrivati i dati, generiamo le liste reali
        renderProducts();
        renderHistory();
    } catch (e) { 
        console.error("Errore caricamento DB", e);
        if (grid) grid.innerHTML = "<p>Errore di connessione.</p>";
    }
}

async function saveToCloud(type, payload) {
    // Troviamo il pulsante che ha scatenato l'evento per dargli lo stile "loading"
    const btn = event?.target; 
    if (btn && btn.tagName === 'BUTTON') btn.classList.add('loading-btn');

    payload.type = type;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });

        // Feedback visivo rapido
        console.log("Dati inviati al cloud...");
        
        // Aspettiamo un po' e ricarichiamo tutto
        setTimeout(() => {
            if (btn) btn.classList.remove('loading-btn');
            loadData(); 
        }, 1500);
        
    } catch (e) { 
        console.error("Errore salvataggio", e);
        if (btn) btn.classList.remove('loading-btn');
    }
}

function initApp() {
    const authWrap = document.getElementById('auth-wrap');
    const appWrap = document.getElementById('app-wrap');
    const navBar = document.querySelector('.nav-bar');
    const fab = document.getElementById('fab-order');
    const userDisplay = document.getElementById('user-display');

    if (authWrap && appWrap) {
        // NASCONDI LOGIN
        authWrap.style.display = 'none';
        
        // MOSTRA APP E MENU
        appWrap.style.display = 'block';
        if (navBar) navBar.style.display = 'flex';
        // Il FAB lo mostriamo solo se ci sono prodotti (gestito da updateFab)
        
        console.log("Login effettuato: mostro interfaccia.");
    }

    if (userDisplay && currentUser) {
        userDisplay.innerText = `Ciao, ${currentUser.name}`;
    }

    renderCats();
    renderProducts();
    updateFab();
}

// ── NAVIGAZIONE ──
function switchView(viewId, btn) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateFab();
}

// ── AUTH ──
function showAuth(type) {
    const authWrap = document.getElementById('auth-wrap');
    const appWrap = document.getElementById('app-wrap');
    const navBar = document.querySelector('.nav-bar');

    if (authWrap) authWrap.style.display = 'flex';
    if (appWrap) appWrap.style.display = 'none';
    if (navBar) navBar.style.display = 'none';

    // Gestione switch Login/Signup
    const loginBox = document.getElementById('screen-login');
    const signupBox = document.getElementById('screen-signup');
    
    if (type === 'login') {
        loginBox.style.display = 'block';
        signupBox.style.display = 'none';
    } else {
        loginBox.style.display = 'none';
        signupBox.style.display = 'block';
    }
}

function toggleAuth(screen) {
    const login = document.getElementById('screen-login');
    const signup = document.getElementById('screen-signup');
    if (login && signup) {
        login.style.display = screen === 'login' ? 'block' : 'none';
        signup.style.display = screen === 'signup' ? 'block' : 'none';
    }
}

async function handleAuth(type) {
    const emailEl = document.getElementById(`${type}-email`);
    const passEl = document.getElementById(`${type}-pass`);
    const nameEl = document.getElementById('signup-name');

    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim().toLowerCase(); // Convertiamo in minuscolo per evitare duplicati Case-Sensitive
    const pass = passEl.value.trim();
    const name = (type === 'signup' && nameEl) ? nameEl.value.trim() : null;

    if (!email || !pass || (type === 'signup' && !name)) {
        return alert("Compila tutti i campi richiesti.");
    }

    // 1. CRIPTIAMO LA PASSWORD
    const hashedPassword = await hashPassword(pass);
    console.log("Password hashata generata:", hashedPassword);

    if (type === 'signup') {
        const listaUtenti = db.utenti || [];
        const giaPresente = listaUtenti.slice(1).some(u => String(u[1]).toLowerCase().trim() === email);

        if (giaPresente) {
            return alert("Questa email è già registrata.");
        }

        await saveToCloud('utenti', { 
            name: name, 
            email: email, 
            pass: hashedPassword 
        });

        alert("Registrazione completata! Scaricamento dati in corso...");
        
        // FORZIAMO il ricaricamento del DB per includere il nuovo utente appena creato
        await loadData(); 
        
        showAuth('login');
    } else {
        // LOGIN - VERSIONE DEBUG
        const listaUtenti = db.utenti || [];
        console.log("Database Utenti caricato:", listaUtenti); // Spia 1
        console.log("Email cercata:", email);
        console.log("Hash cercato:", hashedPassword);

        const user = listaUtenti.find((u, index) => {
            if (index === 0) return false; // Salta l'intestazione
            
            // Logghiamo ogni riga per vedere se gli indici [1] e [2] sono corretti
            console.log(`Riga ${index} nel DB:`, u); 
            
            const emailDB = String(u[1] || "").trim().toLowerCase();
            const hashDB = String(u[2] || "").trim();
            
            return emailDB === email && hashDB === hashedPassword;
        });

        if (user) {
            console.log("UTENTE TROVATO!", user);
            currentUser = { name: user[0], email: user[1] };
            localStorage.setItem('user', JSON.stringify(currentUser));
            initApp();
        } else {
            console.warn("NESSUN UTENTE CORRISPONDE");
            const errEl = document.getElementById('login-err');
            if (errEl) errEl.style.display = 'block';
            else alert("Credenziali errate o utente non trovato");
        }
    }
}

function startApp() {
    document.getElementById('auth-wrap').style.display = 'none';
    document.getElementById('app-wrap').style.display = 'block';
    document.getElementById('user-display').textContent = currentUser.name;
    loadData();
    renderCats();
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function doLogout() {
    localStorage.removeItem('user');
    sessionStorage.removeItem('ou_user');
    quantities = {};
    location.reload();
}

// ── PRODOTTI & CATALOGO ──
function renderCats() {
    const cats = ["tutti", "igiene", "cucina", "pulizia", "cancelleria"];
    document.getElementById('cats').innerHTML = cats.map(c => 
        `<div class="cat-pill ${activeCat===c?'active':''}" onclick="activeCat='${c}';renderCats();renderProducts();">${c}</div>`
    ).join('');
}

function renderProducts() {
    const cloudProds = (db.prodotti || []).slice(1).map(p => ({id:p[0].toString(), name:p[1], icon:p[2], unit:p[3], cat:p[4]}));
    const list = activeCat === 'tutti' ? cloudProds : cloudProds.filter(p => p.cat === activeCat);
    
    document.getElementById('products-grid').innerHTML = list.map(p => {
        const q = quantities[p.id] || 0;
        const icon = (p.icon && p.icon.trim() !== "") ? p.icon : "📦";
        return `
            <div class="card ${q>0?'selected':''}">
                <div style="font-size:30px; margin-bottom:5px;">${icon}</div>
                <div style="font-size:13px; font-weight:600;">${p.name}</div>
                <div style="font-size:10px; color:var(--text3);">${p.unit}</div>
                <div class="qty-row">
                    <button class="qty-btn" onclick="chg('${p.id}',-1)">-</button>
                    <span style="font-weight:bold; min-width:15px;">${q}</span>
                    <button class="qty-btn" onclick="chg('${p.id}',1)">+</button>
                </div>
            </div>`;
    }).join('');
}

function chg(id, delta) {
    quantities[id] = Math.max(0, (quantities[id] || 0) + delta);
    renderProducts();
    updateFab();
}

async function addNewProduct() {
    const name = document.getElementById('new-p-name').value;
    const icon = document.getElementById('new-p-icon').value;
    const unit = document.getElementById('new-p-unit').value;
    const cat = document.getElementById('new-p-cat').value;
    if(!name) return;
    await saveToCloud('prodotti', { id: Date.now().toString(), name, icon, unit, cat });
    alert("Inviato al catalogo!");
    document.getElementById('new-p-name').value = "";
}

// ── FAB & MODAL ──
function updateFab() {
    const total = Object.values(quantities).reduce((a, b) => a + b, 0);
    const fab = document.getElementById('fab-order');
    const isHome = document.getElementById('view-home').classList.contains('active');
    fab.style.display = (total > 0 && isHome) ? 'flex' : 'none';
    document.getElementById('fab-count').textContent = total;
}

function openOrderModal() {
    const cloudProds = (db.prodotti || []).slice(1).map(p => ({id:p[0].toString(), name:p[1], icon:p[2]}));
    const items = cloudProds.filter(p => quantities[p.id] > 0);
    
    document.getElementById('modal-items-list').innerHTML = items.map(p => `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:8px 0;">
            <span>${p.icon || '📦'} ${p.name}</span>
            <strong>x${quantities[p.id]}</strong>
        </div>
    `).join('');
    document.getElementById('order-modal').style.display = 'flex';
}

function closeOrderModal() { document.getElementById('order-modal').style.display = 'none'; }

async function sendOrder(event) {
    // Recuperiamo il pulsante e il testo originale per il feedback
    const btn = event?.currentTarget || event?.target;
    const originalBtnText = btn ? btn.innerHTML : "Invia Ordine Finale 🚀";

    const cloudProds = (db.prodotti || []).slice(1).map(p => ({id:p[0].toString(), name:p[1], unit:p[3]}));
    const items = cloudProds.filter(p => quantities[p.id] > 0);
    
    if (items.length === 0) return alert("Seleziona almeno un prodotto!");

    let bodyText = "Buongiorno, vorrei richiedere i seguenti materiali:\n\n";
    items.forEach(p => bodyText += `- ${p.name}: ${quantities[p.id]} ${p.unit}\n`);
    bodyText += "\nGrazie e buona giornata!\n";

    // 1. Copia negli appunti con feedback visivo sul tasto
    try {
        await navigator.clipboard.writeText(bodyText);
        if (btn) {
            btn.innerHTML = "✅ Copiato negli appunti! Apertura mail.";
            btn.style.backgroundColor = "var(--gold)";
            btn.classList.add('loading-btn');
        }
    } catch (err) {
        console.error("Impossibile copiare negli appunti", err);
    }

    // 2. Salvataggio nel database Cloud
    await saveToCloud('ordini', { 
        user: currentUser.email, 
        items: bodyText.replace("Buongiorno, vorrei richiedere i seguenti materiali:\n\n", ""), 
        total: items.length 
    });

    // 3. Apertura client di posta
    const email = document.getElementById('modal-recv-email').value;
    window.location.href = `mailto:${email}?subject=Ordine Materiale&body=${encodeURIComponent(bodyText)}`;
    
    // 4. Reset interfaccia con un piccolo ritardo (per mostrare il tasto "Copiato")
    setTimeout(() => {
        closeOrderModal();
        if (btn) {
            btn.innerHTML = originalBtnText;
            btn.style.backgroundColor = ""; 
            btn.classList.remove('loading-btn');
        }
        quantities = {};
        renderProducts();
        updateFab();
    }, 1500);
}

function renderHistory() {
    if (!currentUser || !currentUser.email) return;
    // Filtriamo gli ordini dell'utente corrente
    const myOrders = (db.ordini || []).slice(1).filter(o => o[1] === currentUser.email);
    const container = document.getElementById('history-list');
    if (!container) return;
    if (myOrders.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:var(--text3); margin-top:20px;'>Nessun ordine trovato.</p>";
        return;
    }

    // Usiamo reverse() per vedere i più recenti in alto
    // Creiamo una copia per non invertire l'array originale del DB
    const displayOrders = [...myOrders].reverse();

    container.innerHTML = displayOrders.map((o, index) => {
        const date = new Date(o[0]).toLocaleDateString('it-IT', { 
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        
        // Calcoliamo l'indice originale nell'array myOrders per recuperare i dati corretti
        const originalIndex = myOrders.length - 1 - index;

        return `
        <div style="background:white; padding:15px; border-radius:12px; margin-bottom:10px; border:1px solid var(--border);">
            <div class="history-card-header">
                <div>
                    <div style="font-size:11px; color:var(--text3);">${date}</div>
                    <div style="font-size:13px; font-weight:600; margin-top:5px;">Ordine #${myOrders.length - index}</div>
                </div>
                <button class="btn-details" onclick="showHistoryDetail(${originalIndex})">Dettagli</button>
            </div>
        </div>
        `;
    }).join('');
}

function showHistoryDetail(index) {
    // Recuperiamo di nuovo la lista filtrata per trovare l'ordine all'indice corretto
    const myOrders = (db.ordini || []).slice(1).filter(o => o[1] === currentUser.email);
    const order = myOrders[index];

    if (!order) return;

    const date = new Date(order[0]).toLocaleDateString('it-IT', { 
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    const itemsText = order[2]; // Il testo dell'ordine salvato nel foglio

    document.getElementById('history-detail-date').textContent = "Inviato il: " + date;
    const listContainer = document.getElementById('history-detail-list');

    // Dividiamo il testo per righe e creiamo la lista
    const lines = itemsText.split('\n').filter(line => line.trim() !== "");
    
    listContainer.innerHTML = lines.map(line => {
        // Puliamo la riga (rimuovendo il trattino iniziale se presente)
        const cleanLine = line.replace(/^- /, "").trim();
        return `
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); font-size:14px;">
            <span style="flex:1;">${cleanLine}</span>
        </div>
        `;
    }).join('');

    document.getElementById('history-modal').style.display = 'flex';
}

init();