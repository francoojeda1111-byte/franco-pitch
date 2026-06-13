/* ════════════════════════════════════════════════════════════
   PITCH VENTAS — App Ejecutivo en Ventas · Pitch Marketing
   Lógica completa: sesión, ventas, metas, comisiones,
   descuentos, objeciones automáticas y feedback.
   ════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────── Helpers ─────────── */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const fmt = (n) => CLP.format(Math.round(n));

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
}

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d) { // lunes
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WORK_START = 9, WORK_END = 21, WORK_DAYS = 5;

/* ─────────── Estado ─────────── */

const STORE_KEY = 'pitchVentasState_v1';

const DEFAULTS = {
  user: null, // { name, rut }
  sales: [],  // { id, ts, plan:'40'|'50', amount, commission, comuna, payment, client, note }
  goals: { base: 10, increment: 2, dailyMin: 2, startDate: null },
  journal: [] // { id, ts, type:'aprendizaje'|'perdida', reason, text }
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      goals: { ...structuredClone(DEFAULTS.goals), ...(parsed.goals || {}) }
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* almacenamiento lleno o bloqueado */ }
}

/* ─────────── Datos: comunas, servicios, frases ─────────── */

const COMUNAS = [
  'Temuco', 'Padre Las Casas', 'Villarrica', 'Pucón', 'Pitrufquén', 'Freire', 'Gorbea', 'Loncoche',
  'Toltén', 'Nueva Imperial', 'Carahue', 'Puerto Saavedra', 'Teodoro Schmidt', 'Galvarino', 'Lautaro',
  'Perquenco', 'Vilcún', 'Cunco', 'Melipeuco', 'Curarrehue', 'Cholchol', 'Traiguén', 'Victoria',
  'Curacautín', 'Lonquimay', 'Angol', 'Renaico', 'Collipulli', 'Ercilla', 'Los Sauces', 'Purén',
  'Lumaco', 'Valdivia', 'Lanco', 'Máfil', 'Mariquina', 'Los Lagos', 'Panguipulli', 'Paillaco',
  'Futrono', 'La Unión', 'Río Bueno', 'Lago Ranco', 'Corral', 'Osorno', 'Puerto Montt', 'Puerto Varas',
  'Llanquihue', 'Frutillar', 'Calbuco', 'Purranque', 'Río Negro', 'Ancud', 'Castro', 'Quellón'
];

const SERVICES = [
  'Acceso libre al gimnasio 12 meses', 'Sala de musculación completa', 'Zona cardio (trotadoras y elípticas)',
  'Evaluación física inicial', 'Plan de entrenamiento personalizado', 'Plan nutricional básico',
  'Re-evaluación mensual de avance', 'Clases de spinning', 'Clases de zumba', 'Clases de baile entretenido',
  'Entrenamiento funcional', 'Cross training', 'Clases de yoga', 'Clases de pilates',
  'Clases de boxeo / kickboxing', 'Stretching y movilidad', 'GAP (glúteos, abdomen y piernas)', 'Body pump',
  'Sauna', 'Camarines y duchas', 'Casillero personal', 'App de seguimiento de rutinas',
  'Asesoría en suplementación', 'Dispensador de hidratación', '1 invitado gratis al mes',
  'Congelamiento de plan por viaje'
];

const QUOTES = [
  'El que más conversa, más vende.',
  'Tu próxima venta está a una conversación de distancia.',
  'No vendes un plan: vendes el cambio de vida de alguien.',
  'La constancia le gana al talento todos los días de la semana.',
  '2 ventas al día parecen poco. 10 a la semana te cambian el mes.',
  'El cliente no rechaza tu producto: rechaza tu inseguridad.',
  'Sonríe antes de hablar: se escucha en tu voz.',
  'Cada “no” es entrenamiento pagado para el próximo “sí”.',
  'El mejor momento para vender es justo después de una venta.',
  '¿Crédito o débito? El resto son detalles.',
  'Hoy alguien va a comprar. Que sea contigo.',
  'La calle premia al que llega primero y se va último.'
];

const PLAN_INFO = {
  '40': { amount: 39990, commission: 20000, label: '$39.990' },
  '50': { amount: 49990, commission: 25000, label: '$49.990' }
};

/* ─────────── Objeciones (motor automático) ─────────── */

