// api/sync.js - With fallback in-memory storage

const JSONBIN_ACCESS_KEY = process.env.JSONBIN_ACCESS_KEY;
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;

// In-memory fallback (data resets on server restart)
const MEMORY_STORAGE = { users: {} };
let USE_JSONBIN = true;

async function fetchBinData() {
    // If JSONBin is not configured, use memory
    if (!JSONBIN_ACCESS_KEY || !JSONBIN_BIN_ID) {
        USE_JSONBIN = false;
        console.log('⚠️ Using in-memory storage (JSONBin not configured)');
        return MEMORY_STORAGE;
    }

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: { 'X-Access-Key': JSONBIN_ACCESS_KEY }
        });

        if (response.status === 404) {
            // Create bin if it doesn't exist
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
                USE_JSONBIN = false;
                console.log('⚠️ Falling back to in-memory storage');
                return MEMORY_STORAGE;
            }
            
            const result = await createResponse.json();
            console.log('✅ Created new bin:', result.metadata?.id);
            return { users: {} };
        }

        if (!response.ok) {
            USE_JSONBIN = false;
            console.log('⚠️ JSONBin error, using in-memory storage');
            return MEMORY_STORAGE;
        }

        const result = await response.json();
        USE_JSONBIN = true;
        return result.record || { users: {} };
    } catch (error) {
        console.error('JSONBin error:', error.message);
        USE_JSONBIN = false;
        return MEMORY_STORAGE;
    }
}

async function updateBinData(data) {
    // If using memory, just update memory
    if (!USE_JSONBIN) {
        Object.assign(MEMORY_STORAGE, data);
        return { success: true };
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

        return await response.json();
    } catch (error) {
        console.error('JSONBin update error:', error.message);
        USE_JSONBIN = false;
        Object.assign(MEMORY_STORAGE, data);
        return { success: true };
    }
}

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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
};

function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(36);
}