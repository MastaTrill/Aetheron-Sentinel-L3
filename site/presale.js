/**
 * Presale widget — closed 2026-09-19.
 * Do not send ETH. Soft cap missed. See SALE_STATUS.md.
 */
(function () {
  'use strict';

  function paintClosed() {
    const buyBtn = document.getElementById('presaleBuyBtn');
    if (buyBtn) {
      buyBtn.textContent = 'Purchases closed — do not send ETH';
      buyBtn.disabled = true;
      buyBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        alert('Base presale ended 2026-08-01. Soft cap missed (0.0049 / 5 ETH). Do not send ETH.');
        return false;
      };
    }
    const connectBtn = document.getElementById('presaleConnectBtn');
    if (connectBtn) {
      connectBtn.textContent = 'Sale closed';
      connectBtn.disabled = true;
      connectBtn.onclick = function (e) {
        e.preventDefault();
        return false;
      };
    }
    const pay = document.getElementById('presalePayInput');
    if (pay) {
      pay.disabled = true;
      pay.placeholder = 'purchases closed';
    }
    const recv = document.getElementById('presaleReceiveInput');
    if (recv) recv.value = '0';
    const raisedEl = document.getElementById('presaleRaisedDisplay');
    if (raisedEl) raisedEl.textContent = '0.0049 ETH / 5 ETH soft cap';
    const progressFill = document.getElementById('presaleProgressFill');
    if (progressFill) progressFill.style.width = '0.1%';
    const progressLabel = document.getElementById('presaleProgressLabel');
    if (progressLabel) progressLabel.textContent = 'Soft cap missed';
    const raisedVal = document.getElementById('raisedVal');
    if (raisedVal) raisedVal.textContent = '0.0049';
    const percentVal = document.getElementById('percentVal');
    if (percentVal) percentVal.textContent = 'soft cap missed';
    const particVal = document.getElementById('particVal');
    if (particVal) particVal.textContent = 'owner-only';
    const bar = document.getElementById('presaleProgressBar');
    if (bar) bar.style.width = '0.1%';
    const marketStatusEl = document.getElementById('marketStatusNotice');
    if (marketStatusEl) {
      marketStatusEl.innerHTML =
        '<span style="color:#f6ad55;">Presale ended · soft cap missed · no canonical pool</span>';
    }
    const price = document.getElementById('marketPrice');
    if (price) price.textContent = 'no public market';
    const liq = document.getElementById('marketLiquidity');
    if (liq) liq.textContent = 'none configured';
    const vol = document.getElementById('marketVolume');
    if (vol) vol.textContent = '0';
    const statusMsg = document.getElementById('presaleStatusMsg');
    if (statusMsg) {
      statusMsg.textContent =
        'Refunds: claimRefund() on 0xe0A3B6368312dFd3E7E76202e673f895f8235A3d';
    }
  }

  function start() {
    paintClosed();
    setInterval(paintClosed, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
