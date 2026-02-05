// history.js - Handles sell history accumulation and export

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);
});

function updateSellHistory(allSold) {
    const historyKey = 'sellHistory';
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const existingIds = new Set(history.map(h => h.uuid));
    const newSold = allSold.filter(a => !existingIds.has(a.uuid));
    history.push(...newSold);
    localStorage.setItem(historyKey, JSON.stringify(history));
}

function exportHistory() {
    const history = localStorage.getItem('sellHistory') || '[]';
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(history);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'sell_history.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}