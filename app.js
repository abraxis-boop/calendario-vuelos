// ── CONFIG ──────────────────────────────────────────────────────
const APP_ID  = 'dc1776cd-0755-452a-98e0-55ee2b5896c1';
const API_KEY = 'V2-g6t83-Fm2aG-kK7cO-tMKW0-Xr9Ut-ULIHd-PRRYm-Plpqu';

// Tabla de vuelos
const TABLA_VUELOS = 'Vuelos';
const URL_VUELOS   = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${TABLA_VUELOS}/Action`;

// Tabla de tours (rentas de sprinter/camión)
// Si tu tabla de Tours vive en OTRA app de AppSheet, cambia APP_ID_TOURS abajo.
const APP_ID_TOURS = APP_ID;
const TABLA_TOURS  = 'Tours';
const URL_TOURS    = `https://api.appsheet.com/api/v2/apps/${APP_ID_TOURS}/tables/${TABLA_TOURS}/Action`;

// ── COLUMNAS DE APPSHEET: VUELOS ─────────────────────────────────
const COL = {
  aerolinea:  'nombre_aerolinea',
  hora:       'hora',
  aplicantes: 'nombres_aplicantes_list',
  fecha:      'fecha',
  codigo:     'codigo_vuelo',
  numVuelo:   'numero_vuelo',
  tipoVuelo:  'tipo_vuelo',
  direccion:  'Salida o regreso',
  titulo:     'encabezado_calendario'
};

// ── COLUMNAS DE APPSHEET: TOURS ──────────────────────────────────
const COL_T = {
  id:               'id_tour',
  nombre:           'nombre_tour',
  fechaHoraSalida:  'fecha_hora_salida',
  fechaHoraRegreso: 'fecha_hora_regreso',
  capacidad:        'capacidad',
  costoUno:         'costo_uno',
  costoDos:         'costo_dos',
  costoTres:        'costo_tres',
  costoCuatro:      'costo_cuatro',
  descripcion:      'descripcion',
  notas:            'notas',
  lugar:            'lugar',
  vehiculo:         'cotizacion_vechiculo',
  gastosFijos:      'gastos_fijos'
};

// ── INTERVALO DE ACTUALIZACIÓN ───────────────────────────────────
const INTERVALO_ACTUALIZACION = 4 * 60 * 1000;

// ── CONSTANTES ───────────────────────────────────────────────────
const DIAS_ES    = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_CORTO = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const MESES_ES   = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

let vuelos = [];
let tours  = [];

// ── NAVEGACIÓN DE SEMANA ─────────────────────────────────────────
// 0 = semana actual, 1 = próxima semana, -1 = semana pasada, etc.
let semanaOffset = 0;
let semanaResetTimer = null;
const SEMANA_INACTIVIDAD_MS = 3 * 60 * 1000; // regresa solo a "hoy" a los 3 min

// ── INICIO ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  reloj();
  clima();
  cargar();
  setInterval(reloj, 1000);
  setInterval(clima, 30 * 60 * 1000);
  setInterval(cargar, INTERVALO_ACTUALIZACION);
  setInterval(autoScroll, 4000);

  document.getElementById('semanaPrev').addEventListener('click', () => cambiarSemana(-1));
  document.getElementById('semanaNext').addEventListener('click', () => cambiarSemana(1));
  document.getElementById('semanaHoy').addEventListener('click', () => cambiarSemana(0, true));
});

// ── RELOJ ────────────────────────────────────────────────────────
function reloj() {
  const n = new Date();
  document.getElementById('reloj').textContent =
    n.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('relojFecha').textContent =
    `${DIAS_ES[n.getDay()]} ${n.getDate()} de ${MESES_ES[n.getMonth()]}`;
  document.getElementById('fechaHoy').textContent =
    `${DIAS_ES[n.getDay()]}, ${n.getDate()} de ${MESES_ES[n.getMonth()]}`;
}

