// verify-musterbook — the ledger maths: dedupe, the public/house/bot partition,
// week/ever aggregation, and reclassification. Pure, headless (identity inv. 3).
import {
  utcDay, visitUid, classify, isLocalIp, isBotUa, isBotIp,
  recordVisit, tagInsider, summarize, CLASSES,
} from '../src/musterbook.js';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('  FAIL:', name); } };

// ---- day + uid --------------------------------------------------------------
check('utcDay floors to UTC day number', utcDay(20651 * 86400 + 5) === 20651);
const D = 20651;
check('visitUid stable for a given pid', visitUid('abc-123', '1.2.3.4', 'ua') === visitUid('abc-123', '9.9.9.9', 'other'));
check('visitUid differs by pid', visitUid('abc-123', '', '') !== visitUid('def-456', '', ''));
check('visitUid falls back to ip+ua for a bad pid',
  visitUid('!!', '1.2.3.4', 'ua') === visitUid('', '1.2.3.4', 'ua') &&
  visitUid('!!', '1.2.3.4', 'ua') !== visitUid('!!', '5.6.7.8', 'ua'));

// ---- classification ---------------------------------------------------------
check('loopback is local', isLocalIp('127.0.0.1') && isLocalIp('::1'));
check('RFC1918 + tailnet are local', isLocalIp('192.168.1.5') && isLocalIp('10.0.0.2') && isLocalIp('172.16.4.4') && isLocalIp('100.90.66.54'));
check('public ip is not local', !isLocalIp('86.170.239.146'));
check('googlebot ip is a bot', isBotIp('66.249.66.71'));
check('bot UA is a bot', isBotUa('Mozilla/5.0 (compatible; Googlebot/2.1)') && isBotUa('python-requests/2.31'));
check('real UA is not a bot', !isBotUa('Mozilla/5.0 (Windows NT 10.0) Chrome/120'));

const insiders = new Set(['aaaaaaaaaaaa']);
check('insider tag wins over everything', classify('aaaaaaaaaaaa', '86.170.1.1', 'Chrome', insiders) === 'house');
check('bot UA classifies bot', classify('bbbbbbbbbbbb', '86.170.1.1', 'Googlebot', insiders) === 'bot');
check('local ip classifies house', classify('cccccccccccc', '127.0.0.1', 'Chrome', insiders) === 'house');
check('stranger classifies pub', classify('dddddddddddd', '86.170.239.146', 'Chrome', insiders) === 'pub');

// ---- dedupe: a refresh inflates raw hits, never uniques ---------------------
const s1 = {};
recordVisit(s1, 'visit', 'u1', 'pub', D);
recordVisit(s1, 'visit', 'u1', 'pub', D); // same browser, same day → refresh
recordVisit(s1, 'visit', 'u2', 'pub', D);
check('raw visits count every hit', s1.days[String(D)].v === 3);
check('unique visits dedupe per day', s1.days[String(D)].uv === 2);

// play is a separate bit on the same browser
recordVisit(s1, 'play', 'u1', 'pub', D);
recordVisit(s1, 'play', 'u1', 'pub', D);
check('unique plays dedupe per day', s1.days[String(D)].up === 1);
check('raw plays count every hit', s1.days[String(D)].p === 2);

// ---- the partition ----------------------------------------------------------
const s2 = {};
recordVisit(s2, 'visit', 'stranger', 'pub', D);
recordVisit(s2, 'play', 'stranger', 'pub', D);
recordVisit(s2, 'visit', 'james', 'house', D);
recordVisit(s2, 'play', 'james', 'house', D);
recordVisit(s2, 'visit', 'crawler', 'bot', D);
const sum2 = summarize(s2, D);
check('real (pub) headline excludes house + bot', sum2.today.real.uniques === 1 && sum2.today.real.playUniques === 1);
check('house partition holds James', sum2.today.house.uniques === 1 && sum2.today.house.playUniques === 1);
check('bot partition holds the crawler', sum2.today.bot.uniques === 1);
check('ever browsers partitioned', sum2.ever.real.browsers === 1 && sum2.ever.house.browsers === 1 && sum2.ever.bot.browsers === 1);
check('ever players = only those who played', sum2.ever.real.players === 1 && sum2.ever.bot.players === 0);

// ---- week aggregation dedupes a browser across days -------------------------
const s3 = {};
for (const day of [D - 5, D - 3, D]) recordVisit(s3, 'visit', 'regular', 'pub', day);
recordVisit(s3, 'visit', 'oneoff', 'pub', D - 2);
const sum3 = summarize(s3, D);
check('week uniques count a returning browser once', sum3.week.real.uniques === 2);
check('week raw visits sum every day', sum3.week.visits === 4);

// ---- reclassification: tag a stranger insider, they leave the real headline -
const s4 = {};
recordVisit(s4, 'visit', 'later-me', 'pub', D - 1);
recordVisit(s4, 'visit', 'later-me', 'pub', D);
check('before tagging, browser is real', summarize(s4, D).ever.real.browsers === 1);
tagInsider(s4, 'later-me');
const sum4 = summarize(s4, D);
check('after tagging, browser moves to house (ever)', sum4.ever.real.browsers === 0 && sum4.ever.house.browsers === 1);
check('after tagging, week uniques re-partition to house', sum4.week.real.uniques === 0 && sum4.week.house.uniques === 1);

// ---- seen-set pruning keeps day totals but drops old dedupe -----------------
const s5 = {};
recordVisit(s5, 'visit', 'ancient', 'pub', D - 100); // older than SEEN_KEEP_DAYS
recordVisit(s5, 'visit', 'fresh', 'pub', D);
check('old day totals survive pruning', s5.days[String(D - 100)].v === 1);
check('old dedupe sets are pruned', s5.seen[String(D - 100)] === undefined && s5.seen[String(D)] !== undefined);

console.log(`\nverify-musterbook: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
