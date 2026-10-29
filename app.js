// State management (updated schema for multiple contracts)
let state = {
    active_contract_id: "contract_default",
    contracts: {
        "contract_default": {
            "id": "contract_default",
            "project_name": "Contrato de Desarrollo / Consultoría",
            "client_name": "Cliente de Servicios Profesionales",
            "contract_total_usd": 4000.00,
            "payments": []
        }
    }
};

// Current fetched exchange rate from API
let liveExchangeRate = null;

// Persistence mode: 'server' or 'local'
let persistenceMode = 'server';

// Currency formatters
const formatterUSD = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const formatterARS = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const formatterRate = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

// DOM Elements
const elContractSelect = document.getElementById('contract-select');
const elBtnToggleNewContract = document.getElementById('btn-toggle-new-contract');
const elBtnDeleteActiveContract = document.getElementById('btn-delete-active-contract');
const elNewContractCard = document.getElementById('new-contract-card');
const elBtnCloseNewContract = document.getElementById('btn-close-new-contract');
const elNewContractForm = document.getElementById('new-contract-form');

const elContractTotal = document.getElementById('contract-total-display');
const elTotalPaid = document.getElementById('total-paid-display');
const elRemainingBalance = document.getElementById('remaining-balance-display');
const elRemainingBalanceArs = document.getElementById('remaining-balance-ars-display');
const elCurrentTcDisplay = document.getElementById('current-tc-display');
const elProgressBarFill = document.getElementById('progress-bar-fill');
const elProgressPercentage = document.getElementById('progress-percentage');
const elPaymentsTableBody = document.getElementById('payments-table-body');
const elEmptyState = document.getElementById('empty-state');
const elPaymentsTable = document.getElementById('payments-table');

// Form Elements (Payment)
const formPayment = document.getElementById('payment-form');
const inputDate = document.getElementById('pay-date');
const inputAmountArs = document.getElementById('pay-amount-ars');
const toggleAutoRate = document.getElementById('toggle-auto-rate');
const inputExchangeRate = document.getElementById('pay-exchange-rate');
const elCalculatedUsd = document.getElementById('calculated-usd');
const elLiveRateBadge = document.getElementById('live-rate-badge');
const elApiStatusDot = document.getElementById('api-status-dot');
const elApiStatusText = document.getElementById('api-status-text');
const btnRefreshRate = document.getElementById('btn-refresh-rate');
const inputNotes = document.getElementById('pay-notes');

// Settings Form Elements (Selected Contract Info)
const formSettings = document.getElementById('settings-form');
const inputConfigTotal = document.getElementById('config-total-usd');
const inputConfigClient = document.getElementById('config-client-name');
const inputConfigProject = document.getElementById('config-project-name');

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Set default date to today in local timezone
    const today = new Date().toISOString().split('T')[0];
    inputDate.value = today;

    // Load initial data from server
    loadData();

    // Fetch rate
    fetchExchangeRate();

    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Contract Switching & Lifecycle
    elContractSelect.addEventListener('change', (e) => {
        state.active_contract_id = e.target.value;
        loadActiveContractDetails();
        renderDashboard();
        saveData();
    });

    elBtnToggleNewContract.addEventListener('click', () => {
        elNewContractCard.style.display = 'block';
        document.getElementById('new-project-name').focus();
    });

    elBtnCloseNewContract.addEventListener('click', () => {
        elNewContractCard.style.display = 'none';
        elNewContractForm.reset();
    });

    elNewContractForm.addEventListener('submit', handleAddNewContract);
    elBtnDeleteActiveContract.addEventListener('click', handleDeleteActiveContract);

    // Live recalculation when amount or rate changes
    inputAmountArs.addEventListener('input', calculateEquivalentUSD);
    inputExchangeRate.addEventListener('input', () => {
        if (toggleAutoRate.checked) {
            toggleAutoRate.checked = false;
        }
        calculateEquivalentUSD();
        updatePendingBalanceArs();
    });

    toggleAutoRate.addEventListener('change', () => {
        if (toggleAutoRate.checked && liveExchangeRate) {
            inputExchangeRate.value = liveExchangeRate;
            inputExchangeRate.readOnly = true;
        } else {
            inputExchangeRate.readOnly = false;
        }
        calculateEquivalentUSD();
        updatePendingBalanceArs();
    });

    btnRefreshRate.addEventListener('click', (e) => {
        e.preventDefault();
        fetchExchangeRate();
    });

    // Save payment
    formPayment.addEventListener('submit', handleAddPayment);

    // Save active contract settings
    formSettings.addEventListener('submit', handleSaveSettings);
}