// ── CLIMA (Open-Meteo, sin API key) ─────────────────────────────
async function clima() {
  try {
    const r = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=21.5089&longitude=-104.8947&current=temperature_2m,weather_code&timezone=auto'
    );
    const d = await r.json();
    const t = Math.round(d.current.temperature_2m);
    const c = d.current.weather_code;
    const map = {
      0:  ['☀️', 'Despejado'],
      1:  ['🌤', 'Mayormente despejado'],
      2:  ['⛅', 'Parcialmente nublado'],
      3:  ['☁️', 'Nublado'],
      45: ['🌫', 'Neblina'],
      48: ['🌫', 'Neblina'],
      51: ['🌦', 'Llovizna'],
      61: ['🌧', 'Lluvia'],
      63: ['🌧', 'Lluvia moderada'],
      80: ['🌦', 'Chubascos'],
      95: ['⛈', 'Tormenta'],
      96: ['⛈', 'Tormenta con granizo']
    };
    const [icon, desc] = map[c] || ['🌡', 'Variable'];
    document.getElementById('climaIcon').textContent = icon;
    document.getElementById('climaTemp').textContent = `${t}°C`;
    document.getElementById('climaDesc').textContent = desc + ' · Tepic';
  } catch { /* silencioso — no rompe el quiosco */ }
}

// ── NORMALIZAR FECHA ─────────────────────────────────────────────
// Soporta formatos: YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, DD/MM/YYYY
function normFecha(s) {
  if (!s) return '';
  const p = s.toString().split(' ')[0].trim();
  if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(p)) {
    const [y, m, d] = p.split(/[-\/]/);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(p)) {
    const [a, b, y] = p.split(/[-\/]/);
    return parseInt(a) > 12
      ? `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
      : `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
  }
  return p;
}