const OBJECTIONS = [
  {
    title: '“No tengo plata”',
    tag: 'Precio',
    keywords: ['plata', 'dinero', 'caro', 'cara', 'alcanza', 'presupuesto', 'pobre', 'lucas', 'economico', 'no me da', 'sin un peso', 'cuesta mucho', 'muy alto'],
    response: 'Te entiendo perfectamente. De hecho, yo tampoco cuento con los $350.000 para invertir el día de mañana en mi gimnasio. Pero si divido los $39.990 en todos los servicios, vienes pagando $1.500 por cada uno. Entonces vamos al cierre: ¿cómo te acomoda más, crédito o débito?',
    tip: 'Nunca pelees el precio: divídelo hasta que parezca regalo ($1.500 por servicio, $110 al día) y cierra con doble alternativa.'
  },
  {
    title: '“Lo tengo que hablar con mi pareja”',
    tag: 'Tercero',
    keywords: ['pareja', 'esposa', 'esposo', 'marido', 'mujer', 'senora', 'polola', 'pololo', 'novia', 'novio', 'preguntarle', 'consultarlo', 'consultar', 'hablarlo con'],
    response: 'Te entiendo perfectamente. De hecho, a mí también me encanta comentarle las cosas a mi pareja antes de tomar cualquier decisión. Pero si tu pareja estuviera en este momento acá, ¿le gustaría la campaña, cierto? Perfecto, entonces ¿cómo te acomodaría más: con crédito o con débito?',
    tip: 'La pareja casi nunca es la objeción real. Haz que el cliente se responda a sí mismo (“le gustaría, ¿cierto?”) y pasa directo al cierre.'
  },
  {
    title: '“Tengo que ir a hacer algo y vuelvo”',
    tag: 'Postergación',
    keywords: ['vuelvo', 'hacer algo', 'mas rato', 'al rato', 'regreso', 'mas tarde', 'otro dia', 'despues paso', 'ahora no puedo', 'vengo despues', 'luego'],
    response: 'Perfecto, te entiendo. Pero ¿cuál sería la diferencia entre hacerlo ahora o después? Mira, me está quedando un solo certificado y no quiero que te quedes fuera de esta oportunidad. ¿Con qué te acomodas más: crédito o débito?',
    tip: 'El que se va “a hacer algo”, no vuelve. Cierra la diferencia entre ahora y después con urgencia real: el certificado que queda.'
  },
  {
    title: '“Lo tengo que pensar”',
    tag: 'Indecisión',
    keywords: ['pensar', 'pensarlo', 'lo pienso', 'decidir', 'no estoy seguro', 'no estoy segura', 'dudas', 'duda', 'dejame ver'],
    response: 'Te entiendo, es normal querer pensarlo. Pero dime una cosa: ¿qué es exactamente lo que tienes que pensar, el precio o el servicio? Si es el precio, recuerda que vienes pagando $1.500 por servicio. Y si es el servicio, tienes 12 meses completos para ocuparlo cuando quieras. La campaña termina hoy: ¿crédito o débito?',
    tip: '“Pensarlo” es una cortina: detrás siempre hay precio o desconfianza. Pregunta cuál es para rebatir la objeción real.'
  },
  {
    title: '“No tengo tiempo para ir”',
    tag: 'Tiempo',
    keywords: ['tiempo', 'ocupado', 'ocupada', 'trabajo mucho', 'no alcanzo', 'horario', 'turno', 'pega'],
    response: '¡Justo por eso te conviene! El plan es libre, sin horario fijo: el gimnasio abre de 6:00 a 23:00, y con 40 minutos 3 veces por semana ya ves resultados. Además tienes 12 meses completos para ocuparlo a tu ritmo. ¿Cómo lo dejamos: crédito o débito?',
    tip: 'Convierte la objeción en argumento: mientras menos tiempo tiene el cliente, más le sirve la flexibilidad del plan.'
  },
  {
    title: '“Ya tengo gimnasio”',
    tag: 'Competencia',
    keywords: ['ya tengo gim', 'otro gimnasio', 'ya entreno', 'ya estoy inscrito', 'ya estoy inscrita', 'ya voy a uno'],
    response: '¡Excelente! Eso significa que entrenar ya es parte de tu vida. Piénsalo así: por $39.990 al año —menos de lo que pagas allá en un mes— tienes un gimnasio completo de respaldo con 26 servicios incluidos. Los que entrenan en serio nunca le dicen que no a una segunda opción. ¿Crédito o débito?',
    tip: 'No ataques a la competencia: felicita al cliente y posiciona tu plan como el complemento obvio por precio.'
  },
  {
    title: '“Mándame la info por WhatsApp”',
    tag: 'Evasión',
    keywords: ['whatsapp', 'wsp', 'wasap', 'informacion', 'info', 'folleto', 'mandame', 'enviame', 'correo', 'mail', 'pagina web'],
    response: '¡Claro que sí, igual te la envío! Pero te cuento algo: la información no te guarda el cupo, el certificado sí, y me está quedando el último. Mejor lo dejamos asegurado ahora y la info te llega de respaldo. ¿Te acomoda más crédito o débito?',
    tip: '“Mándame la info” = “no” disfrazado. Acepta el envío, pero separa la info del cupo y cierra ahora.'
  },
  {
    title: '“No ando con tarjeta”',
    tag: 'Medio de pago',
    keywords: ['tarjeta', 'no ando con', 'no traigo', 'cajero', 'no tengo como pagar', 'sin tarjeta'],
    response: '¡Cero problema! Mira todas las opciones que tienes: te acompaño al cajero, puedes pagar por transferencia ahora mismo desde tu celular, o en efectivo. El que quiere encuentra la forma, y yo te la doy. ¿Cuál de las tres te acomoda más?',
    tip: 'Nunca dejes que el medio de pago mate la venta: siempre ofrece 3 caminos y deja que el cliente elija uno.'
  },
  {
    title: '“¿No será estafa? / No confío”',
    tag: 'Confianza',
    keywords: ['estafa', 'confio', 'confianza', 'seguro esto', 'no te creo', 'trucho', 'engano', 'falso', 'dudoso', 'chanta'],
    response: '¡Me encanta que lo preguntes, eso habla bien de ti! Mira: te muestro la página oficial, las redes con clientes reales, y al pagar te llega la boleta y el comprobante al instante a tu correo. Todo con contrato a la vista. Ahora que lo viste con tus propios ojos: ¿crédito o débito?',
    tip: 'La desconfianza se mata con evidencia, no con palabras: página, redes, boleta inmediata. Luego cierra sin miedo.'
  },
  {
    title: '“Estoy lesionado / tema de salud”',
    tag: 'Salud',
    keywords: ['lesion', 'lesionado', 'lesionada', 'enfermo', 'enferma', 'rodilla', 'espalda', 'operado', 'operada', 'embarazada', 'kinesiologo'],
    response: 'Mejor todavía: el plan parte con una evaluación física y rutinas adaptadas a tu condición, y el certificado dura 12 meses, así que partes cuando estés al 100%. Lo importante es asegurar el precio de campaña hoy, recuperado ya no estará. ¿Crédito o débito?',
    tip: 'La lesión es temporal, el precio de campaña también. Junta las dos urgencias y el cierre sale solo.'
  },
  {
    title: '“Me queda lejos”',
    tag: 'Distancia',
    keywords: ['lejos', 'queda a tras mano', 'no me queda cerca', 'vivo en otra', 'distancia', 'a desmano'],
    response: 'Te entiendo. ¿Y sabes qué es lo bueno? Tienes acceso libre durante 12 meses: aunque vengas solo cuando pases por acá, con un par de visitas al mes ya le sacaste el valor, porque vienes pagando $1.500 por servicio. ¿Cómo lo cerramos: crédito o débito?',
    tip: 'Contra la distancia, baja la vara: no necesita venir todos los días para que el plan se pague solo.'
  },
  {
    title: '“No me gusta el gimnasio / nunca he ido”',
    tag: 'Inseguridad',
    keywords: ['no me gusta', 'nunca he ido', 'flojera', 'verguenza', 'no se entrenar', 'no soy de gimnasio', 'me da cosa'],
    response: '¡Por eso mismo este plan es para ti! Nadie nace sabiendo: partes con una evaluación y un profesor que te arma la rutina paso a paso, y hay clases grupales donde nadie se fija en nadie porque todos van empezando. El primer mes te cambia la vida. ¿Te lo dejo con crédito o débito?',
    tip: 'A los primerizos véndeles acompañamiento, no fierros: evaluación, profesor y clases grupales quitan el miedo.'
  }
];

