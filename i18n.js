// 다국어 처리
// - 번역 파일: locales/<코드>.json (키는 ko.json 기준)
// - 언어 결정 순서: ?lang= → 저장된 선택 → 브라우저 언어 → en
// - HTML 속성: data-i18n (텍스트), data-i18n-html (HTML 포함), data-i18n-attr="속성:키;속성:키"
(() => {
  const LANGS = [
    ["ko", "한국어"],
    ["en", "English"],
    ["en-SG", "English (Singapore)"],
    ["de", "Deutsch"],
    ["fr", "Français"],
    ["it", "Italiano"],
    ["nl", "Nederlands"],
    ["sv", "Svenska"],
    ["pl", "Polski"],
    ["es-ES", "Español (España)"],
    ["es-419", "Español (Latinoamérica)"],
    ["pt", "Português"],
    ["pt-BR", "Português (Brasil)"],
    ["tr", "Türkçe"],
    ["ru", "Русский"],
    ["ar", "العربية"],
    ["hi", "हिन्दी"],
    ["th", "ไทย"],
    ["vi", "Tiếng Việt"],
    ["id", "Bahasa Indonesia"],
    ["ms-MY", "Bahasa Melayu"],
    ["fil", "Filipino"],
    ["ja-JP", "日本語"],
    ["zh-CN", "简体中文"],
    ["zh-TW", "繁體中文 (台灣)"],
    ["zh-HK", "繁體中文 (香港)"],
  ];
  const CODES = LANGS.map(([c]) => c);
  const DEFAULT = "ko"; // HTML에 기본으로 들어있는 언어
  const RTL = ["ar"];

  // 제목용 폰트: Jua는 한글·기본 라틴만 지원하므로 언어별로 둥근 폰트를 따로 불러옴
  const FONTS = {
    ko: null,
    "ja-JP": ["M+PLUS+Rounded+1c:wght@800", "'M PLUS Rounded 1c'"],
    "zh-CN": ["Noto+Sans+SC:wght@900", "'Noto Sans SC'"],
    "zh-TW": ["Noto+Sans+TC:wght@900", "'Noto Sans TC'"],
    "zh-HK": ["Noto+Sans+HK:wght@900", "'Noto Sans HK'"],
    th: ["Mitr:wght@500", "'Mitr'"],
    ar: ["Baloo+Bhaijaan+2:wght@800", "'Baloo Bhaijaan 2'"],
    hi: ["Baloo+2:wght@800", "'Baloo 2'"],
    _latin: ["Nunito:wght@800;900", "'Nunito'"],
  };

  const select = document.getElementById("lang-select");
  const cache = {};
  let current = DEFAULT;

  // 페이지에 들어있는 한국어 원문을 저장해두고 ko로 돌아갈 때 사용
  const original = { text: new Map(), html: new Map(), attr: new Map() };
  document.querySelectorAll("[data-i18n]").forEach((el) => original.text.set(el, el.textContent));
  document.querySelectorAll("[data-i18n-html]").forEach((el) => original.html.set(el, el.innerHTML));
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const saved = {};
    parseAttr(el).forEach(([attr]) => (saved[attr] = el.getAttribute(attr)));
    original.attr.set(el, saved);
  });

  function parseAttr(el) {
    return el.dataset.i18nAttr.split(";").map((pair) => pair.split(":").map((s) => s.trim()));
  }

  function match(tag) {
    if (!tag) return null;
    const t = tag.toLowerCase();
    const exact = CODES.find((c) => c.toLowerCase() === t);
    if (exact) return exact;
    const [base, region = ""] = t.split("-");
    if (base === "zh") {
      if (region === "hk" || region === "mo") return "zh-HK";
      if (region === "tw" || t.includes("hant")) return "zh-TW";
      return "zh-CN";
    }
    if (base === "es") return region && region !== "es" ? "es-419" : "es-ES";
    if (base === "pt") return region === "br" ? "pt-BR" : "pt";
    if (base === "en") return region === "sg" ? "en-SG" : "en";
    if (base === "tl") return "fil";
    if (base === "ms") return "ms-MY";
    if (base === "ja") return "ja-JP";
    if (base === "nb" || base === "no") return null;
    return CODES.find((c) => c.split("-")[0] === base) || null;
  }

  function detect() {
    const param = new URLSearchParams(location.search).get("lang");
    if (match(param)) return match(param);
    try {
      const saved = localStorage.getItem("yg-lang");
      if (match(saved)) return match(saved);
    } catch (e) {}
    for (const l of navigator.languages || [navigator.language]) {
      const m = match(l);
      if (m) return m;
    }
    return "en";
  }

  async function load(code) {
    if (cache[code]) return cache[code];
    const res = await fetch(`./locales/${code}.json`);
    if (!res.ok) throw new Error(`locale ${code}: ${res.status}`);
    return (cache[code] = await res.json());
  }

  function applyFont(code) {
    const font = code === "ko" ? null : FONTS[code] || FONTS._latin;
    const root = document.documentElement;
    if (!font) {
      root.style.removeProperty("--display");
      return;
    }
    const id = "font-" + font[0];
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${font[0]}&display=swap`;
      document.head.appendChild(link);
    }
    root.style.setProperty("--display", `${font[1]}, "Noto Sans KR", system-ui, sans-serif`);
  }

  function apply(dict) {
    const t = (key, fallback) => (dict && dict[key] != null ? dict[key] : fallback);
    original.text.forEach((orig, el) => (el.textContent = t(el.dataset.i18n, orig)));
    original.html.forEach((orig, el) => (el.innerHTML = t(el.dataset.i18nHtml, orig)));
    original.attr.forEach((orig, el) => {
      parseAttr(el).forEach(([attr, key]) => el.setAttribute(attr, t(key, orig[attr])));
    });
  }

  async function setLang(code, save) {
    let dict = null;
    if (code !== DEFAULT) {
      try {
        dict = await load(code);
      } catch (e) {
        console.warn(e);
        // 번역 파일을 못 불러오면 영어 → 한국어 순으로 대체
        if (code !== "en") return setLang("en", false);
        code = DEFAULT;
      }
    }
    current = code;
    apply(dict);
    applyFont(code);
    const root = document.documentElement;
    root.lang = code;
    root.dir = RTL.includes(code) ? "rtl" : "ltr";
    select.value = code;
    if (save) {
      try {
        localStorage.setItem("yg-lang", code);
      } catch (e) {}
      const url = new URL(location.href);
      url.searchParams.set("lang", code);
      history.replaceState(null, "", url);
    }
  }

  LANGS.forEach(([code, name]) => select.add(new Option(name, code)));
  select.addEventListener("change", () => setLang(select.value, true));

  setLang(detect(), false);
  window.ygI18n = { setLang, get lang() { return current; } };
})();