// Separa un valor "fecha y hora" (fecha_hora_salida / fecha_hora_regreso)
// en { fecha: 'YYYY-MM-DD', hora: 'HH:MM' }. Soporta separador espacio o 'T'.
function partirFechaHora(s) {
  if (!s) return null;
  const str = s.toString().trim();
  const partes = str.split(/[T ]+/);
  const fecha = normFecha(partes[0]);
  let hora = '';
  if (partes[1]) {
    const m = partes[1].match(/^(\d{1,2}):(\d{2})/);
    if (m) hora = `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  if (!fecha) return null;
  return { fecha, hora };
}

// Código corto y legible para identificar el mismo viaje en dos tarjetas
// distintas (cuando salida y regreso caen en días diferentes).
function codigoTour(id) {
  if (!id) return '—';
  const s = id.toString().replace(/[^a-zA-Z0-9]/g, '');
  return 'T-' + s.slice(-4).toUpperCase();
}

function formatoFechaCorta(fechaISO) {
  if (!fechaISO) return '—';
  const [y, m, d] = fechaISO.split('-').map(Number);
  if (!y) return fechaISO;
  return `${d} ${MESES_ES[m - 1].slice(0, 3)}`;
}

function fechaStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function esc(v) {
  return v == null ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

// ── CARGAR APPSHEET (vuelos + tours en paralelo) ─────────────────
async function pedirTabla(url) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'applicationAccessKey': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ Action: 'Find', Properties: { Locale: 'es-MX' }, Rows: [] })
  });
  if (!r.ok) throw new Error(r.status);
  const d = await r.json();
  return Array.isArray(d) ? d : (d.Rows || []);
}

async function cargar() {
  try {
    const [vRes, tRes] = await Promise.all([
      pedirTabla(URL_VUELOS),
      pedirTabla(URL_TOURS)
    ]);
    vuelos = vRes;
    tours  = tRes;
    render();
    document.getElementById('overlay').classList.add('oculto');
  } catch (e) {
    console.error('AppSheet error:', e);
    // Reintenta en 30 segundos si falla la conexión
    setTimeout(cargar, 30000);
  }
}

// ── MODELO UNIFICADO: mezclar vuelos + tours en "eventos" ────────
// Cada vuelo produce 1 evento. Cada tour produce hasta 2 eventos
// (uno para fecha_hora_salida y otro para fecha_hora_regreso),
// para que se intercalen por hora igual que los vuelos.
function construirEventos() {
  const eventosVuelos = vuelos.map(v => ({
    tipo:      'vuelo',
    fecha:     normFecha(v[COL.fecha]),
    hora:      v[COL.hora] || '',
    direccion: esDir(v, 'regreso') ? 'regreso' : 'salida',
    titulo:    v[COL.aerolinea] || v[COL.titulo] || '—',
    etiqueta:  v[COL.tipoVuelo] || '',
    refLabel:  'Vuelo',
    ref:       v[COL.numVuelo] || '—',
    personasLabel: 'Pasajeros',
    personas:  v[COL.aplicantes] || '0',
    extraLabel: 'Código de confirmación',
    extra:     v[COL.codigo] || '—'
  }));

  const eventosTours = [];
  tours.forEach(t => {
    const salida  = partirFechaHora(t[COL_T.fechaHoraSalida]);
    const regreso = partirFechaHora(t[COL_T.fechaHoraRegreso]);
    const codigo = codigoTour(t[COL_T.id]);
    const base = {
      tipo:      'tour',
      titulo:    t[COL_T.nombre] || '—',
      etiqueta:  'Tour',
      codigo,
      personasLabel: 'Capacidad',
      personas:  t[COL_T.capacidad] || '0',
      vehiculoLugar: [t[COL_T.vehiculo], t[COL_T.lugar]].filter(Boolean).join(' · ') || '—'
    };

    // Mismo día: se unen en UNA sola tarjeta "redondo" (salida → regreso)
    if (salida && regreso && salida.fecha === regreso.fecha) {
      eventosTours.push({
        ...base,
        variante:   'redondo',
        fecha:      salida.fecha,
        hora:       salida.hora,       // clave de orden
        horaSalida: salida.hora,
        horaRegreso: regreso.hora,
        direccion:  'redondo'
      });
      return;
    }

    // Días distintos (renta de varios días): tarjetas separadas, enlazadas por código
    if (salida) {
      eventosTours.push({
        ...base,
        variante:  'tramo',
        fecha:     salida.fecha,
        hora:      salida.hora,
        direccion: 'salida',
        parInfo:   regreso ? `Regresa: ${formatoFechaCorta(regreso.fecha)}, ${regreso.hora || '—'}` : ''
      });
    }
    if (regreso) {
      eventosTours.push({
        ...base,
        variante:  'tramo',
        fecha:     regreso.fecha,
        hora:      regreso.hora,
        direccion: 'regreso',
        parInfo:   salida ? `Salió: ${formatoFechaCorta(salida.fecha)}, ${salida.hora || '—'}` : ''
      });
    }
  });

  return [...eventosVuelos, ...eventosTours];
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────────
function render() {
  const eventos = construirEventos();
  renderHoy(eventos);
  renderSemana(eventos);
  renderProximo(eventos);
}

// ── TARJETA COMPARTIDA (vuelo o tour) ─────────────────────────────
function tarjetaHoy(ev, pasado) {
  if (ev.tipo === 'tour') return tarjetaHoyTour(ev, pasado);

  const dir = ev.direccion === 'regreso' ? 'regreso' : 'salida';
  const iconoDir = dir === 'salida' ? '🛫 Salida' : '🛬 Regreso';
  return `
    <div class="card-hoy ${dir} tipo-vuelo ${pasado ? 'pasado' : ''}">
      <div class="card-hoy-top">
        <div class="card-hora">${esc(ev.hora) || '—'}</div>
        <div class="card-hoy-badges">
          <span class="badge-dir ${dir}">${iconoDir}</span>
          <span class="badge-tipo">${esc(ev.etiqueta) || ''}</span>
        </div>
      </div>
      <div class="card-aero">${esc(ev.titulo)}</div>
      <div class="card-hoy-datos">
        <div class="dato-item"><span>${esc(ev.refLabel)}</span><strong>${esc(ev.ref)}</strong></div>
        <div class="dato-item"><span>${esc(ev.personasLabel)}</span><strong>👥 ${esc(ev.personas)}</strong></div>
        <div class="dato-item full"><span>${esc(ev.extraLabel)}</span><strong>🔑 ${esc(ev.extra)}</strong></div>
      </div>
    </div>`;
}

function tarjetaHoyTour(ev, pasado) {
  if (ev.variante === 'redondo') {
    // Mismo día: salida y regreso juntos en una sola tarjeta
    return `
      <div class="card-hoy redondo tipo-tour ${pasado ? 'pasado' : ''}">
        <div class="card-hoy-top">
          <div class="card-hora-rango">
            <span>${esc(ev.horaSalida) || '—'}</span>
            <span class="rango-flecha">→</span>
            <span>${esc(ev.horaRegreso) || '—'}</span>
          </div>
          <div class="card-hoy-badges">
            <span class="badge-dir redondo">🚐 Redondo</span>
            <span class="badge-tipo">${esc(ev.codigo)}</span>
          </div>
        </div>
        <div class="card-aero">${esc(ev.titulo)}</div>
        <div class="card-hoy-datos">
          <div class="dato-item"><span>Capacidad</span><strong>👥 ${esc(ev.personas)}</strong></div>
          <div class="dato-item"><span>Código</span><strong>${esc(ev.codigo)}</strong></div>
          <div class="dato-item full"><span>Vehículo / Lugar</span><strong>🔑 ${esc(ev.vehiculoLugar)}</strong></div>
        </div>
      </div>`;
  }

  // Días distintos: tramo individual, enlazado por código + texto del par
  const dir = ev.direccion === 'regreso' ? 'regreso' : 'salida';
  const iconoDir = dir === 'salida' ? '🚐 Salida' : '🚐 Regreso';
  return `
    <div class="card-hoy ${dir} tipo-tour ${pasado ? 'pasado' : ''}">
      <div class="card-hoy-top">
        <div class="card-hora">${esc(ev.hora) || '—'}</div>
        <div class="card-hoy-badges">
          <span class="badge-dir ${dir}">${iconoDir}</span>
          <span class="badge-tipo">${esc(ev.codigo)}</span>
        </div>
      </div>
      <div class="card-aero">${esc(ev.titulo)}</div>
      <div class="card-hoy-datos">
        <div class="dato-item"><span>Capacidad</span><strong>👥 ${esc(ev.personas)}</strong></div>
        <div class="dato-item"><span>Código</span><strong>${esc(ev.codigo)}</strong></div>
        <div class="dato-item full"><span>${ev.parInfo ? esc(ev.parInfo) : 'Vehículo / Lugar'}</span><strong>${ev.parInfo ? '' : '🔑 ' + esc(ev.vehiculoLugar)}</strong></div>
      </div>
    </div>`;
}

function tarjetaSemana(ev, pasado) {
  if (ev.tipo === 'tour' && ev.variante === 'redondo') {
    return `
      <div class="vuelo-sem redondo tipo-tour ${pasado ? 'pasado' : ''}">
        <div class="vsem-hora-rango">${esc(ev.horaSalida) || '—'} → ${esc(ev.horaRegreso) || '—'}</div>
        <div class="vsem-aero">${esc(ev.titulo)}</div>
        <div class="vsem-bottom">
          <span>🚐 ${esc(ev.codigo)}</span>
          <span class="vsem-badge redondo">IDA Y VUELTA</span>
        </div>
      </div>`;
  }

  const dir = ev.direccion === 'regreso' ? 'regreso' : 'salida';
  const icono = ev.tipo === 'tour' ? '🚐' : '✈';
  const ref = ev.tipo === 'tour' ? ev.codigo : ev.ref;
  return `
    <div class="vuelo-sem ${dir} tipo-${ev.tipo} ${pasado ? 'pasado' : ''}">
      <div class="vsem-hora">${esc(ev.hora) || '—'}</div>
      <div class="vsem-aero">${esc(ev.titulo)}</div>
      <div class="vsem-bottom">
        <span>${icono} ${esc(ref)}</span>
        <span class="vsem-badge ${dir}">${dir === 'salida' ? 'SAL' : 'REG'}</span>
      </div>
    </div>`;
}

// ── PANEL HOY ────────────────────────────────────────────────────
function renderHoy(eventos) {
  const hoy   = fechaStr(new Date());
  const ahora = new Date();
  const hhmm  = ahora.getHours() * 60 + ahora.getMinutes();

  const vHoyTodos = eventos
    .filter(ev => ev.fecha === hoy)
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  document.getElementById('stTotal').textContent = vHoyTodos.length;
  document.getElementById('stSal').textContent   = vHoyTodos.filter(ev => ev.direccion === 'salida' || ev.variante === 'redondo').length;
  document.getElementById('stReg').textContent   = vHoyTodos.filter(ev => ev.direccion === 'regreso' || ev.variante === 'redondo').length;

  const pendientes = vHoyTodos.filter(ev => !evPasado(ev, hhmm)).length;
  document.getElementById('subTitulo').textContent =
    `${pendientes} pendiente${pendientes !== 1 ? 's' : ''} de ${vHoyTodos.length} hoy · Actualiza cada ${INTERVALO_ACTUALIZACION / 60000} min`;

  const lista = document.getElementById('listaHoy');
  if (!vHoyTodos.length) {
    lista.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.25); padding:40px 16px; font-size:13px;">Sin operaciones programadas hoy</div>`;
    return;
  }

  lista.innerHTML = vHoyTodos.map(ev => tarjetaHoy(ev, evPasado(ev, hhmm))).join('');
}

