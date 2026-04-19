--[[
    PandaAuthentication Client for Roblox
    Simple version that works reliably
]]

-- Print header
print('---------------------------------')
print('PandaAuth - Roblox Edition')
print('---------------------------------')

-- Enhanced validation function with username support
local function ValidateKey(key, hwid, service, username)
    -- Check if WebSocket exists at all
    if not WebSocket then
        print("[ERROR] WebSocket not supported")
        return false
    end
    
    -- Configuration
    local CONFIG = {
        SERVER_URL = "ws://localhost:6050", -- Use your actual WebSocket server URL
        TIMEOUT = 15,
        DEBUG = true,
        HEARTBEAT_INTERVAL = 25, -- seconds
        RECONNECT_ATTEMPTS = 3
    }
    
    -- Log function
    local function log(msg)
        if CONFIG.DEBUG then
            print("[PandaAuth] " .. msg)
        end
    end
    
    -- Generate session ID
    local sessionId = tostring(os.time() * 1000) .. "_" .. tostring(math.random(10000))
    
    -- Build URL with all required parameters
    local url = CONFIG.SERVER_URL .. 
                "/?serviceId=" .. (service or "pandadevkit") .. 
                "&hwid=" .. (hwid or "") .. 
                "&key=" .. (key or "") ..
                "&sessionId=" .. sessionId ..
                "&username=" .. (username or "Player")
    
    log("Connecting to: " .. url)
    
    -- Try to connect
    local success, ws = false, nil
    
    success = pcall(function()
        ws = WebSocket.connect(url)
    end)
    
    if not success or not ws then
        log("Failed to connect")
        return false
    end
    
    log("Connection established")
    
    -- Variables to track validation and connection state
    local validated = false
    local validationTimeout = false
    local heartbeatTimer = nil
    local reconnectAttempts = 0
    
    -- Function to send heartbeat
    local function sendHeartbeat()
        if ws then
            pcall(function()
                ws:Send('{"type":"heartbeat","timestamp":' .. os.time() * 1000 .. '}')
                log("Heartbeat sent")
            end)
        end
    end
    
    -- Start heartbeat timer
    local function startHeartbeat()
        -- Clear any existing timer
        if heartbeatTimer then
            pcall(function() 
                heartbeatTimer:Disconnect() 
            end)
        end
        
        -- Start new timer
        heartbeatTimer = task.spawn(function()
            while ws do
                sendHeartbeat()
                wait(CONFIG.HEARTBEAT_INTERVAL)
            end
        end)
    end
    
    -- Set up message handler
    local handlerSet = false
    
    if ws.OnMessage then
        success = pcall(function()
            ws.OnMessage:Connect(function(message)
                log("Received: " .. message)
                
                -- Check for validation response
                if message:find('"type":"validation_response"') and message:find('"success":true') then
                    log("Validation successful")
                    validated = true
                    
                    -- Start heartbeat after successful validation
                    startHeartbeat()
                    
                elseif message:find('"type":"welcome"') then
                    -- Send validation request with all required information
                    log("Received welcome, sending validation")
                    
                    -- Create validation JSON with username
                    local request = '{"type":"validate",' ..
                                    '"serviceId":"' .. (service or "pandadevkit") .. '",' ..
                                    '"hwid":"' .. (hwid or "") .. '",' ..
                                    '"key":"' .. (key or "") .. '",' ..
                                    '"username":"' .. (username or "Player") .. '"}'
                    
                    -- Send it
                    pcall(function()
                        ws:Send(request)
                    end)
                    
                elseif message:find('"type":"admin_disconnect"') then
                    -- Handle admin disconnect (kicked from dashboard)
                    pcall(function()
                        if ws.Close then
                            ws:Close()
                        end
                    end)
                    validated = false
                    local BannedUser = game:GetService("Players").LocalPlayer.Name
                    local LocalPlayer = game.Players.LocalPlayer
                    local msg = "You're been Disconnected (Session End by Administrator)"
                    if BannedUser then
                        BannedUser = LocalPlayer:Kick(msg)
                    end
                    wait(2) 
                    while true do end
                elseif message:find('"type":"heartbeat_response"') then
                    -- Handle heartbeat response
                    log("Heartbeat acknowledged")
                end
            end)
            
            -- Handle connection close
            if ws.OnClose then
                ws.OnClose:Connect(function()
                    log("Connection closed")
                    
                    -- Stop heartbeat timer
                    if heartbeatTimer then
                        pcall(function() 
                            heartbeatTimer:Disconnect() 
                        end)
                        heartbeatTimer = nil
                    end
                    
                    -- Attempt to reconnect if validation was successful
                    if validated and reconnectAttempts < CONFIG.RECONNECT_ATTEMPTS then
                        reconnectAttempts = reconnectAttempts + 1
                        log("Attempting to reconnect... " .. reconnectAttempts .. "/" .. CONFIG.RECONNECT_ATTEMPTS)
                        
                        -- Wait a bit before reconnecting
                        wait(2)
                        
                        -- Recursive call to validate again
                        validated = ValidateKey(key, hwid, service, username)
                    end
                end)
            end
            
            -- Handle connection errors
            if ws.OnError then
                ws.OnError:Connect(function(errorMsg)
                    log("Connection error: " .. tostring(errorMsg))
                end)
            end
            
            handlerSet = true
        end)
    end
    
    if not handlerSet then
        log("Could not set message handler - trying blind validation")
        
        -- Send blind validation request with username
        local request = '{"type":"validate",' ..
                        '"serviceId":"' .. (service or "pandadevkit") .. '",' ..
                        '"hwid":"' .. (hwid or "") .. '",' ..
                        '"key":"' .. (key or "") .. '",' ..
                        '"username":"' .. (username or "Player") .. '"}'
        
        pcall(function()
            ws:Send(request)
        end)
    end
    
    -- Wait for validation with timeout
    local startTime = os.time()
    
    while not validated and os.time() - startTime < CONFIG.TIMEOUT do
        wait(0.1) -- Use wait() instead of task.wait() for compatibility
    end
    
    -- If not validated after timeout, close connection
    if not validated then
        pcall(function()
            if ws and ws.Close then
                ws:Close()
            end
        end)
        log("Authentication failed or timed out")
        return false
    end
    
    -- Return the WebSocket connection and validation status
    return true, ws
end

-- Example usage for Roblox
local key = "pandadev_ec6491365b7c17de93401ac28" -- Your key here
local hwid = "asswaaazzzzzz" -- Hardware ID
local service = "pandadevkit" -- Service ID
local username = "Player" -- Default username

-- Try to get player name from Roblox if available
pcall(function()
    if game and game.Players and game.Players.LocalPlayer then
        username = game.Players.LocalPlayer.Name
    end
end)

local success, connection = ValidateKey(key, hwid, service, username)

if success then
    print("[SUCCESS] Key validated successfully!")
    print("Connection is active and will maintain heartbeats")
    print("This client can now be managed from the dashboard")
    
    -- Your protected code goes here
    
    -- Keep the script running to maintain the connection
    spawn(function()
        while wait(1) do
            -- Keep alive
        end
    end)
else
    print("[FAILED] Key validation failed!")
end

print('---------------------------------')

-- Return API for script usage
return {
    validate = function(k, h, s, u)
        return ValidateKey(k, h, s, u)
    end
}
