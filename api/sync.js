// api/sync.js - Simplified in-memory storage (no JSONBin required)

// In-memory storage (data resets when server restarts)
const MEMORY_STORAGE = { users: {} };

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

        const hashedPassword = hashPassword(password);

        switch (action) {
            case 'signup': {
                if (MEMORY_STORAGE.users[username]) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Username already taken' 
                    });
                }

                MEMORY_STORAGE.users[username] = {
                    password: hashedPassword,
                    color: color || '#6C63FF',
                    notes: [],
                    stickies: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                return res.status(200).json({
                    success: true,
                    message: 'Account created successfully',
                    data: { color: color || '#6C63FF' }
                });
            }

            case 'login': {
                if (!MEMORY_STORAGE.users[username]) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                if (MEMORY_STORAGE.users[username].password !== hashedPassword) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Login successful',
                    data: { color: MEMORY_STORAGE.users[username].color }
                });
            }

            case 'sync': {
                if (!MEMORY_STORAGE.users[username]) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'User not found' 
                    });
                }

                if (MEMORY_STORAGE.users[username].password !== hashedPassword) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Authentication failed' 
                    });
                }

                if (notes !== undefined) MEMORY_STORAGE.users[username].notes = notes;
                if (stickies !== undefined) MEMORY_STORAGE.users[username].stickies = stickies;
                if (color !== undefined) MEMORY_STORAGE.users[username].color = color;
                MEMORY_STORAGE.users[username].updatedAt = new Date().toISOString();

                return res.status(200).json({
                    success: true,
                    message: 'Synced successfully',
                    data: {
                        notes: MEMORY_STORAGE.users[username].notes || [],
                        stickies: MEMORY_STORAGE.users[username].stickies || [],
                        color: MEMORY_STORAGE.users[username].color || '#6C63FF'
                    }
                });
            }

            case 'load': {
                if (!MEMORY_STORAGE.users[username]) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'User not found' 
                    });
                }

                if (MEMORY_STORAGE.users[username].password !== hashedPassword) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Authentication failed' 
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Data loaded successfully',
                    data: {
                        notes: MEMORY_STORAGE.users[username].notes || [],
                        stickies: MEMORY_STORAGE.users[username].stickies || [],
                        color: MEMORY_STORAGE.users[username].color || '#6C63FF'
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