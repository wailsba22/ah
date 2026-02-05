document.addEventListener('DOMContentLoaded', function() {
    loadStoredData();
    setupViewButtons();
    setupFetchButton();
    loadItemMap();
    updateDisplay(); // Load any cached data
});
window.nameToId = {};

function setupViewButtons() {
    document.getElementById('showAuctions').addEventListener('click', () => switchView('auctions'));
    document.getElementById('showBids').addEventListener('click', () => switchView('bids'));
    // updateDisplay() is now called at the end of DOMContentLoaded
}

function setupFetchButton() {
    document.getElementById('fetchBtn').addEventListener('click', fetchAuctions);
}

function switchView(view) {
    const btnAuctions = document.getElementById('showAuctions');
    const btnBids = document.getElementById('showBids');

    if (view === 'auctions') {
        if (btnAuctions.classList.contains('active')) {
            // Deactivate and show all
            btnAuctions.classList.remove('active');
            btnBids.classList.remove('active');
        } else {
            // Activate auctions
            btnAuctions.classList.add('active');
            btnBids.classList.remove('active');
        }
    } else {
        if (btnBids.classList.contains('active')) {
            // Deactivate and show all
            btnAuctions.classList.remove('active');
            btnBids.classList.remove('active');
        } else {
            // Activate BINs
            btnAuctions.classList.remove('active');
            btnBids.classList.add('active');
        }
    }
    updateDisplay();
}

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

