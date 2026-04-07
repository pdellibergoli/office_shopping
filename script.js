let db = { utenti: [], prodotti: [], ordini: [] };
let currentUser = JSON.parse(sessionStorage.getItem('ou_user') || 'null');
let quantities = {};
let activeCat = 'tutti';

// ── INIZIALIZZAZIONE ──
async function init() {
    if (currentUser) {
        startApp();
    } else {
        await loadData();
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

// ── NAVIGAZIONE ──
function switchView(viewId, btn) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateFab();
}

// ── AUTH ──
function toggleAuth(screen) {
    document.getElementById('screen-login').style.display = screen === 'login' ? 'block' : 'none';
    document.getElementById('screen-signup').style.display = screen === 'signup' ? 'block' : 'none';
}

function handleAuth(mode) {
    if (mode === 'signup') {
        const name = document.getElementById('su-name').value;
        const email = document.getElementById('su-email').value;
        const pass = document.getElementById('su-pass').value;
        saveToCloud('utenti', { name, email, password: pass });
        alert("Registrazione inviata! Prova ad accedere tra 5 secondi.");
        toggleAuth('login');
    } else {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        const user = db.utenti.find(u => u[0] === email && u[1].toString() === pass);
        if (user) {
            currentUser = { email: user[0], name: user[2] };
            sessionStorage.setItem('ou_user', JSON.stringify(currentUser));
            startApp();
        } else {
            document.getElementById('login-err').style.display = 'block';
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

function doLogout() {
    sessionStorage.clear();
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
    // Filtriamo gli ordini dell'utente corrente
    const myOrders = (db.ordini || []).slice(1).filter(o => o[1] === currentUser.email);
    const container = document.getElementById('history-list');

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
            <span style="margin-right:10px;">📦</span>
            <span style="flex:1;">${cleanLine}</span>
        </div>
        `;
    }).join('');

    document.getElementById('history-modal').style.display = 'flex';
}

init();