// UI Toast Notifications helper
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return null;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconHtml = '';
    if (type === 'loading') {
        iconHtml = '<div class="toast-spinner"></div>';
    } else if (type === 'success') {
        iconHtml = '<svg class="icon icon-sm" style="color: var(--color-success);" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
        iconHtml = '<svg class="icon icon-sm" style="color: var(--color-danger);" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    }

    toast.innerHTML = `${iconHtml}<span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    const remove = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    };

    let timer = null;
    if (duration > 0) {
        timer = setTimeout(remove, duration);
    }

    return {
        update(newMessage, newType = 'success', newDuration = 3000) {
            if (timer) clearTimeout(timer);
            toast.className = `toast toast-${newType} show`;
            let newIcon = '';
            if (newType === 'loading') {
                newIcon = '<div class="toast-spinner"></div>';
            } else if (newType === 'success') {
                newIcon = '<svg class="icon icon-sm" style="color: var(--color-success);" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            } else if (newType === 'error') {
                newIcon = '<svg class="icon icon-sm" style="color: var(--color-danger);" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            }
            toast.innerHTML = `${newIcon}<span>${newMessage}</span>`;
            if (newDuration > 0) {
                timer = setTimeout(remove, newDuration);
            }
        },
        close: remove
    };
}

/**
 * Función cliente para persistir contratos y pagos en Netlify Blobs
 * Envía el objeto contrato completo con sus pagos vía POST a /.netlify/functions/guardar-contrato
 * Maneja estados de loading, éxito y captura de errores con feedback al usuario
 */
async function saveContractToNetlify(contract) {
    if (!contract || !contract.id) {
        throw new Error('El objeto contrato debe incluir un identificador "id".');
    }

    const toast = showToast(`Guardando "${contract.project_name || 'Contrato'}" en Netlify Blobs...`, 'loading', 0);

    try {
        const response = await fetch('/.netlify/functions/guardar-contrato', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contract)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errorMsg = result.message || result.error || `Error HTTP ${response.status} al guardar en Netlify Blobs`;
            if (toast) toast.update(errorMsg, 'error', 4500);
            throw new Error(errorMsg);
        }

        if (toast) {
            toast.update('Guardado en Netlify Blobs con éxito', 'success', 2500);
        }

        return result.data;
    } catch (error) {
        console.error('Error al guardar en Netlify Blobs:', error);
        if (toast) {
            toast.update(`Fallo al guardar en Netlify: ${error.message}`, 'error', 4500);
        }
        throw error;
    }
}

// Carga inicial de datos: Prioridad 1: Netlify Blobs, Prioridad 2: PHP api.php, Fallback: LocalStorage
async function loadData() {
    const elModeBadge = document.getElementById('persistence-mode-badge');

    // 1. Intentar conectar con Netlify Functions (Netlify Blobs)
    try {
        const netlifyResponse = await fetch('/.netlify/functions/obtener-contratos');
        if (netlifyResponse.ok) {
            const netlifyPayload = await netlifyResponse.json();
            if (netlifyPayload && netlifyPayload.success && netlifyPayload.contracts) {
                persistenceMode = 'netlify';
                if (elModeBadge) {
                    elModeBadge.textContent = 'Modo: Netlify Blobs (Cloud)';
                    elModeBadge.style.backgroundColor = 'rgba(0, 223, 184, 0.12)';
                    elModeBadge.style.color = '#00dfb8';
                    elModeBadge.style.border = '1px solid rgba(0, 223, 184, 0.3)';
                }

                if (Object.keys(netlifyPayload.contracts).length > 0) {
                    state.contracts = netlifyPayload.contracts;
                    const savedActiveId = localStorage.getItem('valuation_ledger_active_id');
                    if (savedActiveId && state.contracts[savedActiveId]) {
                        state.active_contract_id = savedActiveId;
                    } else {
                        state.active_contract_id = Object.keys(state.contracts)[0];
                    }
                }
                initializeStateAndUI();
                return;
            }
        }
    } catch (netlifyErr) {
        // Netlify Functions no responde (ej. estamos corriendo bajo Apache / PHP nativo o localmente)
    }

    // 2. Intentar backend PHP tradicional si está disponible
    try {
        const phpResponse = await fetch('api.php');
        if (phpResponse.ok) {
            state = await phpResponse.json();
            persistenceMode = 'server';
            if (elModeBadge) {
                elModeBadge.textContent = 'Modo: Servidor (data.json)';
                elModeBadge.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                elModeBadge.style.color = 'var(--color-primary)';
                elModeBadge.style.border = 'none';
            }
            initializeStateAndUI();
            return;
        }
    } catch (phpErr) {
        // PHP no disponible
    }

    // 3. Fallback seguro a LocalStorage (Modo Offline o PWA estática)
    persistenceMode = 'local';
    if (elModeBadge) {
        elModeBadge.textContent = 'Modo: Offline (LocalStorage)';
        elModeBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        elModeBadge.style.color = 'var(--color-success)';
        elModeBadge.style.border = 'none';
    }

    const localData = localStorage.getItem('valuation_ledger_data');
    if (localData) {
        try {
            state = JSON.parse(localData);
        } catch (parseError) {
            console.error('Error parseando datos de LocalStorage:', parseError);
        }
    }

    initializeStateAndUI();
}

function initializeStateAndUI() {
    if (!state.contracts || Object.keys(state.contracts).length === 0) {
        state.contracts = {
            "contract_default": {
                "id": "contract_default",
                "project_name": "Contrato de Desarrollo / Consultoría",
                "client_name": "Cliente de Servicios Profesionales",
                "contract_total_usd": 4000.00,
                "payments": []
            }
        };
        state.active_contract_id = "contract_default";
    }

    populateContractSelect();
    loadActiveContractDetails();
    renderDashboard();
}

// Persistir contrato según el modo activo
async function saveData(specificContractId = null) {
    const contractId = specificContractId || state.active_contract_id;
    const activeContract = state.contracts[contractId];

    // Siempre respaldamos en LocalStorage para redundancia y modo offline
    localStorage.setItem('valuation_ledger_data', JSON.stringify(state));
    localStorage.setItem('valuation_ledger_active_id', state.active_contract_id);

    if (persistenceMode === 'netlify') {
        if (activeContract) {
            try {
                const saved = await saveContractToNetlify(activeContract);
                if (saved && saved.updatedAt) {
                    activeContract.updatedAt = saved.updatedAt;
                }
                if (saved && saved.createdAt) {
                    activeContract.createdAt = saved.createdAt;
                }
            } catch (err) {
                console.warn('Persistencia en Netlify falló; respaldo en LocalStorage mantenido.', err);
            }
        }
    } else if (persistenceMode === 'server') {
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });
            if (!response.ok) throw new Error('Error en respuesta de api.php');
            const result = await response.json();
            state = result.data;
        } catch (error) {
            console.error('Error al guardar en servidor PHP:', error);
        }
    }

    renderDashboard();
}

// Populate Selector dropdown
function populateContractSelect() {
    elContractSelect.innerHTML = '';
    Object.keys(state.contracts).forEach(cId => {
        const contract = state.contracts[cId];
        const option = document.createElement('option');
        option.value = cId;
        option.textContent = `${contract.project_name} (${contract.client_name})`;
        if (cId === state.active_contract_id) {
            option.selected = true;
        }
        elContractSelect.appendChild(option);
    });
}

// Load Active Contract parameters into editing form
function loadActiveContractDetails() {
    const activeContract = state.contracts[state.active_contract_id];
    if (activeContract) {
        inputConfigTotal.value = activeContract.contract_total_usd;
        inputConfigClient.value = activeContract.client_name;
        inputConfigProject.value = activeContract.project_name;
    }
}

// Create new contract
function handleAddNewContract(e) {
    e.preventDefault();
    
    const projectName = document.getElementById('new-project-name').value.trim();
    const clientName = document.getElementById('new-client-name').value.trim();
    const totalUsd = parseFloat(document.getElementById('new-total-usd').value);

    if (!projectName || !clientName || isNaN(totalUsd) || totalUsd <= 0) {
        alert('Por favor complete todos los campos con valores válidos.');
        return;
    }

    const newId = 'contract_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    state.contracts[newId] = {
        id: newId,
        project_name: projectName,
        client_name: clientName,
        contract_total_usd: totalUsd,
        payments: []
    };
    state.active_contract_id = newId;

    // Reset and hide form
    elNewContractForm.reset();
    elNewContractCard.style.display = 'none';

    // Save to server
    saveData().then(() => {
        populateContractSelect();
        loadActiveContractDetails();
    });
}

// Delete Active Contract
function handleDeleteActiveContract() {
    const activeContract = state.contracts[state.active_contract_id];
    if (!activeContract) return;

    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el contrato "${activeContract.project_name}" y todos sus pagos asociados? Esta acción no se puede deshacer.`)) {
        const idToDelete = state.active_contract_id;
        delete state.contracts[idToDelete];

        if (persistenceMode === 'netlify') {
            fetch(`/.netlify/functions/eliminar-contrato?id=${encodeURIComponent(idToDelete)}`, {
                method: 'POST'
            }).then(() => {
                showToast(`Contrato eliminado de Netlify Blobs`, 'info', 2500);
            }).catch(err => {
                console.warn('Error al eliminar en Netlify Blobs:', err);
            });
        }
        
        // Choose another contract to activate
        const remainingKeys = Object.keys(state.contracts);
        if (remainingKeys.length > 0) {
            state.active_contract_id = remainingKeys[0];
        } else {
            // Reset to default if everything is gone
            state.contracts = {
                "contract_default": {
                    "id": "contract_default",
                    "project_name": "Contrato de Desarrollo / Consultoría",
                    "client_name": "Cliente de Servicios Profesionales",
                    "contract_total_usd": 4000.00,
                    "payments": []
                }
            };
            state.active_contract_id = "contract_default";
        }

        saveData().then(() => {
            populateContractSelect();
            loadActiveContractDetails();
        });
    }
}

