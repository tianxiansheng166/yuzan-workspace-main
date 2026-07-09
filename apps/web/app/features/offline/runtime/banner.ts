import { ensureOfflineGlobalStatus } from "./global-status";

const BANNER_ID = "yuzan-offline-banner";
const STYLE_ID = "yuzan-offline-banner-style";

function ensureBannerStyle(documentRef: Document) {
  if (documentRef.getElementById(STYLE_ID)) {
    return;
  }

  const style = documentRef.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${BANNER_ID} {
      position: fixed;
      inset: auto 1rem 1rem 1rem;
      z-index: 1200;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: min(100% - 2rem, 28rem);
      padding: 0.9rem 1rem;
      border: 1px solid rgba(78, 48, 27, 0.14);
      border-radius: 1rem;
      background: rgba(247, 242, 232, 0.96);
      color: #4e301b;
      box-shadow: 0 18px 40px rgba(27, 20, 14, 0.12);
      backdrop-filter: blur(12px);
      font: 500 0.95rem/1.5 ui-sans-serif, system-ui, sans-serif;
    }
    #${BANNER_ID}[hidden] {
      display: none;
    }
    #${BANNER_ID} strong {
      display: block;
      font-size: 0.92rem;
    }
    #${BANNER_ID} span {
      color: rgba(78, 48, 27, 0.78);
      font-size: 0.85rem;
    }
    #${BANNER_ID} .dot {
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 999px;
      background: #7c8d4d;
      flex: 0 0 auto;
    }
    #${BANNER_ID}[data-network="offline"] .dot {
      background: #b58b2a;
    }
    @media (max-width: 42rem) {
      #${BANNER_ID} {
        inset-inline: 0.75rem;
        inset-block-end: 0.75rem;
        width: auto;
      }
    }
  `;
  documentRef.head.appendChild(style);
}

function ensureBanner(documentRef: Document) {
  const existing = documentRef.getElementById(BANNER_ID);

  if (existing) {
    return existing;
  }

  const banner = documentRef.createElement("div");
  banner.id = BANNER_ID;
  banner.hidden = true;
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.innerHTML = `
    <span class="dot" aria-hidden="true"></span>
    <div>
      <strong>网络已断开，当前进入最小离线模式。</strong>
      <span>仅缓存应用壳与非敏感本地草稿，联网后将恢复实时内容。</span>
    </div>
  `;
  documentRef.body.appendChild(banner);
  return banner;
}

export function mountOfflineBanner(windowRef: Window, documentRef: Document) {
  ensureBannerStyle(documentRef);
  const banner = ensureBanner(documentRef);
  const status = ensureOfflineGlobalStatus(windowRef);

  const sync = () => {
    const network = windowRef.navigator.onLine ? "online" : "offline";
    status.network = network;
    banner.dataset.network = network;
    banner.hidden = network !== "offline";
  };

  sync();
  windowRef.addEventListener("online", sync);
  windowRef.addEventListener("offline", sync);

  return () => {
    windowRef.removeEventListener("online", sync);
    windowRef.removeEventListener("offline", sync);
  };
}
