// api/sync.js - Complete working version

const JSONBIN_ACCESS_KEY = process.env.JSONBIN_ACCESS_KEY;
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;

let cachedData = {};
let lastCacheUpdate = null;
const CACHE_TTL = 60000;

async function fetchBinData() {
    if (!JSONBIN_ACCESS_KEY || !JSONBIN_BIN_ID) {
        throw new Error('JSONBin API keys not configured');
    }

    if (cachedData && lastCacheUpdate && 
        (Date.now() - lastCacheUpdate) < CACHE_TTL) {
        return cachedData;
    }

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: {
                'X-Access-Key': JSONBIN_ACCESS_KEY
            }
        });

        if (response.status === 404) {
            // Bin doesn't exist, create it
            const createResponse = await fetch('https://api.jsonbin.io/v3/b', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': JSONBIN_ACCESS_KEY
                },
                body: JSON.stringify({
                    name: 'voice-journal-data',
                    data: { users: {} }
                })
            });
            
            if (!createResponse.ok) {
                throw new Error(`Failed to create bin: ${createResponse.status}`);
            }
            
            const result = await createResponse.json();
            console.log('Created new bin:', result.metadata?.id);
            return { users: {} };
        }

        if (!response.ok) {
            throw new Error(`JSONBin API error: ${response.status}`);
        }

        const result = await response.json();
        cachedData = result.record || { users: {} };
        lastCacheUpdate = Date.now();
        return cachedData;
    } catch (error) {
        console.error('Error fetching from JSONBin:', error);
        throw error;
    }
}

async function updateBinData(data) {
    if (!JSONBIN_ACCESS_KEY || !JSONBIN_BIN_ID) {
        throw new Error('JSONBin API keys not configured');
    }

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Key': JSONBIN_ACCESS_KEY
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`JSONBin API error: ${response.status}`);
        }

        cachedData = data;
        lastCacheUpdate = Date.now();
        return await response.json();
    } catch (error) {
        console.error('Error updating JSONBin:', error);
        throw error;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            message: 'Method not allowed' 
        });
    }

    try {
        const { action, username, password, notes, stickies, color } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password required' 
            });
        }

        let allUsers = { users: {} };
        try {
            const data = await fetchBinData();
            allUsers = data || { users: {} };
        } catch (error) {
            allUsers = { users: {} };
        }

        if (typeof allUsers !== 'object' || Array.isArray(allUsers)) {
            allUsers = { users: {} };
        }

        if (!allUsers.users) {
            allUsers.users = {};
        }

        const hashedPassword = hashPassword(password);

        switch (action) {
            case 'signup': {
                if (allUsers.users[username]) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Username already taken' 
                    });
                }

                allUsers.users[username] = {
                    password: hashedPassword,
                    color: color || '#6C63FF',
                    notes: [],
                    stickies: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await updateBinData(allUsers);

                return res.status(200).json({
                    success: true,
                    message: 'Account created successfully',
                    data: { color: color || '#6C63FF' }
                });
            }

            case 'login': {
                if (!allUsers.users[username]) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                if (allUsers.users[username].password !== hashedPassword) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Login successful',
                    data: { color: allUsers.users[username].color }
                });
            }

            case 'sync': {
                if (!allUsers.users[username]) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'User not found' 
                    });
                }

                if (allUsers.users[username].password !== hashedPassword) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Authentication failed' 
                    });
                }

                if (notes !== undefined) allUsers.users[username].notes = notes;
                if (stickies !== undefined) allUsers.users[username].stickies = stickies;
                if (color !== undefined) allUsers.users[username].color = color;
                allUsers.users[username].updatedAt = new Date().toISOString();

                await updateBinData(allUsers);

                return res.status(200).json({
                    success: true,
                    message: 'Synced successfully',
                    data: {
                        notes: allUsers.users[username].notes || [],
                        stickies: allUsers.users[username].stickies || [],
                        color: allUsers.users[username].color || '#6C63FF'
                    }
                });
            }

            case 'load': {
                if (!allUsers.users[username]) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'User not found' 
                    });
                }

                if (allUsers.users[username].password !== hashedPassword) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Authentication failed' 
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Data loaded successfully',
                    data: {
                        notes: allUsers.users[username].notes || [],
                        stickies: allUsers.users[username].stickies || [],
                        color: allUsers.users[username].color || '#6C63FF'
                    }
                });
            }

            default:
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid action' 
                });
        }

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
}

function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(36);
}