const FALLBACK_RESPONSE = {
  tag: 'Fórmula Pitch',
  response: 'Esa objeción no la tengo registrada todavía, pero aplícale la fórmula Pitch que nunca falla: 1️⃣ VALIDA: “Te entiendo perfectamente…” (derriba la defensa). 2️⃣ REENCUADRA: dale vuelta a su favor — si es precio, divídelo; si es tiempo, muestra flexibilidad; si es miedo, muestra evidencia. 3️⃣ CIERRA: “¿Cómo te acomoda más: crédito o débito?”.',
  tip: 'Prueba escribiéndome: “no tengo plata”, “lo hablo con mi pareja” o “voy a hacer algo y vuelvo”.'
};

const TIPS = [
  { title: '1. Los primeros 5 segundos lo son todo', body: 'Sonrisa, energía y contacto visual. El cliente decide si te escucha antes de saber qué vendes: compra tu actitud primero y el plan después.' },
  { title: '2. Escucha 70, habla 30', body: 'El que pregunta dirige la venta. Deja que el cliente hable: él mismo te va a decir exactamente cómo venderle. Tu mejor argumento son sus propias palabras.' },
  { title: '3. Valida SIEMPRE antes de rebatir', body: '“Te entiendo perfectamente” desarma al cliente. Pelear contra la objeción la agranda; validarla la derrite. Primero empatía, después quiebre, al final cierre.' },
  { title: '4. Doble alternativa o nada', body: 'Nunca preguntes “¿lo quieres?” — esa pregunta tiene un “no” disponible. Pregunta “¿crédito o débito?”: las dos respuestas posibles son una venta.' },
  { title: '5. Ancla el precio en los $350.000', body: 'El cliente necesita ver primero el valor real del año completo. $39.990 no es barato ni caro por sí solo: es regalado COMPARADO con $350.000. Sin ancla no hay cierre.' },
  { title: '6. Urgencia real, no actuada', body: '“Me está quedando un certificado” solo funciona si lo dices con convicción. Habla en serio, mira a los ojos y deja que la escasez trabaje por ti.' },
  { title: '7. El “no” ya lo tienes', body: 'Saliste en la mañana con cero ventas: todo lo que cierres es ganancia. El miedo al rechazo es el impuesto que pagan los que no venden. Tú ya lo pagaste al salir.' },
  { title: '8. Espejea al cliente', body: 'Adapta tu velocidad, volumen y tono al suyo. La gente le compra a quien se le parece: si él habla pausado, baja un cambio; si es enérgico, súbele.' },
  { title: '9. El silencio cierra ventas', body: 'Después de preguntar “¿crédito o débito?”… CÁLLATE. El silencio incomoda y empuja la decisión. En ese momento, el primero que habla pierde.' },
  { title: '10. Cada “no” te acerca al “sí”', body: 'Si cierras 1 de cada 5, cada “no” vale $4.000 de tu próxima comisión de $20.000. Agradece el “no”, anótalo en Feedback y pasa al siguiente con la misma sonrisa.' },
  { title: '11. Cuida tu energía', body: 'Agua, comida y pausas cortas. La venta de las 19:00 merece la misma energía que la de las 9:00 — y muchas veces es la mejor del día.' },
  { title: '12. Registra TODO', body: 'Venta que no se anota, no existe. Objeción que no se estudia, se repite. Esta app es tu arma: úsala después de cada conversación, buena o mala.' }
];

const LOST_REASONS_PROMPTS = [
  '¿Anclaste el precio en los $350.000 antes de dar el valor de campaña?',
  '¿Cerraste con “¿crédito o débito?” o preguntaste “¿lo quieres?”',
  '¿Validaste la objeción antes de rebatirla?'
];

/* ─────────── Sesión / Login ─────────── */

function formatRut(value) {
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (!clean) return '';
  if (clean.length === 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return withDots + '-' + dv;
}

function validateRut(formatted) {
  const clean = formatted.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 7) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const expected = res === 11 ? '0' : res === 10 ? 'K' : String(res);
  return dv === expected;
}

