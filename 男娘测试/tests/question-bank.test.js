/**
 * 题库一致性测试。
 *
 * 存在的意义：这个项目的题库按语言分成三份独立文件（`questions/questions_*.js`），
 * 彼此没有任何编译期约束，任何一次单语扩容/删题都会造成三语漂移，而页面对此**静默**
 * （只是题目数量不同），很难察觉。同时首页文案里写死了题库容量，也需要跟着一起更新。
 *
 * 这里把以下几件事钉死：
 *   1. 三份题库的题量与 id 集合完全一致
 *   2. 每个维度的题量、face 配额上限与抽题引擎的要求匹配
 *   3. 抽题引擎能稳定抽满一套问卷
 *   4. 页面上的题库容量文案 == 题库真实题量
 *   5. 语言配置里引用的题库文件真实存在（缺失时会静默回退到默认语言题库）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const QUESTION_DIR = path.join(ROOT, 'questions');

const BANKS = {
    'zh-CN': 'questions_zh_cn.js',
    'en-US': 'questions_en_us.js',
    'ja': 'questions_ja.js'
};

// 抽题引擎的配额，与 index.html 中 initGame() 保持一致
const EXPECTED_PER_DIM = { A: 44, B: 44, C: 44, D: 44, F: 16, K: 8 };
const DRAW_PER_DIM = 11;
const DRAW_FILLER = 4;
const DRAW_CONSISTENCY = 2;
const HIGH_FACE_CAP = 4;
const DRAW_ROUNDS = 300;

function readText(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadBank(fileName) {
    const code = fs.readFileSync(path.join(QUESTION_DIR, fileName), 'utf8');
    const sandbox = {};
    new Function('window', code)(sandbox);
    return sandbox.rawQuestionBank;
}

function summarize(bank) {
    const byDim = {};
    bank.forEach(q => { byDim[q.d] = (byDim[q.d] || 0) + 1; });
    return byDim;
}

// 与 index.html 中 drawFaceCapped / drawConsistencyPair 同构的最小复刻
function shuffle(items) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function drawFaceCapped(pool, count, state) {
    const selected = [];
    const deferred = [];
    shuffle(pool).forEach(q => {
        if (selected.length >= count) return;
        const isHighFace = (q.face || 2) >= 3;
        if (isHighFace && state.used >= state.max) {
            deferred.push(q);
            return;
        }
        if (isHighFace) state.used++;
        selected.push(q);
    });
    return selected.concat(deferred.slice(0, count - selected.length));
}

function drawConsistencyPair(pool) {
    const grouped = pool.reduce((map, q) => {
        const key = q.consistencyKey || q.facet || q.id;
        (map[key] = map[key] || []).push(q);
        return map;
    }, {});
    const pairs = Object.values(grouped).filter(group => group.length >= 2);
    if (!pairs.length) return shuffle(pool).slice(0, DRAW_CONSISTENCY);
    return shuffle(pairs[Math.floor(Math.random() * pairs.length)]).slice(0, DRAW_CONSISTENCY);
}

function drawOnce(bank) {
    let selected = [];
    const highFaceState = { used: 0, max: HIGH_FACE_CAP };
    ['A', 'B', 'C', 'D'].forEach(dim => {
        const pool = bank.filter(q => q.scored !== false && q.d === dim);
        selected = selected.concat(drawFaceCapped(pool, DRAW_PER_DIM, highFaceState));
    });
    selected = selected.concat(shuffle(bank.filter(q => q.scored === false && q.d === 'F')).slice(0, DRAW_FILLER));
    selected = selected.concat(drawConsistencyPair(bank.filter(q => q.scored === false && q.d === 'K')));
    return selected;
}

const banks = {};
const idsByLocale = {};

// --- 1. 三份题库都能加载，且题量与 id 集合一致 ---
Object.entries(BANKS).forEach(([locale, file]) => {
    let bank;
    try {
        bank = loadBank(file);
    } catch (error) {
        throw new Error(`[${locale}] 题库加载失败 ${file}: ${error.message}`);
    }
    assert.ok(Array.isArray(bank) && bank.length, `[${locale}] 题库为空或格式不正确`);
    banks[locale] = bank;
    idsByLocale[locale] = bank.map(q => q.id).sort();
});

const referenceLocale = 'zh-CN';
const referenceSize = banks[referenceLocale].length;

Object.entries(BANKS).forEach(([locale, file]) => {
    assert.strictEqual(
        banks[locale].length,
        referenceSize,
        `[${locale}] 题量与其他语言不一致：${banks[locale].length} vs ${referenceSize}（${referenceLocale}）`
    );
    const missing = idsByLocale[referenceLocale].filter(id => !idsByLocale[locale].includes(id));
    const extra = idsByLocale[locale].filter(id => !idsByLocale[referenceLocale].includes(id));
    assert.deepStrictEqual(
        { missing, extra },
        { missing: [], extra: [] },
        `[${locale}] 题目 id 集合与其他语言不一致（缺失 ${missing.length} 项，多出 ${extra.length} 项）`
    );
});

// --- 2. 每个维度的题量与抽题要求匹配 ---
Object.entries(banks).forEach(([locale, bank]) => {
    const byDim = summarize(bank);
    Object.entries(EXPECTED_PER_DIM).forEach(([dim, expected]) => {
        assert.strictEqual(byDim[dim] || 0, expected, `[${locale}] 维度 ${dim} 题量应为 ${expected}，实际 ${byDim[dim] || 0}`);
    });

    const ids = bank.map(q => q.id);
    const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepStrictEqual([...new Set(duplicated)], [], `[${locale}] 存在重复题目 id`);

    bank.filter(q => q.type === 'choice').forEach(q => {
        assert.ok(Array.isArray(q.options) && q.options.length === 4, `[${locale}] ${q.id} 情景题应有 4 个选项`);
        q.options.forEach(opt => {
            assert.ok(opt.v != null, `[${locale}] ${q.id} 选项缺少分值 v`);
            assert.ok(typeof opt.l === 'string' && opt.l.trim(), `[${locale}] ${q.id} 选项文案为空`);
            if (q.scored !== false) {
                assert.ok(opt.v >= 1 && opt.v <= 5, `[${locale}] ${q.id} 选项分值 ${opt.v} 超出 1-5`);
            }
        });
    });

    bank.forEach(q => {
        assert.ok(typeof q.t === 'string' && q.t.trim(), `[${locale}] ${q.id} 题干为空`);
        assert.strictEqual(typeof q.r, 'boolean', `[${locale}] ${q.id} 的 r（是否反向）应为布尔值`);
    });

    // 每个维度都要有足够的反向题与足够的可抽数量
    ['A', 'B', 'C', 'D'].forEach(dim => {
        const pool = bank.filter(q => q.scored !== false && q.d === dim);
        assert.ok(pool.length >= DRAW_PER_DIM, `[${locale}] 维度 ${dim} 题量不足以抽 ${DRAW_PER_DIM} 题`);
        const reverse = pool.filter(q => q.r === true).length;
        assert.ok(reverse >= 2, `[${locale}] 维度 ${dim} 只有 ${reverse} 道反向题，不足以平衡默认倾向`);
    });

    // 一致性题必须成对，否则可能永远抽不到
    const consistency = bank.filter(q => q.scored === false && q.d === 'K');
    const groups = consistency.reduce((map, q) => {
        const key = q.consistencyKey || q.facet || q.id;
        map[key] = (map[key] || 0) + 1;
        return map;
    }, {});
    Object.entries(groups).forEach(([key, count]) => {
        assert.ok(count >= 2, `[${locale}] 一致性题分组 ${key} 只有 ${count} 题，无法配对抽取`);
    });
});

// --- 3. 抽题引擎能稳定抽满一套问卷 ---
Object.entries(banks).forEach(([locale, bank]) => {
    const expectedTotal = DRAW_PER_DIM * 4 + DRAW_FILLER + DRAW_CONSISTENCY;
    for (let i = 0; i < DRAW_ROUNDS; i++) {
        const drawn = drawOnce(bank);
        assert.strictEqual(drawn.length, expectedTotal, `[${locale}] 第 ${i + 1} 次抽题未抽满 ${expectedTotal} 题`);
        ['A', 'B', 'C', 'D'].forEach(dim => {
            const count = drawn.filter(q => q.scored !== false && q.d === dim).length;
            assert.strictEqual(count, DRAW_PER_DIM, `[${locale}] 第 ${i + 1} 次抽题中维度 ${dim} 抽到 ${count} 题`);
        });
        const highFace = drawn.filter(q => (q.face || 2) >= 3).length;
        assert.ok(highFace <= HIGH_FACE_CAP, `[${locale}] 第 ${i + 1} 次抽题中高脸谱题 ${highFace} 道，超出上限`);
    }
});

// --- 4. 页面文案里的题库容量必须与实际题量一致 ---
const html = readText('index.html');
const declaredInHtml = (html.match(/<strong>(\d+)题<\/strong>/) || [])[1];
assert.strictEqual(
    Number(declaredInHtml),
    referenceSize,
    `index.html 首页声明题库为 ${declaredInHtml} 题，实际为 ${referenceSize} 题`
);

// 注意：zh-CN / ja 是嵌套结构，en-US 是扁平 key，两种都要兼容
const LOCALE_FILES = {
    'zh-CN': 'locales/zh-cn.json',
    'en-US': 'locales/en_us.json',
    'ja': 'locales/ja.json'
};

Object.entries(LOCALE_FILES).forEach(([locale, file]) => {
    const localeData = JSON.parse(readText(file));
    const home = localeData.home || {};
    const candidates = [
        home.engineHtml, localeData['home.engineHtml'],
        home.bankIntro, localeData['home.bankIntro']
    ].filter(Boolean);
    assert.ok(candidates.length, `[${locale}] 缺少题库容量文案（home.engineHtml）`);
    candidates.forEach(text => {
        const matched = String(text).match(/(\d{2,4})\s*(?:题|questions|問)/);
        assert.ok(matched, `[${locale}] 无法从文案中解析题库容量：${text}`);
        assert.strictEqual(Number(matched[1]), referenceSize, `[${locale}] 文案声明 ${matched[1]} 题，实际 ${referenceSize} 题`);
    });
});

// --- 5. 语言配置引用的题库文件必须真实存在 ---
Object.values(BANKS).forEach(file => {
    assert.ok(fs.existsSync(path.join(QUESTION_DIR, file)), `语言配置引用的题库文件缺失：questions/${file}`);
});

// 反向检查：questions 目录里不应残留未被引用的题库副本
const referenced = new Set(Object.values(BANKS));
fs.readdirSync(QUESTION_DIR).filter(name => name.endsWith('.js')).forEach(name => {
    assert.ok(referenced.has(name), `questions/${name} 没有被任何语言配置引用，属于遗留副本，建议删除`);
});

console.log(`question bank tests passed (${referenceSize} questions x ${Object.keys(BANKS).length} locales)`);
