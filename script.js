document.addEventListener('DOMContentLoaded', loadStoredData);
document.getElementById('fetchBtn').addEventListener('click', fetchAuctions);

function loadStoredData() {
    const apiKey = localStorage.getItem('hypixelApiKey');
    const username = localStorage.getItem('hypixelUsername');
    if (apiKey) {
        document.getElementById('apiKey').value = apiKey;
    }
    if (username) {
        document.getElementById('username').value = username;
    }
}

async function fetchAuctions() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const username = document.getElementById('username').value.trim();
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const activeDiv = document.getElementById('activeAuctions');
    const soldDiv = document.getElementById('soldAuctions');

    if (!apiKey || !username) {
        showError('Please enter both API key and username.');
        return;
    }

    // Save to localStorage
    localStorage.setItem('hypixelApiKey', apiKey);
    localStorage.setItem('hypixelUsername', username);

    loading.style.display = 'block';
    errorDiv.style.display = 'none';
    activeDiv.innerHTML = '';
    soldDiv.innerHTML = '';

    try {
        // Get UUID from username
        const playerResponse = await fetch(`https://api.hypixel.net/player?key=${apiKey}&name=${username}`);
        const playerData = await playerResponse.json();

        if (!playerData.success) {
            throw new Error(playerData.cause || 'Failed to get player data');
        }

        const uuid = playerData.player.uuid;

        // Get auctions
        const auctionsResponse = await fetch(`https://api.hypixel.net/skyblock/auction?key=${apiKey}&player=${uuid}`);
        const auctionsData = await auctionsResponse.json();

        if (!auctionsData.success) {
            throw new Error(auctionsData.cause || 'Failed to get auctions data');
        }

        const auctions = auctionsData.auctions;
        const now = Date.now();

        const active = [];
        const sold = [];

        auctions.forEach(auction => {
            const endTime = auction.end;
            const isActive = endTime > now;
            const hasBids = auction.bids && auction.bids.length > 0;

            if (isActive) {
                active.push(auction);
            } else if (hasBids) {
                sold.push(auction);
            }
        });

        displayAuctions(active, activeDiv, 'active');
        displayAuctions(sold, soldDiv, 'sold');

    } catch (error) {
        showError(error.message);
    } finally {
        loading.style.display = 'none';
    }
}

function displayAuctions(auctions, container, type) {
    if (auctions.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: white; font-size: 18px;">No ${type} auctions found.</p>`;
        return;
    }

    auctions.forEach(auction => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'auction-item';

        const itemName = auction.item_name || 'Unknown Item';
        const tier = auction.tier || 'UNKNOWN';
        const startingBid = auction.starting_bid || 0;
        const highestBid = auction.highest_bid_amount || 0;
        const endTime = new Date(auction.end).toLocaleString();
        const category = auction.category || 'UNKNOWN';
        const isBin = auction.bin;

        let binBadge = '';
        if (isBin) {
            binBadge = '<span class="bin-badge">BIN</span>';
        }

        itemDiv.innerHTML = `
            <h3>${itemName} ${binBadge}</h3>
            <p class="tier">Tier: ${tier}</p>
            <p class="category">Category: ${category}</p>
            <p class="price">Starting Bid: ${formatCoins(startingBid)} coins</p>
            <p class="price">Highest Bid: ${formatCoins(highestBid)} coins</p>
            <p class="time">Ends: ${endTime}</p>
        `;

        container.appendChild(itemDiv);
    });
}

function formatCoins(amount) {
    return amount.toLocaleString();
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}