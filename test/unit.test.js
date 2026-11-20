import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { html, raw } from '../src/lib/html.js';
import { hashPassword, verifyPassword, publicId } from '../src/lib/security.js';
import { classify, normalize, tokens } from '../src/lib/matcher.js';
import { respond } from '../src/lib/responder.js';
import { SECTORS, defaultSettings } from '../src/templates.js';
import { createZip } from '../src/wordpress.js';
import { hostAllowed } from '../src/routes/api.js';
import { parseDomains, leadsCsv } from '../src/routes/app.js';

const hotel = SECTORS.hotel.faq.map(([question, answer, keywords], i) => ({ id: i + 1, question, answer, keywords, hits: 0 }));
const settings = defaultSettings({ name: 'Hotel Test', sector: 'hotel' });
const ask = (message, knowledge = hotel) => respond({ settings, knowledge, message });

test('html escapa tutti i valori interpolati', async () => {
  const evil = '<img src=x onerror="alert(1)">';
  assert.equal(String(html`<p title="${evil}">${evil}</p>`), '<p title="&lt;img src=x onerror=&quot;alert(1)&quot;&gt;">&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
  assert.equal(String(html`<b>${raw('<i>ok</i>')}</b>`), '<b><i>ok</i></b>');
  assert.equal(String(html`${['<a>', html`<b>x</b>`]}`), '&lt;a&gt;<b>x</b>');
});

test('password: hash verificabile e non reversibile', async () => {
  const h = hashPassword('una-password-lunga');
  assert.ok(h.startsWith('scrypt$'));
  assert.ok(verifyPassword('una-password-lunga', h));
  assert.ok(!verifyPassword('una-password-lungA', h));
  assert.ok(!verifyPassword('x', null));
  assert.match(publicId('wdg'), /^wdg_[2-9a-z]{12}$/);
});

test('normalizzazione italiana', async () => {
  assert.equal(normalize("Qual è l'orario?"), 'qual e l orario');
  assert.deepEqual(tokens('Quanto costa la spedizione?'), ['prezz', 'sped']);
});

test('riconosce saluti, ringraziamenti e richiesta di una persona', async () => {
  assert.equal(classify('Buongiorno!'), 'greeting');
  assert.equal(classify('grazie mille'), 'thanks');
  assert.equal(classify('Posso parlare con un operatore?'), 'human');
  assert.equal(classify('Avete il parcheggio?'), 'question');
});

test('trova la risposta giusta anche con parole diverse', async () => {
  const cases = [
    ['A che ora è il check-in?', 'check-in'],
    ['a che ora devo lasciare la camera? check out', 'check-out'],
    ['c’è un posto per la macchina? parcheggio', 'posti auto'],
    ['posso portare il mio cane?', 'animali'],
    ['la colazione è compresa nel prezzo?', 'colazione'],
    ['Come faccio a prenotare una camera?', 'prenotare'],
    ['Se disdico mi rimborsate?', 'cancellazione'],
  ];
  for (const [q, expected] of cases) {
    const r = await ask(q);
    assert.equal(r.outcome, 'answered', `"${q}" doveva trovare una risposta`);
    assert.ok(r.text.toLowerCase().includes(expected.toLowerCase()), `"${q}" → "${r.text}"`);
  }
});

test('non inventa: domande fuori tema portano alla raccolta contatti', async () => {
  for (const q of ['Avete una piscina riscaldata?', 'Organizzate matrimoni?', 'Qual è la password del wifi?']) {
    const r = await ask(q);
    assert.equal(r.outcome, 'fallback', `"${q}" non doveva avere risposta, invece: ${r.text}`);
    assert.equal(r.action, 'lead_form');
    assert.ok(r.suggestions.length > 0);
  }
});

test('senza raccolta contatti il fallback non mostra il modulo', async () => {
  const r = await respond({ settings: { ...settings, leadCapture: false }, knowledge: hotel, message: 'Avete la spa?' });
  assert.equal(r.action, null);
});

test('richiesta di una persona → modulo contatti', async () => {
  const r = await ask('vorrei essere richiamato da qualcuno');
  assert.equal(r.outcome, 'handoff');
  assert.equal(r.action, 'lead_form');
});

test('domini autorizzati: dominio esatto, www e sottodomini', async () => {
  assert.ok(hostAllowed('hotel.it', ['hotel.it']));
  assert.ok(hostAllowed('www.hotel.it', ['hotel.it']));
  assert.ok(hostAllowed('prenota.hotel.it', ['hotel.it']));
  assert.ok(!hostAllowed('hotel.it.evil.com', ['hotel.it']));
  assert.ok(!hostAllowed('fakehotel.it', ['hotel.it']));
  assert.ok(hostAllowed('qualsiasi.com', []));
  assert.deepEqual(parseDomains('https://www.Hotel.it/camere\nprenota.hotel.it, hotel.it ; ###'), ['hotel.it', 'prenota.hotel.it']);
});

test('CSV contatti: BOM, separatore italiano e protezione da formule', async () => {
  const csv = leadsCsv([{ created_at: '2026-11-18 10:00:00', name: '=HYPERLINK("x")', email: 'a@b.it', phone: '+39 333', widget_name: 'W;1', status: 'new' }]);
  assert.ok(csv.startsWith(String.fromCharCode(0xfeff) + 'Data;Nome;'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv.includes("'+39 333"));
  assert.ok(csv.includes('"W;1"'));
});

test('zip del plugin WordPress valido e leggibile', async () => {
  const content = Buffer.from('<?php echo "ciao";');
  const zip = createZip([{ name: 'aperto-chat/aperto-chat.php', data: content }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const nameLen = zip.readUInt16LE(26);
  const size = zip.readUInt32LE(18);
  const data = zip.subarray(30 + nameLen, 30 + nameLen + size);
  assert.deepEqual(zlib.inflateRawSync(data), content);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt32LE(14), zlib.crc32(content));
});
