document.addEventListener('DOMContentLoaded', loadStoredData);
document.getElementById('fetchBtn').addEventListener('click', fetchAuctions);

function loadStoredData() {
    const username = localStorage.getItem('hypixelUsername');
    const originalUsername = localStorage.getItem('originalUsername') || username;
    if (username) {
        document.getElementById('username').value = username;
    }
    if (originalUsername) {
        localStorage.setItem('originalUsername', originalUsername);
    }
}

async function fetchAuctions() {
    const apiKey = '7898a675-6bb0-4ea4-828f-6c6d076cc692';
    const username = document.getElementById('username').value.trim();
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const activeDiv = document.getElementById('activeAuctions');
    const soldDiv = document.getElementById('soldAuctions');

    if (!username) {
        showError('Please enter your username.');
        return;
    }

    // Save username to localStorage
    localStorage.setItem('hypixelUsername', username);

    // Check if viewing own or other's
    const originalUsername = localStorage.getItem('originalUsername');
    const isViewingOwn = !originalUsername || username === originalUsername;
    if (!originalUsername) {
        localStorage.setItem('originalUsername', username);
    }

    loading.style.display = 'block';
    errorDiv.style.display = 'none';
    activeDiv.innerHTML = '';
    soldDiv.innerHTML = '';

    let cachedData = null;
    try {
        cachedData = JSON.parse(localStorage.getItem(`auctions_${username}`) || 'null');
    } catch (e) {
        // Ignore
    }

    try {
        // Check cache for UUID
        let uuid = localStorage.getItem(`uuid_${username}`);
        if (!uuid) {
            // Get UUID from username
            const playerResponse = await fetch(`https://api.hypixel.net/player?key=${apiKey}&name=${username}`);
            const playerData = await playerResponse.json();

            if (!playerData.success) {
                throw new Error(playerData.cause || 'Failed to get player data');
            }

            uuid = playerData.player.uuid;
            // Cache UUID permanently
            localStorage.setItem(`uuid_${username}`, uuid);
        }

        // Always get fresh auctions
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

        // Sort active by end time ascending (ending soonest first)
        active.sort((a, b) => a.end - b.end);

        // Sort sold by end time ascending (oldest first)
        sold.sort((a, b) => a.end - b.end);

        // Calculate stats
        const activeCount = active.length;
        const soldCount = sold.length;
        const totalSoldValue = sold.reduce((sum, auction) => sum + (auction.highest_bid_amount || 0), 0);

        const data = { active, sold, activeCount, soldCount, totalSoldValue };

        // Save to localStorage
        localStorage.setItem(`auctions_${username}`, JSON.stringify(data));

        // Get buyer names
        const buyerUUIDs = [...new Set(sold.map(a => a.bids && a.bids.length > 0 ? a.bids.reduce((prev, current) => (prev.amount > current.amount) ? prev : current).bidder : null).filter(Boolean))];
        const buyerNames = {};
        for (const uuid of buyerUUIDs) {
            const cachedName = localStorage.getItem(`name_${uuid}`);
            if (cachedName) {
                buyerNames[uuid] = cachedName;
            } else {
                try {
                    const nameResponse = await fetch(`https://api.hypixel.net/player?key=${apiKey}&uuid=${uuid}`);
                    const nameData = await nameResponse.json();
                    if (nameData.success) {
                        const name = nameData.player.displayname;
                        buyerNames[uuid] = name;
                        localStorage.setItem(`name_${uuid}`, name);
                    } else {
                        buyerNames[uuid] = uuid; // Fallback
                    }
                } catch (e) {
                    buyerNames[uuid] = uuid; // Fallback
                }
            }
        }

        // Update stats
        document.getElementById('stats').style.display = 'block';
        document.getElementById('activeCount').textContent = `Active: ${activeCount}`;
        document.getElementById('soldCount').textContent = `Sold: ${soldCount}`;
        document.getElementById('totalSoldValue').textContent = `Total Sold: ${formatCoins(totalSoldValue)} coins`;
        document.getElementById('viewing').textContent = `Viewing: ${isViewingOwn ? 'Your Auctions' : username + "'s Auctions"}`;
        document.getElementById('backBtn').style.display = isViewingOwn ? 'none' : 'block';

        // Pass buyerNames to display
        displayAuctions(active, activeDiv, 'active', {});
        displayAuctions(sold, soldDiv, 'sold', buyerNames);

    } catch (error) {
        // If fetch fails and we have cached data, show it
        if (cachedData) {
            showError(`Failed to fetch fresh data: ${error.message}. Showing cached data.`);
            displayCachedData(cachedData);
        } else {
            showError(error.message);
        }
    } finally {
        loading.style.display = 'none';
    }
}

