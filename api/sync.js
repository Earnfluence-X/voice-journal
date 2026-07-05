// api/sync.js - Serverless API endpoint for Vercel

// In-memory storage (resets on server restart - use a database in production)
// For production, replace with MongoDB, PostgreSQL, or Vercel KV
const userData = {};

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { action, username, password, notes, stickies, color } = req.body;

        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password required' 
            });
        }

        // Hash password (simple - use bcrypt in production)
        const hashedPassword = hashPassword(password);

        switch (action) {
            case 'signup':
                // Check if user already exists
                if (userData[username]) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Username already taken' 
                    });
                }

                // Create new user
                userData[username] = {
                    password: hashedPassword,
                    color: color || '#6C63FF',
                    notes: [],
                    stickies: [],
                    createdAt: new Date().toISOString()
                };

                return res.status(200).json({
                    success: true,
                    message: 'Account created successfully',
                    data: { color: userData[username].color }
                });

            case 'login':
                // Check if user exists
                if (!userData[username]) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                // Verify password
                if (userData[username].password !== hashedPassword) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Login successful',
                    data: { color: userData[username].color }
                });

            case 'sync':
                // Verify user exists
                if (!userData[username] || userData[username].password !== hashedPassword) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Authentication failed' 
                    });
                }

                // Update user data
                if (notes !== undefined) userData[username].notes = notes;
                if (stickies !== undefined) userData[username].stickies = stickies;
                if (color !== undefined) userData[username].color = color;
                userData[username].lastSync = new Date().toISOString();

                return res.status(200).json({
                    success: true,
                    message: 'Synced successfully',
                    data: {
                        notes: userData[username].notes,
                        stickies: userData[username].stickies,
                        color: userData[username].color
                    }
                });

            case 'load':
                // Verify user exists
                if (!userData[username] || userData[username].password !== hashedPassword) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Authentication failed' 
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Data loaded successfully',
                    data: {
                        notes: userData[username].notes || [],
                        stickies: userData[username].stickies || [],
                        color: userData[username].color || '#6C63FF'
                    }
                });

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

// Simple password hashing (use bcrypt in production)
function hashPassword(password) {
    // This is a simple hash - use bcrypt for production
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return 'hash_' + Math.abs(hash).toString(36);
}