async function loadItemMap() {
    if (window.itemNameIndex && window.nameToId && Object.keys(window.nameToId).length > 0) {
        return;
    }

    const normalizeKey = window.normalizeItemKey || ((name) =>
        String(name || '')
            .toLowerCase()
            .replace(/\u00a7./g, '')
            .replace(/[^a-z0-9]+/g, '')
    );

    try {
        const response = await fetch('https://api.hypixel.net/resources/skyblock/items');
        const data = await response.json();
        if (!data.success || !Array.isArray(data.items)) {
            throw new Error('Invalid item list response');
        }

        window.nameToId = {};
        window.itemNameIndex = {};
        data.items.forEach(item => {
            if (!item || !item.name || !item.id) return;
            window.nameToId[item.name] = item.id;
            const key = normalizeKey(item.name);
            if (key) {
                window.itemNameIndex[key] = item.id;
            }
        });
        window.itemNameIndexKeys = Object.keys(window.itemNameIndex);
    } catch (e) {
        console.error('Failed to load item list', e);
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

    localStorage.setItem('hypixelUsername', username);
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
        console.error('Cache parse error:', e);
    }

    try {
        let uuid = localStorage.getItem(`uuid_${username}`);
        
        if (!uuid) {
            console.log('Fetching UUID for:', username);
            const playerResponse = await fetch(`https://api.hypixel.net/player?key=${apiKey}&name=${username}`);
            
            if (!playerResponse.ok) {
            if (playerResponse.status === 429) {
                throw new Error('API rate limit exceeded. Please wait a moment and try again.');
            }
            }
            
            const playerData = await playerResponse.json();
            console.log('Player response:', playerData);

            if (!playerData.success) {
                throw new Error(playerData.cause || 'API request failed');
            }
            
            if (!playerData.player) {
                throw new Error(`Player "${username}" not found. Check the username is correct and has a Hypixel profile.`);
            }
            
            if (!playerData.player.uuid) {
                throw new Error('UUID not found in player data');
            }

            uuid = playerData.player.uuid;
            localStorage.setItem(`uuid_${username}`, uuid);
        }

        console.log('Fetching auctions for UUID:', uuid);
        const auctionsResponse = await fetch(`https://api.hypixel.net/skyblock/auction?key=${apiKey}&player=${uuid}`);
        
        if (!auctionsResponse.ok) {
            if (auctionsResponse.status === 429) {
                throw new Error('API rate limit exceeded. Please wait a moment and try again.');
            }
            throw new Error(`HTTP Error: ${auctionsResponse.status} - ${auctionsResponse.statusText}`);
        }

        const auctionsData = await auctionsResponse.json();
        console.log('Auctions response:', auctionsData);

        if (!auctionsData.success) {
            throw new Error(auctionsData.cause || 'Failed to fetch auctions');
        }

        if (!Array.isArray(auctionsData.auctions)) {
            throw new Error('Invalid auctions data format');
        }

        const auctions = auctionsData.auctions;
        const now = Date.now();

        const activeAuctions = [];
        const activeBINs = [];
        const soldAuctions = [];
        const soldBINs = [];

        auctions.forEach(auction => {
            const endTime = auction.end;
            const isActive = endTime > now;
            const hasBids = auction.bids && auction.bids.length > 0;
            const isBin = auction.bin;

            if (isActive) {
                if (isBin) {
                    activeBINs.push(auction);
                } else {
                    activeAuctions.push(auction);
                }
            } else if (hasBids) {
                if (isBin) {
                    soldBINs.push(auction);
                } else {
                    soldAuctions.push(auction);
                }
            }
        });

        activeAuctions.sort((a, b) => a.end - b.end);
        activeBINs.sort((a, b) => a.end - b.end);
        soldAuctions.sort((a, b) => a.end - b.end);
        soldBINs.sort((a, b) => a.end - b.end);

        const activeCount = activeAuctions.length + activeBINs.length;
        const soldCount = soldAuctions.length + soldBINs.length;
        const totalSoldValue = [...soldAuctions, ...soldBINs].reduce((sum, auction) => sum + (auction.highest_bid_amount || 0), 0);

        const data = { activeAuctions, activeBINs, soldAuctions, soldBINs, activeCount, soldCount, totalSoldValue };

        localStorage.setItem(`auctions_${username}`, JSON.stringify(data));

        const allSold = [...soldAuctions, ...soldBINs];
        // updateSellHistory(allSold); // Removed - export functionality not needed

        // Only fetch buyer names if we don't have many (to avoid rate limiting)
        // Most buyer names will be looked up on-demand when displayed
        const buyerUUIDs = [...new Set(allSold.map(a => a.bids && a.bids.length > 0 ? a.bids.reduce((prev, current) => (prev.amount > current.amount) ? prev : current).bidder : null).filter(Boolean))];
        
        // Pre-cache a few buyer names if not already cached
        for (const bid_uuid of buyerUUIDs.slice(0, 2)) {
            const cachedName = localStorage.getItem(`name_${bid_uuid}`);
            if (!cachedName) {
                try {
                    const nameResponse = await fetch(`https://api.hypixel.net/player?key=${apiKey}&uuid=${bid_uuid}`);
                    if (nameResponse.ok) {
                        const nameData = await nameResponse.json();
                        if (nameData.success && nameData.player) {
                            const name = nameData.player.displayname;
                            localStorage.setItem(`name_${bid_uuid}`, name);
                        }
                    }
                    // Small delay to avoid rate limiting
                    await new Promise(r => setTimeout(r, 500));
                } catch (e) {
                    console.error('Error fetching buyer name:', e);
                }
            }
        }

        await loadItemMap();

        document.getElementById('stats').style.display = 'block';
        document.getElementById('activeCount').textContent = `Active: ${activeCount}`;
        document.getElementById('soldCount').textContent = `Sold: ${soldCount}`;
        document.getElementById('totalSoldValue').textContent = `Total Sold: ${formatCoins(totalSoldValue)} coins`;
        document.getElementById('viewing').textContent = `Viewing: ${isViewingOwn ? 'Your Auctions' : username + "'s Auctions"}`;
        document.getElementById('backBtn').style.display = isViewingOwn ? 'none' : 'block';

        updateDisplay();

    } catch (error) {
        console.error('Fetch error:', error);
        
        if (cachedData && cachedData.activeAuctions) {
            showError(`⚠️ Using cached data: ${error.message}`);
            localStorage.setItem(`auctions_${username}`, JSON.stringify(cachedData));
            
            document.getElementById('stats').style.display = 'block';
            document.getElementById('activeCount').textContent = `Active: ${cachedData.activeCount}`;
            document.getElementById('soldCount').textContent = `Sold: ${cachedData.soldCount}`;
            document.getElementById('totalSoldValue').textContent = `Total Sold: ${formatCoins(cachedData.totalSoldValue)} coins`;
            document.getElementById('viewing').textContent = `Viewing: ${username}'s Auctions (Cached)`;
            
            updateDisplay();
        } else {
            showError(`❌ Error: ${error.message}`);
        }
    } finally {
        loading.style.display = 'none';
    }
}