function displayCachedData(data) {
    const { active, sold, activeCount, soldCount, totalSoldValue } = data;
    const username = document.getElementById('username').value.trim();
    const originalUsername = localStorage.getItem('originalUsername');
    const isViewingOwn = !originalUsername || username === originalUsername;

    document.getElementById('stats').style.display = 'block';
    document.getElementById('activeCount').textContent = `Active: ${activeCount}`;
    document.getElementById('soldCount').textContent = `Sold: ${soldCount}`;
    document.getElementById('totalSoldValue').textContent = `Total Sold: ${formatCoins(totalSoldValue)} coins`;
    document.getElementById('viewing').textContent = `Viewing: ${isViewingOwn ? 'Your Auctions' : username + "'s Auctions"}`;
    document.getElementById('backBtn').style.display = isViewingOwn ? 'none' : 'block';

    displayAuctions(active, document.getElementById('activeAuctions'), 'active');
    displayAuctions(sold, document.getElementById('soldAuctions'), 'sold');
}

function displayAuctions(auctions, container, type, buyerNames = {}) {
    if (auctions.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: white; font-size: 18px;">No ${type} auctions found.</p>`;
        return;
    }

    auctions.forEach(auction => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'auction-item';

        const itemName = auction.item_name || 'Unknown Item';
        const tier = auction.tier || 'UNKNOWN';
        const tierClass = `tier-${tier.toLowerCase()}`;
        const startingBid = auction.starting_bid || 0;
        const highestBid = auction.highest_bid_amount || 0;
        const endTime = new Date(auction.end).toLocaleString();
        const category = auction.category || 'UNKNOWN';
        const isBin = auction.bin;

        let binBadge = '';
        if (isBin) {
            binBadge = '<span class="bin-badge">BIN</span>';
        }

        let buyerInfo = '';
        if (type === 'sold' && auction.bids && auction.bids.length > 0) {
            // Find the highest bidder
            const highestBidObj = auction.bids.reduce((prev, current) => (prev.amount > current.amount) ? prev : current);
            const buyerUUID = highestBidObj.bidder;
            const buyerName = buyerNames[buyerUUID] || buyerUUID;
            buyerInfo = `<p class="buyer" onclick="searchBuyer('${buyerName}')">Buyer: ${buyerName}</p>`;
        }

        itemDiv.innerHTML = `
            <h3>${itemName} ${binBadge}</h3>
            <p class="tier ${tierClass}">Rarity: ${tier}</p>
            <p class="category">Category: ${category}</p>
        let priceInfo = '';
        if (type === 'active') {
            if (isBin) {
                priceInfo = `<p class="price">BIN Price: ${formatCoins(startingBid)} coins</p>`;
            } else {
                priceInfo = `<p class="price">Starting Bid: ${formatCoins(startingBid)} coins</p>
                             <p class="price">Current Bid: ${formatCoins(highestBid)} coins</p>`;
            }
        } else {
            priceInfo = `<p class="price">Sold Price: ${formatCoins(highestBid)} coins</p>`;
        }
            ${buyerInfo}
            <p class="time">Date: ${endTime}</p>
        `;

        container.appendChild(itemDiv);
    });
}

function formatCoins(amount) {
    return amount.toLocaleString();
}

function goBack() {
    const originalUsername = localStorage.getItem('originalUsername');
    if (originalUsername) {
        document.getElementById('username').value = originalUsername;
        fetchAuctions();
    }
}