function initLogin() {
  const rutInput = $('#login-rut');
  const hint = $('#rut-hint');

  rutInput.addEventListener('input', () => {
    rutInput.value = formatRut(rutInput.value);
    if (!rutInput.value) { hint.textContent = ''; hint.className = 'rut-hint'; return; }
    if (validateRut(rutInput.value)) {
      hint.textContent = '✓ RUT válido';
      hint.className = 'rut-hint ok';
    } else {
      hint.textContent = 'RUT incompleto (igual puedes entrar)';
      hint.className = 'rut-hint bad';
    }
  });

  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#login-name').value.trim();
    state.user = {
      name: name || 'Ejecutivo/a Pitch',
      rut: rutInput.value.trim()
    };
    if (!state.goals.startDate) state.goals.startDate = startOfWeek(new Date()).toISOString();
    saveState();
    showApp();
    toast(`¡Bienvenido/a, ${state.user.name.split(' ')[0]}! A romperla hoy 💜`);
  });

  $('#btn-logout').addEventListener('click', () => {
    if (!confirm('¿Cerrar sesión? Tus ventas y datos quedan guardados en este equipo.')) return;
    state.user = null;
    saveState();
    $('#app').classList.add('hidden');
    $('#screen-login').classList.remove('hidden');
  });
}

function showApp() {
  $('#screen-login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  renderAll();
  if (!chatStarted) startChat();
}

/* ─────────── Navegación ─────────── */

function initNav() {
  $$('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  $$('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.goto));
  });
}

