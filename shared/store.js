/* ============================================================
   ロコ庵 運営ハブ ― 共有データ窓口（store.js）
   ------------------------------------------------------------
   すべての機能は、この window.Store だけを使って
   データを読み書きします（直接localStorageを触らない）。

     await Store.get(key)          … 1件読む
     await Store.set(key, value)   … 1件保存
     await Store.remove(key)       … 1件削除
     await Store.list(prefix)      … キー一覧

   いまは「端末内保存（localStorage）」です。
   将来「家族で共有・同期」したくなったら、
   下の RemoteAdapter（GAS＋スプレッドシート）を実装して、
   一番下の BACKEND を差し替えるだけ。各機能の中身は変えなくてOK。
   ============================================================ */
(function () {
  const PREFIX = "rokoan:";

  /* --- 端末内アダプタ（今これを使用中） --- */
  const LocalAdapter = {
    async get(key) {
      try { const v = localStorage.getItem(PREFIX + key); return v ? JSON.parse(v) : null; }
      catch (e) { return null; }
    },
    async set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    async remove(key) {
      try { localStorage.removeItem(PREFIX + key); return true; }
      catch (e) { return false; }
    },
    async list(keyPrefix = "") {
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX + keyPrefix)) out.push(k.slice(PREFIX.length));
        }
      } catch (e) {}
      return out;
    }
  };

  /* --- 将来：家族共有アダプタ（Google Sheets＋GAS）---------------
     共有にするときだけ、下のコメントを外して GAS_URL を入れ、
     最下行を  BACKEND = RemoteAdapter;  に変える。
     ※ POSTのContent-Typeを text/plain にするのは、GASでCORSの
       事前確認(preflight)を避けるための定番テクニックです。

  const GAS_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
  const RemoteAdapter = {
    async get(key){
      const r = await fetch(GAS_URL + "?action=get&key=" + encodeURIComponent(key));
      return (await r.json()).value ?? null;
    },
    async set(key, value){
      await fetch(GAS_URL, { method:"POST", headers:{"Content-Type":"text/plain"},
        body: JSON.stringify({ action:"set", key, value }) });
      return true;
    },
    async remove(key){
      await fetch(GAS_URL, { method:"POST", headers:{"Content-Type":"text/plain"},
        body: JSON.stringify({ action:"remove", key }) });
      return true;
    },
    async list(keyPrefix=""){
      const r = await fetch(GAS_URL + "?action=list&prefix=" + encodeURIComponent(keyPrefix));
      return (await r.json()).keys ?? [];
    }
  };
  ------------------------------------------------------------ */

  const BACKEND = LocalAdapter;   // ← 共有にするとき、ここを RemoteAdapter に
  window.Store = BACKEND;
})();
