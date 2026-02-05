(function () {
    const basePath = 'images';

    function normalizeItemKey(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/\u00a7./g, '')
            .replace(/[^a-z0-9]+/g, '');
    }

    function slugify(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/\u00a7./g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function resolveItemId(cleanName, providedId) {
        if (providedId) return providedId;

        if (window.nameToId && window.nameToId[cleanName]) {
            return window.nameToId[cleanName];
        }

        const normalized = normalizeItemKey(cleanName);
        if (window.itemNameIndex && window.itemNameIndex[normalized]) {
            return window.itemNameIndex[normalized];
        }

        if (window.itemNameIndexKeys && window.itemNameIndexKeys.length > 0) {
            let bestKey = null;
            for (const key of window.itemNameIndexKeys) {
                if (!normalized.endsWith(key)) continue;
                if (!bestKey || key.length > bestKey.length) {
                    bestKey = key;
                }
            }
            if (bestKey) {
                return window.itemNameIndex[bestKey];
            }
        }

        return null;
    }

    function normalizePath(pathValue) {
        return String(pathValue || '').replace(/\\/g, '/');
    }

    function resolveIndexedPath(resolvedId, localKey) {
        if (!window.itemTextureIndex) {
            return null;
        }

        if (resolvedId && window.itemTextureIndex.byId && window.itemTextureIndex.byId[resolvedId]) {
            return normalizePath(window.itemTextureIndex.byId[resolvedId]);
        }

        if (localKey && window.itemTextureIndex.byName && window.itemTextureIndex.byName[localKey]) {
            return normalizePath(window.itemTextureIndex.byName[localKey]);
        }

        return null;
    }

    window.normalizeItemKey = normalizeItemKey;

    window.staticItemManager = {
        basePath,
        async getAllItems() {
            try {
                const response = await fetch('itemList.json');
                if (!response.ok) {
                    return [];
                }
                const data = await response.json();
                return Array.isArray(data) ? data : [];
            } catch (e) {
                return [];
            }
        }
    };

    function applyFallbacks(img, sources) {
        let index = 0;

        function tryNext() {
            if (index >= sources.length) {
                img.onerror = null;
                return;
            }
            img.src = sources[index];
            index += 1;
        }

        img.onerror = tryNext;
        tryNext();
    }

    window.getStaticItemTexture = function (itemName, size, itemId) {
        const cleanName = String(itemName || '').replace(/\u00a7./g, '').trim();
        const resolvedId = resolveItemId(cleanName, itemId);
        const localKey = resolvedId ? String(resolvedId).toLowerCase() : slugify(cleanName);
        const indexedPath = resolveIndexedPath(resolvedId, localKey);
        const remoteKey = resolvedId || String(cleanName || '').replace(/\s+/g, '_').toUpperCase();
        const apiSrc = `https://sky.shiiyu.moe/item/${remoteKey}`;

        const img = document.createElement('img');
        img.alt = cleanName;
        img.className = 'item-texture';
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;

        const localCandidates = [
            indexedPath,
            `${basePath}/${localKey}.png`,
            `item/accessories/${localKey}/${localKey}.png`,
            `item/equipment/${localKey}/${localKey}.png`,
            `item/other/${localKey}/${localKey}.png`,
            `item/tools/${localKey}/${localKey}.png`,
            `item/weapons/${localKey}/${localKey}.png`,
            apiSrc,
        ].filter(Boolean);

        applyFallbacks(img, localCandidates);
        return img;
    };
})();