function switchView(name) {
  $$('.nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─────────── Reloj y jornada (9:00 — 21:00) ─────────── */

function pad(n) { return String(n).padStart(2, '0'); }

function fmtDur(hoursFloat) {
  const totalMin = Math.max(0, Math.round(hoursFloat * 60));
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${pad(m)} min`;
}

function tickClock() {
  const now = new Date();
  $('#clock-time').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const h = now.getHours() + now.getMinutes() / 60;
  const pct = Math.min(100, Math.max(0, ((h - WORK_START) / (WORK_END - WORK_START)) * 100));
  const status = $('#clock-status');

  let text;
  if (h < WORK_START) {
    status.textContent = 'PRE JORNADA';
    status.className = 'clock-status off';
    text = `La jornada parte a las <strong>9:00</strong> — faltan <strong>${fmtDur(WORK_START - h)}</strong>. Repasa tus objeciones y llega con todo. ☕`;
  } else if (h < WORK_END) {
    status.textContent = 'EN JORNADA';
    status.className = 'clock-status on';
    text = `Llevas <strong>${fmtDur(h - WORK_START)}</strong> de jornada · Quedan <strong>${fmtDur(WORK_END - h)}</strong> hasta las 21:00. Cada hora es una oportunidad de cierre. 🔥`;
  } else {
    status.textContent = 'JORNADA FINALIZADA';
    status.className = 'clock-status off';
    text = 'Jornada finalizada 💪 Registra tus ventas, anota tu aprendizaje del día y descansa: mañana a las <strong>9:00</strong> se vende de nuevo.';
  }

  // Barra mini (Inicio)
  $('#inicio-jornada-fill').style.width = pct + '%';
  $('#inicio-jornada-marker').style.left = pct + '%';
  $('#inicio-jornada-text').innerHTML = text;

  // Timeline (Metas)
  $('#tl-fill').style.width = pct + '%';
  $('#tl-now').style.left = pct + '%';
  $('#tl-now-label').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $('#tl-text').innerHTML = text;
}

function tickGreeting() {
  const now = new Date();
  const h = now.getHours();
  const saludo = h < 12 ? '¡Buenos días' : h < 20 ? '¡Buenas tardes' : '¡Buenas noches';
  const firstName = state.user ? esc(state.user.name.split(' ')[0]) : '';
  $('#greeting').innerHTML = `${saludo}${firstName ? ', ' + firstName : ''}! 👋`;
  $('#today-date').textContent = now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('#foot-user').textContent = state.user ? `${state.user.name}${state.user.rut ? ' · ' + state.user.rut : ''}` : '';
}

/* ─────────── Metas: semana, plan progresivo ─────────── */

function currentWeekIndex() {
  const start = state.goals.startDate ? new Date(state.goals.startDate) : new Date();
  const diff = startOfWeek(new Date()) - startOfWeek(start);
  return Math.max(0, Math.round(diff / (7 * 864e5)));
}

function weeklyTarget(weekIdx) {
  return Math.max(10, state.goals.base + state.goals.increment * weekIdx);
}

function weekPlan(target, dailyMin) {
  // Distribución progresiva Lun→Vie: los últimos días cargan el extra
  const t = Math.max(target, dailyMin * WORK_DAYS);
  const base = Math.floor(t / WORK_DAYS);
  const rem = t - base * WORK_DAYS;
  return Array.from({ length: WORK_DAYS }, (_, i) =>
    Math.max(dailyMin, base + (i >= WORK_DAYS - rem ? 1 : 0))
  );
}

function salesInRange(from, to) {
  return state.sales.filter((s) => {
    const t = new Date(s.ts);
    return t >= from && t < to;
  });
}

function salesPerDayThisWeek() {
  const monday = startOfWeek(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d0 = new Date(monday); d0.setDate(monday.getDate() + i);
    const d1 = new Date(monday); d1.setDate(monday.getDate() + i + 1);
    return salesInRange(d0, d1).length;
  });
}

/* ─────────── Render: Inicio ─────────── */

function renderStats() {
  const now = new Date();
  const today0 = startOfDay(now);
  const tomorrow = new Date(today0); tomorrow.setDate(today0.getDate() + 1);
  const monday = startOfWeek(now);
  const nextMonday = new Date(monday); nextMonday.setDate(monday.getDate() + 7);

  const todaySales = salesInRange(today0, tomorrow);
  const weekSales = salesInRange(monday, nextMonday);
  const totalCommission = state.sales.reduce((a, s) => a + s.commission, 0);
  const todayCommission = todaySales.reduce((a, s) => a + s.commission, 0);

  const wIdx = currentWeekIndex();
  const target = weeklyTarget(wIdx);
  const plan = weekPlan(target, state.goals.dailyMin);
  const dayIdx = (now.getDay() + 6) % 7;
  const todayTarget = dayIdx < WORK_DAYS ? plan[dayIdx] : 0;

  $('#st-ventas-hoy').textContent = todaySales.length;
  $('#st-meta-hoy').textContent = dayIdx < WORK_DAYS
    ? (todaySales.length >= todayTarget ? `✓ Meta diaria cumplida (${todayTarget})` : `Meta diaria: ${todayTarget} — faltan ${todayTarget - todaySales.length}`)
    : 'Día extra: todo lo que cierres es bonus';
  $('#st-comision-hoy').textContent = fmt(todayCommission);
  $('#st-ventas-semana').textContent = weekSales.length;
  $('#st-meta-semana').textContent = `Meta semana ${wIdx + 1}: ${target} ventas`;
  $('#st-comision-total').textContent = fmt(totalCommission);
  $('#st-total-ventas').textContent = `${state.sales.length} venta${state.sales.length === 1 ? '' : 's'} acumuladas`;
}

function renderWeekChart() {
  const counts = salesPerDayThisWeek();
  const max = Math.max(2, ...counts);
  const dayIdx = (new Date().getDay() + 6) % 7;
  const monday = startOfWeek(new Date());
  $('#chart-week-label').textContent =
    `Semana del ${monday.getDate()}/${monday.getMonth() + 1}`;

  $('#week-chart').innerHTML = counts.map((c, i) => {
    const hPct = c === 0 ? 0 : Math.max(10, (c / max) * 100);
    return `
      <div class="wc-col">
        <span class="wc-num">${c || ''}</span>
        <div class="wc-bar-wrap">
          <div class="wc-bar ${c === 0 ? 'empty' : ''} ${i === dayIdx ? 'today' : ''}" style="height:${c === 0 ? 4 : hPct}%"></div>
        </div>
        <span class="wc-day ${i === dayIdx ? 'today' : ''}">${DAY_NAMES[i]}</span>
      </div>`;
  }).join('');
}

function renderQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  $('#daily-quote').textContent = '“' + QUOTES[dayOfYear % QUOTES.length] + '”';
}

/* ─────────── Render: Ventas ─────────── */

let salesFilter = 'hoy';

function filteredSales() {
  const now = new Date();
  const today0 = startOfDay(now);
  const tomorrow = new Date(today0); tomorrow.setDate(today0.getDate() + 1);
  const monday = startOfWeek(now);
  const nextMonday = new Date(monday); nextMonday.setDate(monday.getDate() + 7);

  if (salesFilter === 'hoy') return salesInRange(today0, tomorrow);
  if (salesFilter === 'semana') return salesInRange(monday, nextMonday);
  return [...state.sales];
}

function renderSales() {
  const list = filteredSales().sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const total = list.reduce((a, s) => a + s.amount, 0);
  const commission = list.reduce((a, s) => a + s.commission, 0);

  $('#sales-summary').innerHTML = `
    <span><strong>${list.length}</strong> venta${list.length === 1 ? '' : 's'}</span>
    <span>Vendido: <strong>${fmt(total)}</strong></span>
    <span class="accent">Tu comisión: <strong>${fmt(commission)}</strong></span>`;

  if (!list.length) {
    $('#sales-list').innerHTML = `<li class="empty-state">Aún no hay ventas ${salesFilter === 'hoy' ? 'hoy' : salesFilter === 'semana' ? 'esta semana' : 'registradas'}.<br/>¡La primera está esperándote en la calle! 🏃</li>`;
    return;
  }

  $('#sales-list').innerHTML = list.map((s) => {
    const d = new Date(s.ts);
    const when = `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()}/${d.getMonth() + 1} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `
      <li class="sale-item">
        <div class="sale-plan ${s.plan === '50' ? 'p50' : ''}">${s.plan}</div>
        <div class="sale-info">
          <div class="sale-top">${esc(s.comuna)}${s.client ? ' · ' + esc(s.client) : ''}</div>
          <div class="sale-meta">${when} · ${esc(s.payment)}${s.note ? ' · ' + esc(s.note) : ''}</div>
        </div>
        <div class="sale-amount">
          <strong>+${fmt(s.commission)}</strong>
          <span>${fmt(s.amount)}</span>
        </div>
        <button class="sale-del" data-id="${s.id}" title="Eliminar venta">✕</button>
      </li>`;
  }).join('');

  $$('#sales-list .sale-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('¿Eliminar esta venta del registro?')) return;
      state.sales = state.sales.filter((s) => s.id !== btn.dataset.id);
      saveState();
      renderAll();
      toast('Venta eliminada');
    });
  });
}

function renderComunas() {
  const byComuna = {};
  state.sales.forEach((s) => {
    const key = s.comuna.trim();
    if (!byComuna[key]) byComuna[key] = { count: 0, commission: 0 };
    byComuna[key].count++;
    byComuna[key].commission += s.commission;
  });

  const rows = Object.entries(byComuna).sort((a, b) => b[1].count - a[1].count);
  $('#comuna-total-badge').textContent = `${rows.length} comuna${rows.length === 1 ? '' : 's'}`;

  if (!rows.length) {
    $('#comuna-rank').innerHTML = `<div class="empty-state">Cuando registres ventas, acá verás el mapa de tus cierres por comuna. 📍</div>`;
    return;
  }

  const max = rows[0][1].count;
  $('#comuna-rank').innerHTML = rows.map(([name, data]) => `
    <div class="comuna-row">
      <span class="comuna-name" title="${esc(name)}">${esc(name)}</span>
      <div class="comuna-bar-wrap"><div class="comuna-bar" style="width:${(data.count / max) * 100}%"></div></div>
      <span class="comuna-count"><strong>${data.count}</strong> · ${fmt(data.commission)}</span>
    </div>`).join('');
}