// Fetch exchange rate from DolarApi
async function fetchExchangeRate() {
    elApiStatusDot.className = 'indicator-dot';
    elApiStatusText.textContent = 'Actualizando...';
    
    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
        if (!response.ok) throw new Error('API response was not ok');
        const data = await response.json();
        
        if (data && data.venta) {
            liveExchangeRate = parseFloat(data.venta);
            
            // Update UI status
            elApiStatusDot.classList.add('online');
            elApiStatusText.textContent = 'API Conectada';
            
            // Update live rate display
            elLiveRateBadge.style.display = 'inline-flex';
            elLiveRateBadge.innerHTML = `
                <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
                BNA Venta: ${formatterRate.format(liveExchangeRate)} ARS
            `;
            
            // Auto fill if option is checked
            if (toggleAutoRate.checked) {
                inputExchangeRate.value = liveExchangeRate;
                inputExchangeRate.readOnly = true;
            }
            
            calculateEquivalentUSD();
            updatePendingBalanceArs();
        } else {
            throw new Error('Formato de datos de cotización no esperado');
        }
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        elApiStatusDot.classList.remove('online');
        elApiStatusText.textContent = 'Error API (Manual)';
        
        if (!liveExchangeRate) {
            toggleAutoRate.checked = false;
            inputExchangeRate.readOnly = false;
        }
    }
}