// Cambia la semana visible. resetDirecto=true fuerza volver a "hoy" (botón Hoy).
function cambiarSemana(delta, resetDirecto = false) {
  semanaOffset = resetDirecto ? 0 : semanaOffset + delta;
  renderSemana(construirEventos());

  clearTimeout(semanaResetTimer);
  if (semanaOffset !== 0) {
    semanaResetTimer = setTimeout(() => {
      semanaOffset = 0;
      renderSemana(construirEventos());
    }, SEMANA_INACTIVIDAD_MS);
  }
}

// ── PANEL SEMANA ─────────────────────────────────────────────────
function renderSemana(eventos) {
  const hoy   = new Date();
  const dow   = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1) + semanaOffset * 7);

  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });

  const hoyStr = fechaStr(hoy);
  const ahora  = hoy.getHours() * 60 + hoy.getMinutes();

  document.getElementById('semanaRango').textContent =
    `${semana[0].getDate()} de ${MESES_ES[semana[0].getMonth()]} — ${semana[6].getDate()} de ${MESES_ES[semana[6].getMonth()]}`;

  document.getElementById('semanaHoy').classList.toggle('activo', semanaOffset === 0);

  const grid = document.getElementById('semanaGrid');
  grid.innerHTML = semana.map((fecha, i) => {
    const str   = fechaStr(fecha);
    const esHoy = str === hoyStr;

    const vDia = eventos
      .filter(ev => ev.fecha === str)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

    const filas = vDia.length
      ? vDia.map(ev => tarjetaSemana(ev, esHoy && evPasado(ev, ahora))).join('')
      : `<div class="dia-vacio">Sin operaciones</div>`;

    return `
      <div class="dia-col ${esHoy ? 'es-hoy' : ''}">
        <div class="dia-head">
          <div class="dia-nombre">${DIAS_CORTO[i]}</div>
          <div class="dia-fecha-str">${fecha.getDate()} ${MESES_ES[fecha.getMonth()].slice(0, 3)}</div>
          <span class="dia-count-pill">${vDia.length}</span>
        </div>
        <div class="dia-lista">
          <div class="dia-lista-inner" id="dl-${i}">${filas}</div>
        </div>
      </div>`;
  }).join('');
}

