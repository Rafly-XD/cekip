/* ==========================================================
 * IP Checker · Static Edition
 * 100% client-side. No backend. Uses:
 *  - Cloudflare cdn-cgi/trace (primary, HTTPS, unlimited)
 *  - api.ipify.org (IP-only fallback)
 *  - ipapi.co (location/ISP enrichment)
 *  - localStorage for history
 * ========================================================== */

(function () {
  "use strict";

  const HISTORY_KEY = "ip_checker_static_history_v1";
  const MAX_HISTORY = 500;

  // ---------------- Utilities ----------------
  const $ = (id) => document.getElementById(id);

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return iso;
    }
  };

  const relTime = (iso) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 5) return "just now";
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const countryFlagEmoji = (code) => {
    if (!code || code.length !== 2) return "";
    const A = 0x1f1e6;
    const cc = code.toUpperCase();
    return String.fromCodePoint(A + (cc.charCodeAt(0) - 65)) +
           String.fromCodePoint(A + (cc.charCodeAt(1) - 65));
  };

  // ---------------- History persistence ----------------
  const loadHistory = () => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveHistory = (arr) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn("History save failed:", e);
    }
  };

  let history = loadHistory();

  // ---------------- Toast system ----------------
  const showToast = ({ title, description, type = "success", duration = 3500 }) => {
    const container = $("toast-container");
    const el = document.createElement("div");
    el.className = `toast ${type}`;

    const iconSvg =
      type === "warn"
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>'
        : type === "error"
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';

    el.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div>
        <div class="toast-title">${title}</div>
        ${description ? `<div class="toast-desc">${description}</div>` : ""}
      </div>
    `;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 260);
    }, duration);
  };

  // ---------------- IP detection ----------------
  // Try Cloudflare trace first (rich data + no rate limit for reasonable use).
  const fetchCloudflareTrace = async () => {
    const res = await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("cf trace failed");
    const txt = await res.text();
    const map = {};
    txt.split("\n").forEach((line) => {
      const idx = line.indexOf("=");
      if (idx > 0) map[line.slice(0, idx)] = line.slice(idx + 1);
    });
    return {
      ip: map.ip,
      country_code: map.loc || null,
      colo: map.colo || null,
      http: map.http || null,
      tls: map.tls || null,
      warp: map.warp === "on",
    };
  };

  // Ipify fallback: just IP.
  const fetchIpify = async () => {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("ipify failed");
    return await res.json();
  };

  // ipapi.co gives full geo + ISP for a given IP. HTTPS, no key.
  const fetchIpapi = async (ip) => {
    const url = ip
      ? `https://ipapi.co/${ip}/json/`
      : "https://ipapi.co/json/";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("ipapi failed");
    const data = await res.json();
    if (data && data.error) throw new Error(data.reason || "ipapi error");
    return data;
  };

  const detectCurrentIP = async () => {
    let baseInfo = null;
    try {
      baseInfo = await fetchCloudflareTrace();
    } catch (e) {
      console.warn("cf trace failed, falling back to ipify", e);
      try {
        const j = await fetchIpify();
        baseInfo = { ip: j.ip };
      } catch (err) {
        console.error("ipify failed too", err);
        throw new Error("Semua provider IP tidak merespons");
      }
    }

    // Enrich with location/ISP (best-effort, may rate-limit)
    let enrich = null;
    try {
      enrich = await fetchIpapi(baseInfo.ip);
    } catch (e) {
      console.warn("ipapi enrich failed:", e.message);
    }

    return { ...baseInfo, enrich };
  };

  // ---------------- UI Renderers ----------------
  const setStatus = (mode) => {
    const dot = $("status-dot");
    const label = $("status-label");
    dot.classList.remove("pulse", "duplicate", "fresh");
    if (mode === "loading") {
      dot.classList.add("pulse");
      label.textContent = "Detecting…";
    } else if (mode === "duplicate") {
      dot.classList.add("duplicate");
      label.textContent = "Duplicate Detected";
    } else if (mode === "fresh") {
      dot.classList.add("fresh");
      label.textContent = "Current Public IP";
    } else {
      dot.classList.add("fresh");
      label.textContent = "Idle";
    }
  };

  const renderIP = (record) => {
    const disp = $("ip-display");
    const skel = $("ip-skeleton");
    skel.hidden = true;
    disp.hidden = false;
    disp.textContent = record.ip;
    // Retrigger animation
    disp.style.animation = "none";
    void disp.offsetWidth;
    disp.style.animation = "";

    $("check-index").textContent = `#${String(record.check_count).padStart(3, "0")}`;
    $("checked-at").textContent = formatTime(record.timestamp);
    $("check-status").innerHTML = record.is_duplicate
      ? '<span class="hist-dot repeat" style="display:inline-block;margin-right:6px;"></span>Repeat'
      : '<span class="hist-dot new" style="display:inline-block;margin-right:6px;"></span>Fresh';

    const dupBanner = $("dup-banner");
    if (record.is_duplicate) {
      dupBanner.hidden = false;
      $("dup-count").textContent = `${record.check_count}×`;
      $("dup-first").textContent = formatTime(record.first_seen);
      // Pulse the panel border
      const panel = $("ip-panel");
      panel.classList.remove("pulse-warning");
      void panel.offsetWidth;
      panel.classList.add("pulse-warning");
      setTimeout(() => panel.classList.remove("pulse-warning"), 2400);
    } else {
      dupBanner.hidden = true;
    }

    // Enrichment
    const info = record.enrich || {};
    const hasEnrich = info && (info.country || info.city || info.org);
    const grid = $("info-grid");
    grid.hidden = !hasEnrich;
    if (hasEnrich) {
      $("info-flag").textContent = countryFlagEmoji(info.country_code || info.country);
      $("loc-country").textContent = info.country_name || info.country || "—";
      $("loc-city").textContent = info.city || "—";
      $("loc-region").textContent = info.region || info.region_code || "—";
      $("loc-postal").textContent = info.postal || "—";
      $("loc-timezone").textContent = info.timezone || "—";
      $("loc-latlon").textContent =
        info.latitude && info.longitude
          ? `${info.latitude.toFixed(3)}, ${info.longitude.toFixed(3)}`
          : "—";
      $("net-isp").textContent = info.org || info.org_name || "—";
      $("net-org").textContent = info.asn ? info.asn : (info.network || "—");
      $("net-asn").textContent = info.asn || "—";
    }
    // Cloudflare-only fields
    $("net-colo").textContent = record.colo || "—";
    $("net-http").textContent = record.http || "—";
    $("net-tls").textContent = record.tls || "—";
    if (!hasEnrich) {
      // still show CF network block by revealing the grid but hiding location
      grid.hidden = false;
    }
  };

  const renderHistory = () => {
    const list = $("history-list");
    const empty = $("history-empty");
    // Remove old items but keep empty state
    list.querySelectorAll(".hist-item").forEach((n) => n.remove());

    if (history.length === 0) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      history.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = `hist-item${item.is_duplicate ? " repeat" : ""}`;
        div.style.animationDelay = `${Math.min(idx, 5) * 30}ms`;
        div.innerHTML = `
          <div class="hist-top">
            <span class="hist-dot ${item.is_duplicate ? "repeat" : "new"}"></span>
            <span class="hist-badge">${item.is_duplicate ? "Repeat" : "New"}</span>
            <span class="hist-index">#${String(item.check_count).padStart(3, "0")}</span>
          </div>
          <div class="hist-ip${item.is_duplicate ? " repeat" : ""}">${item.ip}</div>
          <div class="hist-time">
            <span>${formatTime(item.timestamp)}</span>
            <span class="sep">·</span>
            <span>${relTime(item.timestamp)}</span>
          </div>
        `;
        list.appendChild(div);
      });
    }

    // Header stats
    $("total-checks").textContent = String(history.length).padStart(3, "0");
    const uniques = new Set(history.map((h) => h.ip)).size;
    $("unique-ips").textContent = String(uniques).padStart(3, "0");
    $("history-count").textContent = String(history.length).padStart(3, "0");

    // Clear button state
    $("clear-btn").disabled = history.length === 0;
  };

  // ---------------- Main check ----------------
  let isChecking = false;
  const runCheck = async () => {
    if (isChecking) return;
    isChecking = true;
    setStatus("loading");
    const btn = $("check-btn");
    btn.disabled = true;
    $("refresh-icon").classList.add("refresh-spin");
    $("check-btn-text").textContent = "Detecting";

    try {
      const info = await detectCurrentIP();
      if (!info.ip) throw new Error("IP not detected");

      // Compute duplicate stats from local history
      const previous = history.filter((h) => h.ip === info.ip);
      const isDuplicate = previous.length > 0;
      const firstSeen = isDuplicate
        ? previous[previous.length - 1].timestamp // history is newest-first, so last is oldest
        : new Date().toISOString();

      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ip: info.ip,
        timestamp: new Date().toISOString(),
        is_duplicate: isDuplicate,
        check_count: previous.length + 1,
        first_seen: firstSeen,
        colo: info.colo,
        http: info.http,
        tls: info.tls,
        enrich: info.enrich,
      };

      // Prepend and cap
      history.unshift(record);
      if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
      saveHistory(history);

      renderIP(record);
      renderHistory();
      setStatus(isDuplicate ? "duplicate" : "fresh");

      if (isDuplicate) {
        showToast({
          type: "warn",
          title: "Duplicate IP detected",
          description: `IP ${info.ip} sudah pernah dicek (${record.check_count}× total).`,
          duration: 4500,
        });
      } else {
        showToast({
          type: "success",
          title: "New IP recorded",
          description: `IP ${info.ip} disimpan ke riwayat lokal.`,
          duration: 2500,
        });
      }
    } catch (err) {
      console.error(err);
      showToast({
        type: "error",
        title: "Gagal mendeteksi IP",
        description: err.message || "Cek koneksi kamu lalu coba lagi.",
        duration: 4000,
      });
      setStatus("idle");
    } finally {
      isChecking = false;
      btn.disabled = false;
      $("refresh-icon").classList.remove("refresh-spin");
      $("check-btn-text").textContent = "Re-check IP";
    }
  };

  // ---------------- Copy IP ----------------
  const copyIP = async () => {
    const text = $("ip-display").textContent.trim();
    if (!text || text.startsWith("---")) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast({
        type: "success",
        title: "Copied",
        description: text,
        duration: 1500,
      });
    } catch {
      showToast({ type: "error", title: "Copy gagal" });
    }
  };

  // ---------------- Clear history (with confirm) ----------------
  const openDialog = () => {
    if (history.length === 0) return;
    $("dialog-overlay").hidden = false;
  };
  const closeDialog = () => {
    $("dialog-overlay").hidden = true;
  };
  const confirmClear = () => {
    history = [];
    saveHistory(history);
    // Reset current
    $("ip-display").hidden = true;
    $("ip-skeleton").hidden = false;
    $("dup-banner").hidden = true;
    $("info-grid").hidden = true;
    $("check-index").textContent = "#---";
    $("checked-at").textContent = "—";
    $("check-status").textContent = "—";
    setStatus("idle");
    renderHistory();
    closeDialog();
    showToast({
      type: "success",
      title: "History cleared",
      description: "Semua riwayat IP telah dihapus dari browser.",
      duration: 2500,
    });
  };

  // ---------------- Wire up ----------------
  document.addEventListener("DOMContentLoaded", () => {
    renderHistory();
    // Show cached last check if any
    if (history[0]) {
      renderIP(history[0]);
      setStatus(history[0].is_duplicate ? "duplicate" : "fresh");
    }
    // Then always run a fresh check
    runCheck();

    $("check-btn").addEventListener("click", runCheck);
    $("copy-btn").addEventListener("click", copyIP);
    $("clear-btn").addEventListener("click", openDialog);
    $("dialog-cancel").addEventListener("click", closeDialog);
    $("dialog-confirm").addEventListener("click", confirmClear);
    $("dialog-overlay").addEventListener("click", (e) => {
      if (e.target.id === "dialog-overlay") closeDialog();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("dialog-overlay").hidden) closeDialog();
    });
  });
})();
