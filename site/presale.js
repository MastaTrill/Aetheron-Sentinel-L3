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
      buyBtn.onclick = function (e) {
        e.preventDefault();
        alert('Base presale ended 2026-08-01. Soft cap missed (0.0049 / 5 ETH). Do not send ETH.');
      };
    }
    const connectBtn = document.getElementById('presaleConnectBtn');
    if (connectBtn) {
      connectBtn.textContent = 'Sale closed';
      connectBtn.onclick = function (e) {
        e.preventDefault();
      };
    }
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
    const marketStatusEl = document.getElementById('marketStatusNotice');
    if (marketStatusEl) {
      marketStatusEl.innerHTML =
        '<span style="color:#f6ad55;">Presale ended · soft cap missed · no canonical pool</span>';
    }
    const statusMsg = document.getElementById('presaleStatusMsg');
    if (statusMsg) {
      statusMsg.textContent =
        'Refunds: claimRefund() on 0xe0A3B6368312dFd3E7E76202e673f895f8235A3d';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paintClosed);
  } else {
    paintClosed();
  }
})();