// ── BARRA: PRÓXIMA OPERACIÓN ─────────────────────────────────────
function renderProximo(eventos) {
  const hoy   = fechaStr(new Date());
  const ahora = new Date();
  const hhmm  = ahora.getHours() * 60 + ahora.getMinutes();

  const proximos = eventos
    .filter(ev => ev.fecha === hoy && !evPasado(ev, hhmm))
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  const bar = document.getElementById('proximoBar');

  if (!proximos.length) {
    bar.style.display = 'none';
    return;
  }

  const p     = proximos[0];
  const min   = minutosHasta(p.hora, hhmm);
  const icono = p.tipo === 'tour' ? '🚐' : '✈';
  const txt   = min <= 0  ? 'AHORA'
              : min < 60  ? `en ${min} min`
              : min < 120 ? `en 1 h ${min % 60} min`
              : `en ${Math.floor(min / 60)} h`;

  bar.style.display = 'flex';
  bar.innerHTML = `
    <span>${icono} PRÓXIMA OPERACIÓN</span>
    <span class="sep">|</span>
    <span>${esc(p.hora)} — ${esc(p.titulo)}</span>
    <span class="sep">|</span>
    <span>${txt.toUpperCase()}</span>
    ${proximos.length > 1 ? `<span class="sep">|</span><span>${proximos.length - 1} más hoy</span>` : ''}
  `;
}

