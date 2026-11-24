(function () {
  const API = (window.API_URL || '').trim();
  const TERSAMBUNG = /^https:\/\/script\.google\.com\/.+\/exec$/.test(API);
  const $ = (id) => document.getElementById(id);
  const state = { roster: [], brands: [], platform: '', today: '' };

  /* ---------- util ---------- */
  const isoToday = () => { const d = new Date(Date.now() + 7 * 3600e3); return d.toISOString().slice(0, 10); }; // WIB
  const fmtTgl = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const DESIMAL = () => ['share'].concat(state.platform === 'Shopee' ? ['klik'] : []);
  // angka bulat: titik/koma/spasi = pemisah ribuan (12.500 → 12500)
  // angka desimal (Share, Klik Produk Shopee): koma atau titik = desimal (13,2 → 13.2)
  const num = (v, desimal) => {
    let s = String(v).trim().replace(/\s/g, '');
    if (s === '') return NaN;
    if (desimal) { s = s.replace(',', '.'); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; }
    if (/^\d+$/.test(s)) return Number(s);
    return /^\d{1,3}([.,]\d{3})+$/.test(s) ? Number(s.replace(/[.,]/g, '')) : NaN; // hanya pemisah ribuan yang sah
  };
  const fmtRibu = (n) => n.toLocaleString('id-ID');
  async function getJSON(params) {
    const r = await fetch(API + '?' + new URLSearchParams(params));
    return r.json();
  }
  async function postJSON(body) {
    // text/plain → tanpa preflight CORS, aman untuk Apps Script
    const r = await fetch(API, { method: 'POST', body: JSON.stringify(body) });
    return r.json();
  }


  /* ---------- roster ---------- */
  function aktifPada(iso) {
    const map = new Map();
    state.roster.forEach(r => { if (r.from <= iso && r.until >= iso) map.set(r.host, r); });
    return [...map.values()].filter(r => r.status === 'Aktif').sort((a, b) => a.host.localeCompare(b.host));
  }
  function isiHost() {
    const iso = $('tanggal').value || state.today;
    const keep = $('host').value;
    const list = aktifPada(iso);
    $('host').innerHTML = '<option value="">Pilih nama…</option>' + list.map(r => `<option>${r.host}</option>`).join('');
    if (list.some(r => r.host === keep)) $('host').value = keep;
    isiBrand();
  }
  function brandRoster() {
    const iso = $('tanggal').value || state.today, h = $('host').value;
    const r = state.roster.find(x => x.host === h && x.from <= iso && x.until >= iso);
    return r ? r.brand : '';
  }
  function isiBrand() {
    const br = brandRoster();
    const sel = $('brand');
    if (!$('bantu').checked) {
      sel.innerHTML = `<option>${br || '—'}</option>`; sel.disabled = true;
    } else {
      sel.innerHTML = state.brands.map(b => `<option${b === br ? ' selected' : ''}>${b}</option>`).join(''); sel.disabled = false;
    }
  }

  /* ---------- status host: laporan yang belum masuk ---------- */
  let statusReq = 0;
  async function cekStatus() {
    const h = $('host').value, box = $('status');
    if (!h) { box.hidden = true; return; }
    const my = ++statusReq;
    box.hidden = false; box.className = 'status c-status'; box.textContent = 'Mengecek laporanmu…';
    let s;
    try { s = await getJSON({ action: 'status', host: h, tanggal: $('tanggal').value || isoToday() }); }
    catch (e) { if (my === statusReq) box.hidden = true; return; }
    if (my !== statusReq || !s.ok) return;
    const tgl = $('tanggal').value;
    const hariIni = s.reports.filter(r => r.tanggal === tgl);
    let html = '';
    const rentang = s.dari && s.sampai && s.sampai >= s.dari ? `${fmtTgl(s.dari)} – ${fmtTgl(s.sampai)}` : 'bulan ini';
    if (s.belum.length) {
      box.className = 'status c-status warn';
      const MAKS = 5, semua = s.belum.length > MAKS && box.dataset.semua === h;
      const tampil = semua ? s.belum : s.belum.slice(0, MAKS);
      html += `<div class="judul">⚠ Laporan yang belum lengkap (${rentang})</div>` +
        `<div class="legend"><span><i class="ic ya">✓</i> masuk</span><span><i class="ic tidak">✗</i> belum</span><span><i class="ic bebas">bebas</i> dibebaskan admin</span><span><i class="ic na">–</i> tidak wajib</span></div>` +
        tampil.map(kartuHari).join('') +
        (s.belum.length > MAKS ? `<button type="button" class="link" id="lihatSemua">${semua ? 'Tampilkan lebih sedikit' : `Lihat semua (${s.belum.length})`}</button><br>` : '') +
        '<small>Kalau memang tidak live di sesi itu (full konten, izin, dll.), hubungi admin.</small>';
    } else { box.className = 'status c-status ok'; html += `<div class="judul" style="margin:0">✓ Semua laporan ${rentang} sudah lengkap</div>`; }
    if (hariIni.length) html += `<div style="margin-top:8px">Sudah terkirim untuk ${fmtTgl(tgl)}:<ul>` +
      hariIni.map(r => `<li>${r.mulai}–${r.selesai} · ${r.platform}</li>`).join('') + '</ul></div>';
    box.innerHTML = html;
    const t = document.getElementById('lihatSemua');
    if (t) t.addEventListener('click', () => { box.dataset.semua = box.dataset.semua === h ? '' : h; cekStatus(); });
  }

  /* ---------- checklist per tanggal ---------- */
  const IK = { '1': '<i class="ic ya" title="sudah masuk">✓</i>', '0': '<i class="ic tidak" title="belum masuk">✗</i>', 'x': '<i class="ic bebas" title="dibebaskan admin">bebas</i>', '-': '<i class="ic na" title="tidak wajib">–</i>' };
  function kartuHari(b) {
    const cek = b.cek || [];
    const plat = ['TikTok', 'Shopee'].filter(p => cek.some(r => r[p] && r[p] !== '-'));
    const tabel = cek.length && plat.length ? `<table class="cek"><tr><th>Sesi</th><th></th>${plat.map(p => `<th>${p}</th>`).join('')}</tr>` +
      cek.map(r => `<tr><td><b>${r.sesi}</b></td><td class="jam">${r.jam && r.jam !== '–' ? r.jam : (r.sesi === 'Sesi lain' ? 'belum masuk' : '')}</td>${plat.map(p => `<td>${IK[r[p]] || IK['-']}</td>`).join('')}</tr>`).join('') + '</table>'
      : `<div>${b.detail || 'Belum ada laporan'}</div>`;
    const ket = cek.some(r => r.sesi === 'Sesi masuk') ? `<div class="hint">${b.detail}</div>` : '';
    return `<div class="hari"><div class="hari-top"><b>${fmtTgl(b.tanggal)}</b>${b.terlambat ? '<span class="lewat">lewat batas</span>' : ''}</div>${tabel}${ket}</div>`;
  }

  /* ---------- tampilan ---------- */
  function setPlatform(v) {
    const lama = state.platform === 'Shopee';
    const k0 = $('klik').value, n0 = k0 ? num(k0, lama) : NaN;
    state.platform = v;
    document.querySelectorAll('#platform button').forEach(b => b.setAttribute('aria-checked', b.dataset.v === v));
    $('klikLbl').textContent = v ? `Klik Produk ${v}` : 'Klik Produk';
    $('klikHint').textContent = v === 'Shopee' ? 'Boleh desimal, mis. 13,2' : '';
    const k = $('klik'); k.inputMode = v === 'Shopee' ? 'decimal' : 'numeric';
    if (!isNaN(n0)) k.value = v === 'Shopee' ? String(n0).replace('.', ',') : (Number.isInteger(n0) ? fmtRibu(n0) : String(n0).replace('.', ','));
  }
  function durasi() {
    const a = $('mulai').value, b = $('selesai').value, el = $('durasi');
    if (!a || !b) { el.textContent = ''; return; }
    let m = (+b.slice(0, 2) * 60 + +b.slice(3)) - (+a.slice(0, 2) * 60 + +a.slice(3));
    const lewat = m <= 0; if (lewat) m += 1440;
    el.textContent = `Durasi ${Math.floor(m / 60)} jam ${m % 60} menit` + (lewat ? ' · melewati tengah malam' : '');
    el.style.color = (m > 12 * 60) ? 'var(--err)' : '';
  }
  function batasInfo(iso) {
    const batas = new Date(iso + 'T17:00:00+07:00'); batas.setUTCDate(batas.getUTCDate() + 1);
    return Date.now() > batas.getTime();
  }

  /* ---------- kirim ---------- */
  const ANGKA = ['impressions', 'views', 'viewers', 'share', 'klik', 'terjual'];
  function validasi() {
    const e = [];
    document.querySelectorAll('.bad').forEach(x => x.classList.remove('bad'));
    const bad = (id, msg) => { $(id).classList.add('bad'); e.push(msg); };
    const t = $('tanggal').value;
    if (!t) bad('tanggal', 'Tanggal live belum diisi.');
    else if (t > isoToday()) bad('tanggal', 'Tanggal live tidak boleh di masa depan.');
    if (!$('host').value) bad('host', 'Pilih nama host.');
    if (!$('mulai').value) bad('mulai', 'Jam mulai belum diisi.');
    if (!$('selesai').value) bad('selesai', 'Jam selesai belum diisi.');
    if ($('mulai').value && $('mulai').value === $('selesai').value) bad('selesai', 'Jam mulai dan selesai sama.');
    if (!state.platform) e.push('Pilih platform (TikTok / Shopee).');
    if (!$('brand').value || $('brand').value === '—') e.push('Brand tidak ditemukan di ROSTER untuk tanggal ini. Hubungi admin.');
    ANGKA.forEach(k => { const v = num($(k).value, DESIMAL().includes(k)); if (isNaN(v) || v < 0) bad(k, `Isian "${$(k).closest('.field').querySelector('span').textContent}" harus angka.`); });
    return e;
  }
  function tampilErr(list) {
    const b = $('formErr');
    if (!list.length) { b.hidden = true; return; }
    b.innerHTML = list.length === 1 ? list[0] : '<b>Periksa lagi:</b><ul>' + list.map(x => `<li>${x}</li>`).join('') + '</ul>';
    b.hidden = false; b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  let terakhir = null;
  async function kirim(ev) {
    ev.preventDefault();
    const err = validasi(); if (err.length) return tampilErr(err);
    tampilErr([]);
    const body = {
      tanggal: $('tanggal').value, host: $('host').value, mulai: $('mulai').value, selesai: $('selesai').value,
      platform: state.platform, brand: $('bantu').checked ? $('brand').value : '',
    };
    ANGKA.forEach(k => body[k] = num($(k).value, DESIMAL().includes(k)));
    const btn = $('kirim'); btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      const res = await postJSON(body);
      if (!res.ok) return tampilErr(res.errors || ['Gagal mengirim.']);
      terakhir = body;
      $('doneTxt').innerHTML = `${body.host} · ${fmtTgl(body.tanggal)} · ${body.mulai}–${body.selesai} · <b>${body.platform}</b>` +
        (res.telat ? '<br><span style="color:var(--err)">Tercatat terlambat (lewat H+1 17:00).</span>' : '') +
        '';
      $('form').hidden = true; $('done').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      tampilErr(['Koneksi gagal. Cek internet lalu coba kirim lagi — isianmu tidak hilang.']);
    } finally { btn.disabled = false; btn.textContent = 'Kirim Laporan'; }
  }
  function ulang(samaSesi) {
    ANGKA.forEach(k => $(k).value = '');
    if (samaSesi && terakhir) setPlatform(terakhir.platform === 'TikTok' ? 'Shopee' : 'TikTok');
    else { $('mulai').value = ''; $('selesai').value = ''; $('host').value = ''; isiBrand(); setPlatform(''); durasi(); }
    $('done').hidden = true; $('form').hidden = false; cekStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- mulai ---------- */
  async function init() {
    try {
      if (!TERSAMBUNG) throw new Error('URL /exec di config.js belum diisi atau salah');
      const m = await getJSON({ action: 'meta' });
      if (!m.ok) throw new Error(m.error);
      state.roster = m.roster; state.brands = m.brands; state.today = m.today || isoToday();
    } catch (e) {
      $('loadErr').innerHTML = '<b>Website belum tersambung ke Google Sheet.</b> Laporan tidak bisa dikirim — hubungi admin.<br><small>(' + e.message + ')</small>';
      $('loadErr').hidden = false;
      $('kirim').disabled = true; $('kirim').textContent = 'Belum tersambung';
      $('host').innerHTML = '<option value="">—</option>';
    }
    $('tanggal').value = state.today || isoToday();
    $('tanggal').max = isoToday();
    isiHost();
    cekStatus();
  }

  $('tanggal').addEventListener('change', () => { isiHost(); cekStatus(); });
  $('host').addEventListener('change', () => { isiBrand(); cekStatus(); });
  $('bantu').addEventListener('change', isiBrand);
  $('mulai').addEventListener('change', durasi); $('selesai').addEventListener('change', durasi);
  document.querySelectorAll('#platform button').forEach(b => b.addEventListener('click', () => setPlatform(b.dataset.v)));
  $('form').addEventListener('submit', kirim);
  $('lagiPlatform').addEventListener('click', () => ulang(true));
  $('lagiBaru').addEventListener('click', () => ulang(false));
  // format angka saat keluar dari kotak
  ANGKA.forEach(k => $(k).addEventListener('blur', () => {
    const d = DESIMAL().includes(k), n = num($(k).value, d);
    if (!isNaN(n)) $(k).value = d ? String(n).replace('.', ',') : fmtRibu(n);
  }));
  // Enter = pindah ke kotak berikutnya, Ctrl/⌘+Enter = kirim
  const urutan = () => ['tanggal', 'host', 'mulai', 'selesai'].map($)
    .concat([...document.querySelectorAll('#platform button')])
    .concat($('bantu').checked ? [$('brand')] : [])
    .concat(ANGKA.map($)).concat([$('kirim')]);
  $('form').addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    if (ev.ctrlKey || ev.metaKey) { ev.preventDefault(); $('form').requestSubmit(); return; }
    const t = ev.target;
    if (t.id === 'kirim') return;
    if (t.closest('#platform')) { ev.preventDefault(); t.click(); }
    else if (t.tagName === 'BUTTON') return;
    else ev.preventDefault();
    let list = urutan(), i = list.indexOf(t);
    if (t.closest('#platform')) i = list.indexOf(document.querySelectorAll('#platform button')[1]);
    const next = list[i + 1]; if (next) next.focus();
  });
  // tema tampilan: Otomatis (ikut HP/komputer) → Terang → Gelap
  const IKON = {
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
  };
  const NAMA = { auto: 'Otomatis', light: 'Terang', dark: 'Gelap' };
  function setTema(t) {
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { localStorage.setItem('tema', t); } catch (e) {}
    $('tema').innerHTML = IKON[t] + NAMA[t];
    $('tema').title = 'Tema: ' + NAMA[t] + ' (klik untuk ganti)';
  }
  let tema = 'auto'; try { tema = localStorage.getItem('tema') || 'auto'; } catch (e) {}
  setTema(tema);
  $('tema').addEventListener('click', () => { tema = { auto: 'light', light: 'dark', dark: 'auto' }[tema] || 'auto'; setTema(tema); });
  try { if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3) document.documentElement.classList.add('lite'); } catch (e) {}
  init();
})();