// Recalculate equivalent USD in the form
function calculateEquivalentUSD() {
    const amountArs = parseFloat(inputAmountArs.value) || 0;
    const rate = parseFloat(inputExchangeRate.value) || 0;
    
    if (amountArs > 0 && rate > 0) {
        const usdVal = amountArs / rate;
        elCalculatedUsd.textContent = `= ${formatterUSD.format(usdVal)}`;
        elCalculatedUsd.className = 'live-rate-badge';
    } else {
        elCalculatedUsd.textContent = '';
        elCalculatedUsd.className = '';
    }
}

// Add a payment to the active contract
function handleAddPayment(e) {
    e.preventDefault();
    
    const activeContract = state.contracts[state.active_contract_id];
    if (!activeContract) {
        alert('No hay un contrato activo seleccionado.');
        return;
    }
    
    const amountArs = parseFloat(inputAmountArs.value);
    const exchangeRate = parseFloat(inputExchangeRate.value);
    const date = inputDate.value;
    const notes = inputNotes.value.trim();
    
    if (!date) {
        alert('Por favor, ingresá una fecha válida.');
        return;
    }
    if (isNaN(amountArs) || amountArs <= 0) {
        alert('Por favor, ingresá un monto en ARS mayor a 0.');
        return;
    }
    if (isNaN(exchangeRate) || exchangeRate <= 0) {
        alert('Por favor, ingresá un tipo de cambio válido (mayor a 0).');
        return;
    }
    
    // Perform calculation
    const amountUsd = Math.round((amountArs / exchangeRate) * 100) / 100;
    
    const newPayment = {
        id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        date: date,
        amount_ars: amountArs,
        exchange_rate: exchangeRate,
        amount_usd: amountUsd,
        notes: notes
    };
    
    activeContract.payments.push(newPayment);
    
    // Reset form fields
    inputAmountArs.value = '';
    inputNotes.value = '';
    elCalculatedUsd.textContent = '';
    elCalculatedUsd.className = '';
    
    saveData();
}

// Save active contract settings changes
function handleSaveSettings(e) {
    e.preventDefault();
    
    const activeContract = state.contracts[state.active_contract_id];
    if (!activeContract) return;
    
    const newTotal = parseFloat(inputConfigTotal.value);
    if (isNaN(newTotal) || newTotal <= 0) {
        alert('El valor total del contrato debe ser mayor a 0.');
        return;
    }
    
    activeContract.contract_total_usd = newTotal;
    activeContract.client_name = inputConfigClient.value.trim();
    activeContract.project_name = inputConfigProject.value.trim();
    
    saveData().then(() => {
        populateContractSelect();
    });
    alert('Detalles del contrato actualizados correctamente.');
}

