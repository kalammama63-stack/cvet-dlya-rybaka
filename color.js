// Цвет: перевод в OKLab, сходство, русские названия.
(function (root) {
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  // sRGB 0..255 -> OKLab [L, a, b]
  function toLab(r, g, b) {
    r = lin[r]; g = lin[g]; b = lin[b];
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
  }

  function toLch(lab) {
    let h = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
    if (h < 0) h += 360;
    return [lab[0], Math.hypot(lab[1], lab[2]), h];
  }

  // 100 = одинаковые, 0 = совсем разные
  function similarity(p, q) {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    return Math.max(0, Math.round(100 - d * 400));
  }

  const BASES = ['красный', 'розовый', 'малиновый', 'бордовый', 'оранжевый', 'коричневый',
    'бежевый', 'жёлтый', 'салатовый', 'оливковый', 'зелёный', 'бирюзовый', 'голубой',
    'синий', 'фиолетовый', 'сиреневый', 'белый', 'серый', 'чёрный'];
  const MUTED = new Set(['коричневый', 'бежевый', 'оливковый', 'бордовый']);
  const LIGHT = new Set(['розовый', 'голубой', 'сиреневый', 'бежевый']);
  const DARK = new Set(['бордовый', 'коричневый', 'оливковый']);

  function family(L, C, h) {
    if (h >= 350 || h < 40) {
      if (L > 0.72) return 'розовый';
      if (L < 0.47) return 'бордовый';
      return h >= 350 || h < 18 ? 'малиновый' : 'красный';
    }
    if (h < 75) {
      if (L > 0.7 && C < 0.1) return 'бежевый';
      return L < 0.6 ? 'коричневый' : 'оранжевый';
    }
    if (h < 118) {
      if (h < 95 && L > 0.7 && C < 0.09) return 'бежевый';
      return L < 0.6 ? 'оливковый' : 'жёлтый';
    }
    if (h < 140) return L < 0.55 ? 'оливковый' : 'салатовый';
    if (h < 175) return 'зелёный';
    if (h < 210) return 'бирюзовый';
    if (h < 275) return L > 0.72 ? 'голубой' : 'синий';
    if (h < 315) return L > 0.7 ? 'сиреневый' : 'фиолетовый';
    if (L > 0.7) return h < 335 && C < 0.1 ? 'сиреневый' : 'розовый';
    return L < 0.45 ? 'фиолетовый' : 'малиновый';
  }

  function mk(base, mod) {
    return { base, mod, text: mod ? mod + '-' + base : base };
  }

  function nameLab(lab) {
    const [L, C, h] = toLch(lab);
    if (L < 0.22) return mk('чёрный', '');
    if (C < (L > 0.85 ? 0.025 : 0.035)) {
      if (L > 0.93) return mk('белый', '');
      return mk('серый', L > 0.75 ? 'светло' : L < 0.45 ? 'тёмно' : '');
    }
    const base = family(L, C, h);
    let mod = '';
    if (C < 0.07) mod = MUTED.has(base) ? '' : L > 0.78 ? 'бледно' : 'серо';
    else if (L > (LIGHT.has(base) ? 0.88 : 0.8) && C < 0.14) mod = 'светло';
    else if (L < (DARK.has(base) ? 0.33 : 0.45)) mod = 'тёмно';
    else if (C > 0.22) mod = 'ярко';
    return mk(base, mod);
  }

  // Какие оттенки считать подходящими при поиске
  const MOD_OK = {
    '': null,
    'бледно': ['бледно', 'светло'],
    'светло': ['светло', 'бледно'],
    'тёмно': ['тёмно'],
    'ярко': ['ярко'],
    'серо': ['серо', 'бледно'],
  };
  function matches(name, target) {
    if (name.base !== target.base) return false;
    const ok = MOD_OK[target.mod];
    return !ok || ok.includes(name.mod);
  }

  // Разбор фразы «бледно-розовый» -> {base, mod}
  const STEMS = [
    ['розов', 'розовый'], ['малинов', 'малиновый'], ['бордов', 'бордовый'], ['вишн', 'бордовый'],
    ['оранжев', 'оранжевый'], ['коричнев', 'коричневый'], ['бежев', 'бежевый'],
    ['желт', 'жёлтый'], ['салатов', 'салатовый'], ['оливков', 'оливковый'], ['хаки', 'оливковый'],
    ['зелен', 'зелёный'], ['бирюзов', 'бирюзовый'], ['голуб', 'голубой'], ['син', 'синий'],
    ['фиолетов', 'фиолетовый'], ['сиренев', 'сиреневый'], ['лилов', 'сиреневый'],
    ['красн', 'красный'], ['бел', 'белый'], ['черн', 'чёрный'], ['сер', 'серый'],
  ];
  function parse(text) {
    const t = text.toLowerCase().replace(/ё/g, 'е');
    const words = t.split(/[^а-я]+/).filter(Boolean);
    let base = null;
    for (const [stem, b] of STEMS) {
      if (stem === 'сер' && base) break;
      if (words.some(w => w.startsWith(stem) && !(stem === 'сер' && w === 'серо') && !(stem === 'бел' && w === 'бледно'))) {
        base = b;
        if (stem !== 'сер') break;
      }
    }
    if (!base) return null;
    let mod = '';
    if (/бледн/.test(t)) mod = 'бледно';
    else if (/светл/.test(t)) mod = 'светло';
    else if (/темн/.test(t)) mod = 'тёмно';
    else if (/ярк/.test(t)) mod = 'ярко';
    else if (words.includes('серо') && base !== 'серый') mod = 'серо';
    return { base, mod };
  }

  const api = { toLab, toLch, similarity, nameLab, matches, parse, BASES };
  if (typeof module !== 'undefined') module.exports = api; else root.Color = api;
})(this);
