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
    if (!h) { box.hidden = true; state.lastStatus = null; return; }
    const my = ++statusReq;
    box.hidden = false; box.className = 'status c-status';
    box.innerHTML = '<div class="skel w60"></div><div class="skel w80"></div><div class="skel w40"></div>';
    let s;
    try { s = await getJSON({ action: 'status', host: h, tanggal: $('tanggal').value || isoToday() }); }
    catch (e) { if (my === statusReq) box.hidden = true; return; }
    if (my !== statusReq || !s.ok) return;
    state.statistik = s.statistik || {};
    state.lastStatus = s;
    renderStatus();
  }
  const diHP = () => window.matchMedia('(max-width:959px)').matches;
  function renderStatus() {
    const s = state.lastStatus, h = $('host').value, box = $('status');
    if (!s) return;
    const tgl = $('tanggal').value;
    const hariIni = s.reports.filter(r => r.tanggal === tgl);
    let html = '';
    const rentang = s.dari && s.sampai && s.sampai >= s.dari ? `${fmtTgl(s.dari)} – ${fmtTgl(s.sampai)}` : 'bulan ini';
    if (s.belum.length) {
      box.className = 'status c-status warn';
      const terbuka = !diHP() || box.dataset.buka === h;
      if (!terbuka) {
        html += `<button type="button" class="lipat" id="bukaTutup"><span>⚠ ${s.belum.length} tanggal belum lengkap</span><span>Lihat</span></button>`;
      } else {
        const MAKS = 5, semua = s.belum.length > MAKS && box.dataset.semua === h;
        const tampil = semua ? s.belum : s.belum.slice(0, MAKS);
        html += (diHP() ? `<button type="button" class="lipat" id="bukaTutup" style="margin-bottom:10px"><span>⚠ Laporan yang belum lengkap</span><span>Tutup</span></button>` : `<div class="judul">⚠ Laporan yang belum lengkap (${rentang})</div>`) +
          `<div class="legend"><span><i class="ic ya">✓</i> masuk</span><span><i class="ic tidak">✗</i> belum</span><span><i class="ic bebas">bebas</i> dibebaskan admin</span><span><i class="ic na">–</i> tidak wajib</span></div>` +
          tampil.map(kartuHari).join('') +
          (s.belum.length > MAKS ? `<button type="button" class="link" id="lihatSemua">${semua ? 'Tampilkan lebih sedikit' : `Lihat semua (${s.belum.length})`}</button><br>` : '') +
          '<small>Kalau memang tidak live di sesi itu (full konten, izin, dll.), hubungi admin.</small>';
      }
    } else { box.className = 'status c-status ok'; html += `<div class="judul" style="margin:0">✓ Semua laporan ${rentang} sudah lengkap</div>`; }
    if (hariIni.length) html += `<div style="margin-top:8px">Sudah terkirim untuk ${fmtTgl(tgl)}:<ul>` +
      hariIni.map(r => `<li>${r.mulai}–${r.selesai} · ${r.platform}</li>`).join('') + '</ul></div>';
    box.innerHTML = html;
    const t = document.getElementById('lihatSemua');
    if (t) t.addEventListener('click', () => { box.dataset.semua = box.dataset.semua === h ? '' : h; renderStatus(); });
    const bt = document.getElementById('bukaTutup');
    if (bt) bt.addEventListener('click', () => { box.dataset.buka = box.dataset.buka === h ? '' : h; renderStatus(); });
  }
  window.matchMedia('(max-width:959px)').addEventListener('change', () => renderStatus());

  /* ---------- jam 24 jam: pilih dari daftar ---------- */
  const dua = (n) => String(n).padStart(2, '0');
  ['mulai', 'selesai'].forEach(id => {
    $(id + 'J').innerHTML = '<option value="">Jam</option>' + Array.from({ length: 24 }, (_, i) => `<option>${dua(i)}</option>`).join('');
    $(id + 'M').innerHTML = '<option value="">Menit</option>' + Array.from({ length: 60 }, (_, i) => `<option>${dua(i)}</option>`).join('');
    const sync = (ev) => {
      if (ev && ev.target === $(id + 'J') && $(id + 'J').value && !$(id + 'M').value) $(id + 'M').value = '00';
      const j = $(id + 'J').value, m = $(id + 'M').value;
      $(id).value = j && m ? j + ':' + m : '';
      cekJam(); durasi(); ringkas();
    };
    $(id + 'J').addEventListener('change', sync); $(id + 'M').addEventListener('change', sync);
  });
  function setJam(id, v) {
    const [j, m] = (v || '').split(':');
    $(id + 'J').value = j || ''; $(id + 'M').value = m || ''; $(id).value = v || '';
  }

  /* ---------- error per kolom ---------- */
  function wadah(id) { const el = $(id); return el.type === 'hidden' ? document.querySelector(`.jam[data-for=${id}]`) : el; }
  function fieldErr(id, msg) {
    const w = wadah(id), f = w.closest('.field');
    let fe = f.querySelector('.fe');
    if (msg) {
      w.classList.add('bad');
      if (!fe) { fe = document.createElement('small'); fe.className = 'fe'; f.appendChild(fe); }
      fe.textContent = msg;
    } else { w.classList.remove('bad'); if (fe) fe.remove(); }
  }
  function cekJam() {
    const a = $('mulai').value, b = $('selesai').value;
    fieldErr('selesai', a && b && a === b ? 'Jam selesai sama dengan jam mulai.' : '');
    if (a) fieldErr('mulai', '');
  }
  function cekAngka(k) {
    const v = $(k).value.trim();
    if (!v) return fieldErr(k, '');
    const n = num(v, DESIMAL().includes(k));
    fieldErr(k, isNaN(n) || n < 0 ? (DESIMAL().includes(k) ? 'Isi angka, boleh desimal (mis. 13,2).' : 'Isi angka bulat (mis. 12500 atau 12.500).') : '');
  }

  /* ---------- tanggal tertulis & ringkasan ---------- */
  function tulisTgl() {
    const t = $('tanggal').value;
    $('tglTeks').textContent = t ? new Date(t + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
    fieldErr('tanggal', t && t > isoToday() ? 'Tanggal live tidak boleh di masa depan.' : '');
  }
  function ringkas() {
    const p = [];
    if ($('host').value) p.push(`<b>${$('host').value}</b>`);
    if (state.platform) p.push(state.platform);
    if ($('tanggal').value) p.push(fmtTgl($('tanggal').value));
    if ($('mulai').value && $('selesai').value) p.push(`${$('mulai').value}–${$('selesai').value}`);
    $('ringkas').innerHTML = p.join(' · ');
  }

  /* ---------- tombol Hari ini / Kemarin ---------- */
  const geserHari = (n) => { const d = new Date(isoToday() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  function tandaiChip() {
    const t = $('tanggal').value;
    document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', geserHari(+b.dataset.hari) === t));
  }
  document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
    $('tanggal').value = geserHari(+b.dataset.hari);
    $('tanggal').dispatchEvent(new Event('change'));
  }));

  /* ---------- cek angka / jam yang janggal (peringatan, bukan penolakan) ---------- */
  function janggal(body) {
    const w = [], f = (n) => n.toLocaleString('id-ID');
    const m = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
    let dur = m(body.selesai) - m(body.mulai); const lewat = dur <= 0; if (lewat) dur += 1440;
    const jj = `${Math.floor(dur / 60)} jam ${dur % 60} menit`;
    if (dur > 6 * 60) w.push(`Durasi live <b>${jj}</b> (${body.mulai}–${body.selesai}). Biasanya satu sesi ≤ 4 jam — cek lagi jam mulai/selesai.`);
    else if (lewat && m(body.selesai) > 6 * 60) w.push(`Jam selesai (${body.selesai}) lebih awal dari jam mulai (${body.mulai}). Apakah live memang melewati tengah malam?`);
    if (dur < 15) w.push(`Durasi live hanya <b>${jj}</b>.`);
    if (body.impressions > 0 && body.views > body.impressions) w.push(`Jumlah Penonton/Views (${f(body.views)}) lebih besar dari Dilihat/Impressions (${f(body.impressions)}). Mungkin tertukar?`);
    if (body.viewers > body.views && body.views > 0) w.push(`Penonton Aktif (${f(body.viewers)}) lebih besar dari Jumlah Penonton (${f(body.views)}). Mungkin tertukar?`);
    if (body.platform === 'TikTok' && body.views > 0 && body.klik > body.views * 3) w.push(`Klik Produk TikTok (${f(body.klik)}) jauh di atas Jumlah Penonton (${f(body.views)}).`);
    if (['impressions', 'views', 'viewers', 'klik', 'terjual'].every(k => !body[k])) w.push('Semua angka performa bernilai 0.');
    const st = (state.statistik || {})[body.platform];
    if (st) {
      if (body.terjual > Math.max(st.terjual * 3, st.terjual + 10)) w.push(`Produk Terjual <b>${f(body.terjual)}</b> jauh di atas rata-ratamu di ${body.platform} (±${f(st.terjual)} per sesi).`);
      if (st.views > 0 && body.views > Math.max(st.views * 5, st.views + 2000)) w.push(`Jumlah Penonton <b>${f(body.views)}</b> jauh di atas rata-ratamu di ${body.platform} (±${f(st.views)} per sesi).`);
    }
    return w;
  }
  function tampilWarn(list, lanjut) {
    const b = $('formWarn');
    if (!list.length) { b.hidden = true; b.innerHTML = ''; return; }
    b.innerHTML = '<b>Cek lagi sebelum kirim:</b><ul>' + list.map(x => `<li>${x}</li>`).join('') + '</ul>' +
      '<div class="aksi"><button type="button" class="lanjut" id="tetapKirim">Data sudah benar, kirim</button><button type="button" id="periksa">Periksa lagi</button></div>';
    b.hidden = false; b.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('tetapKirim').addEventListener('click', lanjut);
    $('periksa').addEventListener('click', () => { tampilWarn([]); $('mulaiJ').focus(); });
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
    setTimeout(ringkas);
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
    document.querySelectorAll('.fe').forEach(x => x.remove());
    const bad = (id, msg) => { fieldErr(id, msg); e.push(msg); };
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
    const err = validasi(); if (err.length) { tampilWarn([]); return tampilErr(err); }
    tampilErr([]);
    const body = {
      tanggal: $('tanggal').value, host: $('host').value, mulai: $('mulai').value, selesai: $('selesai').value,
      platform: state.platform, brand: $('bantu').checked ? $('brand').value : '',
    };
    ANGKA.forEach(k => body[k] = num($(k).value, DESIMAL().includes(k)));
    if (!ev.sudahCek) {
      const w = janggal(body);
      if (w.length) return tampilWarn(w, () => { tampilWarn([]); kirim({ preventDefault() {}, sudahCek: true }); });
    }
    tampilWarn([]);
    const btn = $('kirim'); btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      const res = await postJSON(body);
      if (!res.ok) return tampilErr(res.errors || ['Gagal mengirim.']);
      terakhir = body;
      $('doneTxt').innerHTML = `${body.host} · ${fmtTgl(body.tanggal)} · ${body.mulai}–${body.selesai} · <b>${body.platform}</b>` +
        (res.telat ? '<br><span style="color:var(--err)">Tercatat terlambat (lewat H+1 17:00).</span>' : '') +
        '';
      const label = { impressions: 'Impressions', views: 'Views', viewers: 'Viewers', share: 'Share', klik: 'Klik Produk', terjual: 'Terjual' };
      $('doneAngka').innerHTML = ANGKA.map(k => `<div><small>${label[k]}</small><b>${DESIMAL().includes(k) ? String(body[k]).replace('.', ',') : fmtRibu(body[k])}</b></div>`).join('');
      $('doneHari').innerHTML = '<div class="skel w80"></div><div class="skel w60"></div>';
      $('form').hidden = true; $('done').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' });
      tampilHariIni(body);
    } catch (e) {
      tampilErr(['Koneksi gagal. Cek internet lalu coba kirim lagi — isianmu tidak hilang.']);
    } finally { btn.disabled = false; btn.textContent = 'Kirim Laporan'; }
  }
  async function tampilHariIni(body) {
    let s; try { s = await getJSON({ action: 'status', host: body.host, tanggal: body.tanggal }); } catch (e) { $('doneHari').innerHTML = ''; return; }
    if (!s || !s.ok) { $('doneHari').innerHTML = ''; return; }
    state.lastStatus = s; state.statistik = s.statistik || {};
    const rep = s.reports.filter(r => r.tanggal === body.tanggal).sort((x, y) => x.mulai.localeCompare(y.mulai));
    const kurang = s.belum.find(b => b.tanggal === body.tanggal);
    $('doneHari').innerHTML = (rep.length ? `<div class="hari"><div class="hari-top"><b>Laporanmu untuk ${fmtTgl(body.tanggal)}</b></div><table class="cek">` +
      rep.map(r => `<tr><td class="jam">${r.mulai}–${r.selesai}</td><td style="text-align:left">${r.platform}</td><td><i class="ic ya">✓</i></td></tr>`).join('') + '</table></div>' : '') +
      (kurang ? `<div style="margin-top:8px"><div class="hint" style="margin-bottom:6px">Yang masih kurang di tanggal ini:</div>${kartuHari(kurang)}</div>` : '');
  }
  function ulang(samaSesi) {
    ANGKA.forEach(k => $(k).value = '');
    if (samaSesi && terakhir) setPlatform(terakhir.platform === 'TikTok' ? 'Shopee' : 'TikTok');
    else { setJam('mulai', ''); setJam('selesai', ''); $('host').value = ''; isiBrand(); setPlatform(''); durasi(); }
    document.querySelectorAll('.fe').forEach(x => x.remove()); document.querySelectorAll('.bad').forEach(x => x.classList.remove('bad'));
    tampilWarn([]); $('done').hidden = true; $('form').hidden = false; ringkas(); cekStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- mulai ---------- */
  async function init() {
    try {
      $('host').classList.add('loading');
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
    $('host').classList.remove('loading');
    $('tanggal').max = isoToday();
    tandaiChip(); tulisTgl(); ringkas();
    isiHost();
    cekStatus();
  }

  $('tanggal').addEventListener('change', () => { tandaiChip(); tulisTgl(); ringkas(); tampilWarn([]); isiHost(); cekStatus(); });
  $('host').addEventListener('change', () => { fieldErr('host', ''); isiBrand(); ringkas(); cekStatus(); });
  $('bantu').addEventListener('change', isiBrand);
  document.querySelectorAll('#platform button').forEach(b => b.addEventListener('click', () => setPlatform(b.dataset.v)));
  $('form').addEventListener('submit', kirim);
  $('lagiPlatform').addEventListener('click', () => ulang(true));
  $('lagiBaru').addEventListener('click', () => ulang(false));
  // format angka saat keluar dari kotak
  ANGKA.forEach(k => $(k).addEventListener('input', () => { if ($(k).classList.contains('bad')) fieldErr(k, ''); }));
  ANGKA.forEach(k => $(k).addEventListener('blur', () => {
    cekAngka(k);
    const d = DESIMAL().includes(k), n = num($(k).value, d);
    if (!isNaN(n)) $(k).value = d ? String(n).replace('.', ',') : fmtRibu(n);
  }));
  // Enter = pindah ke kotak berikutnya, Ctrl/⌘+Enter = kirim
  const urutan = () => ['tanggal', 'host', 'mulaiJ', 'mulaiM', 'selesaiJ', 'selesaiM'].map($)
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