function initSales() {
  $('#comunas-list').innerHTML = COMUNAS.map((c) => `<option value="${esc(c)}"></option>`).join('');

  $('#sale-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const plan = document.querySelector('input[name="plan"]:checked').value;
    const comuna = $('#sale-comuna').value.trim();
    if (!comuna) { toast('Indica la comuna de la venta 📍'); $('#sale-comuna').focus(); return; }

    const info = PLAN_INFO[plan];
    state.sales.push({
      id: uid(),
      ts: new Date().toISOString(),
      plan,
      amount: info.amount,
      commission: info.commission,
      comuna,
      payment: $('#sale-payment').value,
      client: $('#sale-client').value.trim(),
      note: $('#sale-note').value.trim()
    });
    saveState();

    $('#sale-comuna').value = '';
    $('#sale-client').value = '';
    $('#sale-note').value = '';

    renderAll();
    confetti();
    toast(`💰 ¡VENTA CERRADA! +${fmt(info.commission)} a tu bolsillo`);
  });

  $$('#sales-filter .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('#sales-filter .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      salesFilter = chip.dataset.range;
      renderSales();
    });
  });
}

/* ─────────── Render: Metas ─────────── */

function renderGoals() {
  const now = new Date();
  const wIdx = currentWeekIndex();
  const target = weeklyTarget(wIdx);
  const plan = weekPlan(target, state.goals.dailyMin);
  const counts = salesPerDayThisWeek();
  const weekTotal = counts.reduce((a, b) => a + b, 0);
  const dayIdx = (now.getDay() + 6) % 7;

  $('#goal-week-num').textContent = `Semana ${wIdx + 1}`;
  $('#goal-current').textContent = weekTotal;
  $('#goal-target').textContent = target;

  const pct = Math.min(100, (weekTotal / target) * 100);
  const fill = $('#goal-progress');
  fill.style.width = pct + '%';
  fill.classList.toggle('done', weekTotal >= target);

  let msg;
  if (weekTotal === 0) msg = '¡A la calle! La primera venta de la semana rompe el hielo. 🚀';
  else if (weekTotal < target) msg = `Te faltan ${target - weekTotal} venta${target - weekTotal === 1 ? '' : 's'} para la meta. ¡Se puede, vamos! 💪`;
  else msg = `🏆 ¡META CUMPLIDA! Llevas ${weekTotal}/${target}. Todo lo que venga ahora es puro récord y más comisión.`;
  $('#goal-msg').textContent = msg;

  // Plan de la semana (Lun-Vie con meta, Sáb-Dom extra)
  $('#week-plan').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const isWork = i < WORK_DAYS;
    const dayTarget = isWork ? plan[i] : 0;
    const done = isWork && counts[i] >= dayTarget;
    const cls = [
      'wp-day',
      i === dayIdx ? 'today' : '',
      done ? 'done' : '',
      !isWork ? 'rest' : ''
    ].join(' ');
    return `
      <div class="${cls}">
        <span class="wp-name">${DAY_NAMES[i]}</span>
        <span class="wp-count">${counts[i]}<small>/${isWork ? dayTarget : '—'}</small></span>
        <span class="wp-status">${done ? '✅' : isWork ? (i < dayIdx ? '⚠️' : '🎯') : '✨'}</span>
      </div>`;
  }).join('');

  // Escalera de metas (próximas semanas)
  $('#goal-ladder').innerHTML = Array.from({ length: 4 }, (_, k) => {
    const idx = wIdx + k;
    const t = weeklyTarget(idx);
    const minPay = t * PLAN_INFO['40'].commission;
    const maxPay = t * PLAN_INFO['50'].commission;
    return `
      <div class="ladder-row ${k === 0 ? 'current' : ''}">
        <span>${k === 0 ? '▶ ' : ''}Semana ${idx + 1} — <strong>${t} ventas</strong></span>
        <span class="ladder-money">${fmt(minPay)} – ${fmt(maxPay)}</span>
      </div>`;
  }).join('');
}

function initGoalsConfig() {
  $('#cfg-base').value = state.goals.base;
  $('#cfg-inc').value = state.goals.increment;
  $('#cfg-daily').value = state.goals.dailyMin;

  $('#cfg-save').addEventListener('click', () => {
    state.goals.base = Math.max(10, parseInt($('#cfg-base').value, 10) || 10);
    state.goals.increment = Math.max(0, parseInt($('#cfg-inc').value, 10) || 0);
    state.goals.dailyMin = Math.max(2, parseInt($('#cfg-daily').value, 10) || 2);
    $('#cfg-base').value = state.goals.base;
    $('#cfg-inc').value = state.goals.increment;
    $('#cfg-daily').value = state.goals.dailyMin;
    saveState();
    renderAll();
    toast('Metas actualizadas. Mínimo 10 a la semana, 2 al día: sí o sí 🔥');
  });
}

/* ─────────── Calculadora de comisiones ─────────── */

function renderCalc() {
  const n40 = Math.max(0, parseInt($('#calc-n40').value, 10) || 0);
  const n50 = Math.max(0, parseInt($('#calc-n50').value, 10) || 0);
  const days = Math.max(1, parseInt($('#calc-days').value, 10) || 1);

  const sales = n40 + n50;
  const total = n40 * PLAN_INFO['40'].commission + n50 * PLAN_INFO['50'].commission;
  const perDay = total / days;
  const salesPerDay = sales / days;

  $('#calc-result').innerHTML = `
    <div class="cr-big">${fmt(total)}</div>
    <div class="cr-sub"><strong>${sales} ventas</strong> en <strong>${days} día${days === 1 ? '' : 's'}</strong>
    · ≈ ${fmt(perDay)} al día · ${salesPerDay.toFixed(1)} ventas/día</div>`;
}