// Delete a payment from the active contract
function deletePayment(id) {
    const activeContract = state.contracts[state.active_contract_id];
    if (!activeContract) return;

    if (confirm('¿Estás seguro de que deseas eliminar este pago?')) {
        activeContract.payments = activeContract.payments.filter(p => p.id !== id);
        saveData();
    }
}

// Calculate and update the dynamic pending balance in ARS based on current rate
function updatePendingBalanceArs() {
    const activeContract = state.contracts[state.active_contract_id];
    if (!activeContract) return;

    const totalUSD = activeContract.contract_total_usd;
    
    let totalPaidUSD = 0;
    const payments = activeContract.payments || [];
    payments.forEach(p => {
        totalPaidUSD += p.amount_usd;
    });
    
    const remainingUSD = Math.max(0, totalUSD - totalPaidUSD);
    
    const activeExchangeRate = parseFloat(inputExchangeRate.value) || liveExchangeRate || 1000.00;
    const remainingARS = remainingUSD * activeExchangeRate;
    
    if (elRemainingBalanceArs) {
        elRemainingBalanceArs.textContent = formatterARS.format(remainingARS);
    }
    if (elCurrentTcDisplay) {
        elCurrentTcDisplay.textContent = formatterRate.format(activeExchangeRate);
    }
}

// Render active contract dashboard
function renderDashboard() {
    const activeContract = state.contracts[state.active_contract_id];
    if (!activeContract) return;

    const totalUSD = activeContract.contract_total_usd;
    
    let totalPaidUSD = 0;
    let totalPaidARS = 0;
    const payments = activeContract.payments || [];
    payments.forEach(p => {
        totalPaidUSD += p.amount_usd;
        totalPaidARS += p.amount_ars;
    });
    
    const remainingUSD = Math.max(0, totalUSD - totalPaidUSD);
    const progressPercent = totalUSD > 0 ? (totalPaidUSD / totalUSD) * 100 : 0;
    
    // Update metrics UI
    elContractTotal.textContent = formatterUSD.format(totalUSD);
    elTotalPaid.textContent = formatterARS.format(totalPaidARS);
    elRemainingBalance.textContent = formatterUSD.format(remainingUSD);
    
    // Update dynamic pending ARS card
    updatePendingBalanceArs();
    
    // Update Progress bar
    elProgressBarFill.style.width = `${Math.min(100, progressPercent)}%`;
    elProgressPercentage.textContent = `${progressPercent.toFixed(1)}%`;
    
    // Update metadata titles
    document.getElementById('client-title-display').textContent = activeContract.client_name || 'Cliente';
    document.getElementById('project-title-display').textContent = activeContract.project_name || 'Contrato de Servicios';
    
    // Render Payment List
    elPaymentsTableBody.innerHTML = '';
    
    if (payments.length === 0) {
        elEmptyState.style.display = 'flex';
        elPaymentsTable.style.display = 'none';
    } else {
        elEmptyState.style.display = 'none';
        elPaymentsTable.style.display = 'table';
        
        // Sort payments by date descending
        const sortedPayments = [...payments].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        sortedPayments.forEach((payment) => {
            const tr = document.createElement('tr');
            
            const dateParts = payment.date.split('-');
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : payment.date;
            
            tr.innerHTML = `
                <td class="font-mono text-semibold">${formattedDate}</td>
                <td>
                    <span class="badge badge-ars">ARS</span> 
                    <span class="font-mono">${formatterARS.format(payment.amount_ars)}</span>
                </td>
                <td class="font-mono text-muted">
                    $ ${formatterRate.format(payment.exchange_rate)}
                </td>
                <td>
                    <span class="badge badge-usd">USD</span> 
                    <span class="font-mono text-semibold text-success">${formatterUSD.format(payment.amount_usd)}</span>
                </td>
                <td class="notes-cell" title="${payment.notes || ''}">
                    ${payment.notes || '<span class="text-muted" style="opacity: 0.5;">-</span>'}
                </td>
                <td class="text-right">
                    <button class="btn btn-danger" onclick="deletePayment('${payment.id}')" title="Eliminar pago">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </td>
            `;
            
            elPaymentsTableBody.appendChild(tr);
        });
    }
}

// Register Service Worker for PWA (offline capability)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrado correctamente.', reg.scope))
            .catch(err => console.warn('Fallo al registrar el Service Worker.', err));
    });
}
