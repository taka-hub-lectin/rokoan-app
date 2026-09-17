/* ============================================================
   ロコ庵アプリ ― 窓口API（api.js）
   ------------------------------------------------------------
   予約データの取り方を1か所にまとめる。画面（app.html）は
   window.RocoApi だけを使い、fetch も合言葉も直接触らない。

     await RocoApi.load()        … 取得（失敗したら前回の内容を返す）
     RocoApi.cached()            … 前回の内容だけを同期で返す（起動時の初期表示用）
     RocoApi.setKey(k) / .key()  … 合言葉
     RocoApi.setApiUrl(u)        … 窓口のURL（ふつうは触らない）
     RocoApi.isReady()           … 合言葉と窓口URLが揃っているか

   ■ 合言葉はこのファイルに書かない。
     リポジトリは公開なので、合言葉を書くと誰でも予約を読めてしまう。
     家族に配るリンク（app.html#k=…）から受け取って端末に覚えさせる。
   ============================================================ */
(function () {
  // 窓口GASの /exec。合言葉と違い、これ自体は鍵ではない（鍵が無いと denied を返す）。
  // デプロイし直してURLが変わったら、ここを直すか #api= を付けたリンクで上書きする。
  const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbx7JRqtaW61N1seaR8h6cPb6FWzk77d6Bpyu56l9NfuGCgZFRQ-shhiT1ddfneQiJic/exec";

  const K_KEY = "app:key";
  const K_API = "app:apiUrl";
  const K_CACHE = "app:cache";

  // localStorage を直接触らないのがこのリポジトリの決まり（shared/store.js）。
  // ただし起動直後の初期表示だけは同期で読みたいので、そこだけ素の読み出しを使う。
  const RAW_PREFIX = "rokoan:";
  const rawGet = (k) => {
    try { const v = localStorage.getItem(RAW_PREFIX + k); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  };

  let _key = rawGet(K_KEY) || "";
  let _api = rawGet(K_API) || "";

  /** 配布リンクの #k=… / #api=… を読んで覚える。URLからは消す（履歴に残さない） */
  function adoptFromHash() {
    const h = String(location.hash || "").replace(/^#/, "");
    if (!h) return;
    const p = new URLSearchParams(h);
    let took = false;
    if (p.get("k")) { setKey(p.get("k").trim()); took = true; }
    if (p.get("api")) { setApiUrl(p.get("api").trim()); took = true; }
    if (took) history.replaceState(null, "", location.pathname + location.search);
  }

  function setKey(k) { _key = k; Store.set(K_KEY, k); }
  function setApiUrl(u) { _api = u; Store.set(K_API, u); }
  function key() { return _key; }
  function apiUrl() { return _api || DEFAULT_API_URL; }
  function isReady() { return !!_key && /^https:\/\/script\.google\.com\/.+\/exec$/.test(apiUrl()); }

  function cached() { return rawGet(K_CACHE); }

  /**
   * 取得する。通信できなかったときは前回の内容をそのまま返し、
   * 「いつの情報か」は data.updated で画面が判断する（黙って新しいふりをしない）。
   */
  async function load() {
    if (!isReady()) {
      return { ok: false, error: "setup", data: cached() };
    }
    const url = apiUrl() + "?k=" + encodeURIComponent(_key) + "&view=all&t=" + Date.now();
    try {
      const r = await fetch(url, { method: "GET", redirect: "follow" });
      if (!r.ok) return { ok: false, error: "http_" + r.status, data: cached() };

      let j;
      try { j = await r.json(); }
      catch (e) { return { ok: false, error: "not_json", data: cached() }; }

      if (!j || j.ok !== true) {
        return { ok: false, error: (j && j.error) || "denied", data: cached() };
      }
      const prev = cached() || {};
      const data = {
        updated: j.updated || "",
        rows: Array.isArray(j.rows) ? j.rows : [],
        notes: Array.isArray(j.notes) ? j.notes : [],
        // 🔔お知らせ。窓口が notices を返さない（古いデプロイ等）ときは、前回の内容を消さずに残す
        notices: Array.isArray(j.notices) ? j.notices : (Array.isArray(prev.notices) ? prev.notices : []),
        noticesUpdated: j.noticesUpdated || "",     // 空＝お知らせのシートが読めていない
        noticesMissing: !Array.isArray(j.notices),  // 窓口が notices を返していない
        // 📤送信キュー（承認待ちの文面と状態）。notices と同じ考え方で、古いデプロイなら前回の内容を残す
        queue: Array.isArray(j.queue) ? j.queue : (Array.isArray(prev.queue) ? prev.queue : []),
        queueUpdated: j.queueUpdated || "",
        queueMissing: !Array.isArray(j.queue),
        airbnbError: j.airbnbError || "",           // 空でなければ「Airbnb分が欠けている一覧」
        // 生データ（名簿スプレッドシート）へのリンク。窓口が返さない古いデプロイなら前回の値を残す
        sheet: (j.sheet && j.sheet.url) ? j.sheet : (prev.sheet || null),
        fetchedAt: j.fetchedAt || new Date().toISOString(),
      };
      Store.set(K_CACHE, data);
      return { ok: true, error: "", data };
    } catch (e) {
      return { ok: false, error: "offline", data: cached() };
    }
  }

  /**
   * 📤送信キューの1件を動かす（承認／修正だけ保存／送らない）。
   * Content-Type を text/plain にするのは、GASでCORSの事前確認(preflight)を避けるための定番
   * （shared/store.js の RemoteAdapter案にも同じ注記がある）。
   * @param {"approve"|"save_edit"|"reject"} action
   * @param {{id?:string, reservationCode:string, issueType:string, message?:string, by?:string}} item
   */
  async function decide(action, item) {
    if (!isReady()) return { ok: false, error: "setup" };
    const body = {
      k: _key, action,
      id: item.id || "",                     // 行のid（あれば窓口はこれで1行に決める）
      reservationCode: item.reservationCode, issueType: item.issueType,
      message: item.message || "", by: item.by || "",
    };
    try {
      const r = await fetch(apiUrl(), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
      });
      if (!r.ok) return { ok: false, error: "http_" + r.status };
      try { return await r.json(); }
      catch (e) { return { ok: false, error: "not_json" }; }
    } catch (e) {
      return { ok: false, error: "offline" };
    }
  }

  adoptFromHash();

  window.RocoApi = { load, cached, setKey, setApiUrl, key, apiUrl, isReady, decide };
})();