function renderProjections() {
  const projections = [
    { label: '10 ventas en 4 días', min: 10 * 20000, max: 10 * 25000 },
    { label: '25 ventas en 2 semanas', min: 25 * 20000, max: 25 * 25000 },
    { label: '50 ventas en 1 mes', min: 50 * 20000, max: 50 * 25000 },
    { label: '100 ventas en 2 meses', min: 100 * 20000, max: 100 * 25000 }
  ];
  $('#proj-cards').innerHTML = projections.map((p) => `
    <div class="proj-card">
      <span class="pj-label">${p.label}</span>
      <span class="pj-value">${fmt(p.min)} – ${fmt(p.max)}</span>
    </div>`).join('');
}

function initCalc() {
  ['#calc-n40', '#calc-n50', '#calc-days'].forEach((sel) => {
    $(sel).addEventListener('input', renderCalc);
  });

  $$('.preset-row .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const [sales, days] = chip.dataset.preset.split('-').map(Number);
      $('#calc-n40').value = Math.ceil(sales / 2);
      $('#calc-n50').value = Math.floor(sales / 2);
      $('#calc-days').value = days;
      renderCalc();
    });
  });

  renderCalc();
  renderProjections();
}

/* ─────────── Descuentos ─────────── */

function initDiscounts() {
  $('#services-list').innerHTML = SERVICES.map((s) => `<li>${esc(s)}</li>`).join('');
  $('#services-badge').textContent = `${SERVICES.length} servicios`;
  $('#promo-per-service').textContent = fmt(39990 / SERVICES.length);

  const update = () => {
    const normal = Math.max(1, parseInt($('#dc-normal').value, 10) || 1);
    const promo = Math.max(1, parseInt($('#dc-promo').value, 10) || 1);
    const services = Math.max(1, parseInt($('#dc-services').value, 10) || 1);
    const off = Math.max(0, Math.round((1 - promo / normal) * 100));
    const saving = Math.max(0, normal - promo);

    $('#dc-result').innerHTML = `
      <div class="cr-big">-${off}% DCTO</div>
      <div class="cr-sub">
        Ahorro: <strong>${fmt(saving)}</strong> ·
        Por servicio: <strong>${fmt(promo / services)}</strong> ·
        Al día (1 año): <strong>${fmt(promo / 365)}</strong>
      </div>`;
  };

  ['#dc-normal', '#dc-promo', '#dc-services'].forEach((sel) => $(sel).addEventListener('input', update));
  update();
}

/* ─────────── Objeciones: chat automático ─────────── */

let chatStarted = false;