function updateDisplay() {
    const activeDiv = document.getElementById('activeAuctions');
    const soldDiv = document.getElementById('soldAuctions');
    const activeH2 = document.querySelector('h2:nth-of-type(1)');
    const soldH2 = document.querySelector('h2:nth-of-type(2)');
    
    // Try to get username from input field, or fall back to stored username
    let username = document.getElementById('username').value.trim();
    if (!username) {
        username = localStorage.getItem('hypixelUsername');
    }
    
    const data = JSON.parse(localStorage.getItem(`auctions_${username}`) || '{}');

    if (!data.activeAuctions) {
        // Clear displays if no data
        activeDiv.innerHTML = '';
        soldDiv.innerHTML = '';
        activeH2.textContent = 'Active Auctions';
        soldH2.textContent = 'Sold Auctions';
        return;
    }

    const { activeAuctions, activeBINs, soldAuctions, soldBINs } = data;

    // Determine what to show based on active button
    const showAuctions = document.getElementById('showAuctions').classList.contains('active');
    const showBids = document.getElementById('showBids').classList.contains('active');

    if (showAuctions) {
        // Show auctions: active and sold non-BIN
        activeH2.textContent = 'Active Auctions';
        soldH2.textContent = 'Sold Auctions';
        displayAuctions(activeAuctions, activeDiv, 'active', 'auctions');
        displayAuctions(soldAuctions, soldDiv, 'sold', 'auctions');
    } else if (showBids) {
        // Show BINs: active and sold BIN
        activeH2.textContent = 'Active BINs';
        soldH2.textContent = 'Sold BINs';
        displayAuctions(activeBINs, activeDiv, 'active', 'BINs');
        displayAuctions(soldBINs, soldDiv, 'sold', 'BINs');
    } else {
        // Default: show all together
        activeH2.textContent = 'Active Auctions & BINs';
        soldH2.textContent = 'Sold Auctions & BINs';
        const allActive = [...activeAuctions, ...activeBINs].sort((a, b) => a.end - b.end);
        const allSold = [...soldAuctions, ...soldBINs].sort((a, b) => a.end - b.end);
        displayAuctions(allActive, activeDiv, 'active', 'auctions & BINs');
        displayAuctions(allSold, soldDiv, 'sold', 'auctions & BINs');
    }
}

function displayAuctions(auctions, container, type, itemType) {
    if (auctions.length === 0) {
        container.innerHTML = '';
        return;
    }

    // Clear container
    container.innerHTML = '';

    auctions.forEach(auction => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'auction-item';

        const itemName = (auction.item_name || 'Unknown Item').replace(/§./g, '');
        const tier = auction.tier || 'UNKNOWN';
        const tierClass = `tier-${tier.toLowerCase()}`;
        const startingBid = auction.starting_bid || 0;
        const highestBid = auction.highest_bid_amount || 0;
        const endTime = new Date(auction.end).toLocaleString();
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
            let buyerName = localStorage.getItem(`name_${buyerUUID}`);
            
            // If name not cached, show UUID but try to fetch it
            if (!buyerName) {
                buyerName = buyerUUID;
                // Try to fetch name in background (don't await to avoid blocking display)
                fetch(`https://api.hypixel.net/player?key=7898a675-6bb0-4ea4-828f-6c6d076cc692&uuid=${buyerUUID}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.player) {
                        const displayName = data.player.displayname;
                        localStorage.setItem(`name_${buyerUUID}`, displayName);
                        // Update the display if this element is still visible
                        const buyerElement = document.querySelector(`[data-buyer-uuid="${buyerUUID}"]`);
                        if (buyerElement) {
                            buyerElement.textContent = `Buyer: ${displayName}`;
                        }
                    }
                })
                .catch(e => console.error('Error fetching buyer name:', e));
            }
            
            buyerInfo = `<p class="buyer" data-buyer-uuid="${buyerUUID}" onclick="searchBuyer('${buyerUUID}')">Buyer: ${buyerName}</p>`;
        }

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

        // Create the item texture element (static, no animation)
        const itemId = auction.item_id || auction.itemId || null;
        const itemTexture = window.getStaticItemTexture(itemName, 50, itemId);
        itemTexture.style.marginRight = '10px';

        // Create the content container
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = `
            <span class="buy-sell-badge ${isBin ? 'buy' : 'sell'}">Sell</span>
            <h3>${itemName} ${binBadge}</h3>
            <p class="tier ${tierClass}">${tier}</p>
            ${priceInfo}
            ${buyerInfo}
            <p class="time">Date: ${endTime}</p>
        `;

        // Add texture and content to item div
        itemDiv.appendChild(itemTexture);
        itemDiv.appendChild(contentDiv);

        container.appendChild(itemDiv);
    });
}

function formatCoins(amount) {
    return amount.toLocaleString();
}

function showError(message) {
    document.getElementById('error').textContent = message;
    document.getElementById('error').style.display = 'block';
}

function goBack() {
    const originalUsername = localStorage.getItem('originalUsername');
    if (originalUsername) {
        document.getElementById('username').value = originalUsername;
        fetchAuctions();
    }
}

function searchBuyer(uuid) {
    const name = localStorage.getItem(`name_${uuid}`);
    if (name) {
        document.getElementById('username').value = name;
        fetchAuctions();
    } else {
        // Fetch name from uuid
        fetch(`https://api.hypixel.net/player?key=7898a675-6bb0-4ea4-828f-6c6d076cc692&uuid=${uuid}`)
        .then(response => {
            if (response.status === 429) {
                throw new Error('API rate limit exceeded. Try again in a moment.');
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.player) {
                const displayName = data.player.displayname;
                localStorage.setItem(`name_${uuid}`, displayName);
                document.getElementById('username').value = displayName;
                fetchAuctions();
            } else {
                alert('Failed to get player name for UUID: ' + uuid);
            }
        })
        .catch(error => {
            alert('Error: ' + error.message);
        });
    }
}