// ── AUTO-SCROLL ──────────────────────────────────────────────────
const scrollState = { hoy: 0, cols: Array(7).fill(0) };

function autoScroll() {
  scrollPanel('listaHoy', 'hoy');
  for (let i = 0; i < 7; i++) {
    const el = document.getElementById(`dl-${i}`);
    if (el) scrollInner(el, i);
  }
  renderProximo(construirEventos()); // actualizar contador regresivo
}

function scrollPanel(wrapperId, key) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  const parent = wrapper.parentElement;
  if (!parent) return;
  const maxScroll = wrapper.scrollHeight - parent.clientHeight;
  if (maxScroll <= 0) { scrollState[key] = 0; return; }
  scrollState[key] = Math.min(scrollState[key] + parent.clientHeight * 0.4, maxScroll);
  if (scrollState[key] >= maxScroll - 2) scrollState[key] = 0;
  wrapper.style.transform = `translateY(-${scrollState[key]}px)`;
}

function scrollInner(inner, i) {
  if (!inner) return;
  const parent = inner.parentElement;
  if (!parent) return;
  const maxScroll = inner.scrollHeight - parent.clientHeight;
  if (maxScroll <= 0) { scrollState.cols[i] = 0; return; }
  scrollState.cols[i] = Math.min(scrollState.cols[i] + parent.clientHeight * 0.9, maxScroll);
  if (scrollState.cols[i] >= maxScroll - 2) scrollState.cols[i] = 0;
  inner.style.transform = `translateY(-${scrollState.cols[i]}px)`;
}

// ── HELPERS ──────────────────────────────────────────────────────
function esDir(v, tipo) {
  return (v[COL.direccion] || '').toString().toLowerCase().includes(tipo);
}

// Para tours redondos, "pasado" se calcula con la hora de REGRESO
// (mientras van de ida, el viaje sigue activo, no se ve difuminado).
function evPasado(ev, hhmm) {
  if (ev.variante === 'redondo') return esPasado(ev.horaRegreso, hhmm);
  return esPasado(ev.hora, hhmm);
}

function esPasado(horaStr, hhmm) {
  if (!horaStr) return false;
  const [h, m] = horaStr.split(':').map(Number);
  return (h * 60 + (m || 0)) < hhmm;
}

function minutosHasta(horaStr, hhmm) {
  if (!horaStr) return 9999;
  const [h, m] = horaStr.split(':').map(Number);
  return (h * 60 + (m || 0)) - hhmm;
}