function addMsg(html, who) {
  const box = $('#chat-box');
  const div = document.createElement('div');
  div.className = 'msg ' + (who === 'user' ? 'msg-user' : 'msg-bot');
  div.innerHTML = `
    <div class="msg-avatar">${who === 'user' ? 'TÚ' : 'P'}</div>
    <div class="msg-bubble">${html}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function botReply(input) {
  const box = $('#chat-box');
  const typing = document.createElement('div');
  typing.className = 'msg msg-bot';
  typing.innerHTML = `<div class="msg-avatar">P</div><div class="msg-bubble"><span class="typing"><i></i><i></i><i></i></span></div>`;
  box.appendChild(typing);
  box.scrollTop = box.scrollHeight;

  setTimeout(() => {
    typing.remove();
    const r = matchObjection(input);
    addMsg(
      `<span class="msg-tag">${esc(r.tag)}</span><br/>${esc(r.response)}` +
      (r.tip ? `<span class="msg-tip">💡 ${esc(r.tip)}</span>` : ''),
      'bot'
    );
  }, 650 + Math.random() * 450);
}

function matchObjection(input) {
  const text = normalize(input);

  // Intenciones rápidas
  if (/^(hola|buenas|buenos dias|buenas tardes|hey|alo|wena)\b/.test(text)) {
    return { tag: 'Saludo', response: '¡Hola! 💪 Tírame la objeción tal como te la dijo el cliente y te paso el quiebre exacto con su cierre.', tip: 'Ejemplo: “no tengo plata” o “lo hablo con mi pareja”.' };
  }
  if (/gracias|genial|buenisimo|excelente/.test(text)) {
    return { tag: 'Ánimo', response: '¡A ti! Ahora a la cancha: el cliente no se cierra solo. Recuerda terminar SIEMPRE con “¿crédito o débito?”. 🔥', tip: '' };
  }
  if (/(vendi|cerre la venta|venta cerrada|cayo una|compro)/.test(text)) {
    return { tag: '¡Felicitaciones!', response: '¡VAMOOOS! 🎉 Esa es la actitud. Anótala ahora mismo en la pestaña Ventas para que sume a tu meta y a tu comisión — venta que no se anota, no existe.', tip: 'El mejor momento para vender es justo después de una venta: el siguiente cliente te va a notar la energía.' };
  }

  let best = null, bestScore = 0;
  for (const obj of OBJECTIONS) {
    let score = 0;
    for (const kw of obj.keywords) {
      if (text.includes(normalize(kw))) score += kw.length;
    }
    if (score > bestScore) { bestScore = score; best = obj; }
  }

  if (best && bestScore >= 4) {
    return { tag: best.tag, response: best.response, tip: best.tip };
  }
  return FALLBACK_RESPONSE;
}

function startChat() {
  chatStarted = true;
  const name = state.user ? state.user.name.split(' ')[0] : '';
  addMsg(
    `<span class="msg-tag">Entrenador Pitch</span><br/>` +
    `¡Hola${name ? ' ' + esc(name) : ''}! 👋 Soy tu entrenador de objeciones. Escríbeme lo que te dijo el cliente — por ejemplo <em>“no tengo plata”</em> — y te respondo al tiro con el quiebre exacto y el cierre. También puedes tocar las objeciones rápidas de abajo.`,
    'bot'
  );
}

function initChat() {
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#chat-text');
    const text = input.value.trim();
    if (!text) return;
    addMsg(esc(text), 'user');
    input.value = '';
    botReply(text);
  });

  $$('#chat-chips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      addMsg(esc(chip.textContent), 'user');
      botReply(chip.textContent);
    });
  });

  // Manual de objeciones (acordeón)
  $('#obj-count-badge').textContent = OBJECTIONS.length;
  $('#obj-library').innerHTML = OBJECTIONS.map((o, i) => `
    <div class="acc-item" data-i="${i}">
      <button class="acc-head" type="button">
        <span>${esc(o.title)}</span>
        <svg class="acc-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="acc-body">
        <div class="acc-script">${esc(o.response)}</div>
        <div class="acc-tip"><strong>Técnica:</strong> ${esc(o.tip)}</div>
      </div>
    </div>`).join('');

  initAccordion('#obj-library');
}

function initAccordion(rootSel) {
  $$(rootSel + ' .acc-head').forEach((head) => {
    head.addEventListener('click', () => {
      head.parentElement.classList.toggle('open');
    });
  });
}

/* ─────────── Feedback ─────────── */

let journalType = 'aprendizaje';

function initFeedback() {
  // Mandamientos
  $('#tips-badge').textContent = TIPS.length;
  $('#tips-list').innerHTML = TIPS.map((t) => `
    <div class="acc-item">
      <button class="acc-head" type="button">
        <span>${esc(t.title)}</span>
        <svg class="acc-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="acc-body">${esc(t.body)}</div>
    </div>`).join('');
  initAccordion('#tips-list');

  // Selector tipo
  $$('#journal-type .seg').forEach((seg) => {
    seg.addEventListener('click', () => {
      $$('#journal-type .seg').forEach((s) => s.classList.remove('active'));
      seg.classList.add('active');
      journalType = seg.dataset.type;
      $('#journal-reason-field').style.display = journalType === 'perdida' ? '' : 'none';
      if (journalType === 'perdida') {
        const prompt = LOST_REASONS_PROMPTS[Math.floor(Math.random() * LOST_REASONS_PROMPTS.length)];
        $('#journal-text').placeholder = prompt + ' Escribe qué pasó y qué harás distinto…';
      } else {
        $('#journal-text').placeholder = 'Ej: Hoy descubrí que validar la objeción antes de rebatir me abre la puerta al cierre.';
      }
    });
  });

  $('#journal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#journal-text').value.trim();
    if (!text) return;
    state.journal.unshift({
      id: uid(),
      ts: new Date().toISOString(),
      type: journalType,
      reason: journalType === 'perdida' ? $('#journal-reason').value : '',
      text
    });
    saveState();
    $('#journal-text').value = '';
    renderJournal();
    toast(journalType === 'perdida'
      ? 'Anotado. Estúdialo y sigue con la misma actitud 💪'
      : 'Aprendizaje guardado. Lo que se escribe, se corrige ✍️');
  });

  renderJournal();
}

function renderJournal() {
  if (!state.journal.length) {
    $('#journal-list').innerHTML = `<li class="empty-state">Tu diario está vacío. Después de cada conversación —buena o mala— anota una línea. En un mes tendrás tu propio manual de ventas. 📓</li>`;
    return;
  }
  $('#journal-list').innerHTML = state.journal.map((j) => {
    const d = new Date(j.ts);
    return `
      <li class="journal-item ${j.type === 'perdida' ? 'perdida' : ''}">
        <div class="journal-top">
          <span class="journal-kind">${j.type === 'perdida' ? '📉 Venta perdida' : '💡 Aprendizaje'}</span>
          <span>
            <span class="journal-date">${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ${pad(d.getHours())}:${pad(d.getMinutes())}</span>
            <button class="journal-del" data-id="${j.id}" title="Eliminar">✕</button>
          </span>
        </div>
        ${j.reason ? `<div class="journal-reason">Qué faltó: ${esc(j.reason)}</div>` : ''}
        <div class="journal-text">${esc(j.text)}</div>
      </li>`;
  }).join('');

  $$('#journal-list .journal-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.journal = state.journal.filter((j) => j.id !== btn.dataset.id);
      saveState();
      renderJournal();
    });
  });
}

/* ─────────── Toast y confetti ─────────── */

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function confetti() {
  const layer = $('#confetti');
  const colors = ['#a855f7', '#7c3aed', '#22c55e', '#f59e0b', '#ffffff', '#d8b4fe'];
  for (let i = 0; i < 42; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDuration = 1.4 + Math.random() * 1.4 + 's';
    p.style.animationDelay = Math.random() * 0.3 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(p);
    setTimeout(() => p.remove(), 3200);
  }
}

/* ─────────── Render maestro e init ─────────── */

function renderAll() {
  tickGreeting();
  renderStats();
  renderWeekChart();
  renderQuote();
  renderSales();
  renderComunas();
  renderGoals();
  tickClock();
}

function init() {
  initLogin();
  initNav();
  initSales();
  initGoalsConfig();
  initCalc();
  initDiscounts();
  initChat();
  initFeedback();

  setInterval(() => { tickClock(); tickGreeting(); }, 30 * 1000);
  setInterval(renderAll, 5 * 60 * 1000); // refresco por cambio de día/semana

  if (state.user) {
    showApp();
  } else {
    tickClock();
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin soporte u origen no seguro */ });
  }
}

document.addEventListener('DOMContentLoaded', init);
